import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation, useOutletContext } from "react-router-dom";
import { Plus, Menu } from "lucide-react";
import ChatMessage from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import { PendingFile } from "@/components/FilePreviewCard";
import { createChat, getMessages, getLatestChat, getChatById, sendMessage, sendToN8n, updateChatTitle, ChatMessage as ChatMsg } from "@/services/chat";
import { uploadDocument, getSignedDocumentUrl } from "@/services/storage";
import { BotBadge } from "@/components/BotAvatar";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import type { LayoutContext } from "@/components/AppLayout";

const Chat = () => {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { openSidebar } = useOutletContext<LayoutContext>();
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentChatId, setCurrentChatId] = useState<string | null>(chatId ?? null);
  const [chatTitle, setChatTitle] = useState("Nueva conversación");
  const [isTyping, setIsTyping] = useState(false);

  const userName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "";
  const userEmail = user?.email || "";

  const redirected = useRef(false);
  const initialActionHandled = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }, 50);
  };

  // Auto-redirect to latest chat if no chatId in URL
  useEffect(() => {
    if (chatId || redirected.current) {
      setInitialLoading(false);
      return;
    }
    redirected.current = true;
    getLatestChat().then((chat) => {
      if (chat) {
        navigate(`/chat/${chat.id}`, { replace: true });
      } else {
        setInitialLoading(false);
      }
    }).catch(() => setInitialLoading(false));
  }, [chatId, navigate]);

  useEffect(() => {
    setCurrentChatId(chatId ?? null);
  }, [chatId]);

  // Handle initial message or file from lobby navigation
  useEffect(() => {
    if (initialActionHandled.current || !currentChatId) return;
    const state = location.state as { initialMessage?: string; initialFile?: File } | null;
    if (state?.initialMessage) {
      initialActionHandled.current = true;
      // Clear navigation state to prevent re-trigger
      window.history.replaceState({}, "");
      setInput(state.initialMessage);
      // Trigger send after messages load
      setTimeout(() => {
        setInput("");
        // Manually call send logic
        const doSend = async () => {
          setLoading(true);
          setIsTyping(true);
          const messageText = state.initialMessage!;
          try {
            const msg = await sendMessage(currentChatId, messageText, "user");
            setMessages((prev) => [...prev, msg]);
            scrollToBottom();
            // Auto-title
            const title = messageText.slice(0, 60);
            setChatTitle(title);
            updateChatTitle(currentChatId, title).then(() => {
              window.dispatchEvent(new CustomEvent('chat-title-updated'));
            }).catch(() => {});
            const n8nResponse = await sendToN8n(currentChatId, user?.id || '', messageText, 'user', undefined, userName, userEmail);
            setIsTyping(false);
            if (n8nResponse) {
              const botMsg = await sendMessage(currentChatId, n8nResponse, "assistant");
              setMessages((prev) => [...prev, botMsg]);
              scrollToBottom();
            }
          } catch (err: any) {
            setIsTyping(false);
            toast.error(err.message || "Error enviando mensaje");
          } finally {
            setLoading(false);
          }
        };
        doSend();
      }, 100);
    } else if (state?.initialFile) {
      initialActionHandled.current = true;
      window.history.replaceState({}, "");
      setTimeout(() => handleFileUpload(state.initialFile!), 100);
    }
  }, [currentChatId, location.state]);

  useEffect(() => {
    if (currentChatId) {
      getMessages(currentChatId).then((msgs) => {
        setMessages(msgs);
        scrollToBottom("instant");
      }).catch(() => toast.error("Error cargando mensajes"));
      getChatById(currentChatId).then((chat) => {
        if (chat) setChatTitle(chat.title);
      }).catch(() => {});
    } else {
      setMessages([]);
      setChatTitle("Nueva conversación");
    }
  }, [currentChatId]);

  const handleNewChat = async () => {
    try {
      const chat = await createChat("Nueva conversación");
      navigate(`/chat/${chat.id}`);
    } catch (err: any) {
      toast.error(err.message || "Error creando chat");
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    setLoading(true);
    setIsTyping(true);
    const messageText = input.trim();
    setInput("");

    try {
      let activeChatId = currentChatId;
      if (!activeChatId) {
        const chat = await createChat("Nueva conversación");
        activeChatId = chat.id;
        setCurrentChatId(chat.id);
        navigate(`/chat/${chat.id}`, { replace: true });
      }

      const msg = await sendMessage(activeChatId, messageText, "user");
      setMessages((prev) => [...prev, msg]);
      scrollToBottom();

      // Auto-title
      const isFirstMessage = messages.filter(m => m.role === 'user').length === 0;
      if (isFirstMessage || chatTitle === "Nueva conversación") {
        const title = messageText.slice(0, 60);
        setChatTitle(title);
        updateChatTitle(activeChatId, title).then(() => {
          window.dispatchEvent(new CustomEvent('chat-title-updated'));
        }).catch(() => {});
      }

      // Send to n8n
      const n8nResponse = await sendToN8n(activeChatId, user?.id || '', messageText, 'user', undefined, userName, userEmail);
      setIsTyping(false);
      if (n8nResponse) {
        const botMsg = await sendMessage(activeChatId, n8nResponse, "assistant");
        setMessages((prev) => [...prev, botMsg]);
        scrollToBottom();
      }
    } catch (err: any) {
      setIsTyping(false);
      toast.error(err.message || "Error enviando mensaje");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    const isAudio = file.type.startsWith("audio/");

    setPendingFile({ file, status: "uploading", progress: 30 });

    try {
      let activeChatId = currentChatId;
      if (!activeChatId) {
        const chat = await createChat("Nueva conversación");
        activeChatId = chat.id;
        setCurrentChatId(chat.id);
        navigate(`/chat/${chat.id}`, { replace: true });
      }

      setPendingFile((prev) => prev ? { ...prev, progress: 60 } : null);
      const doc = await uploadDocument(file, activeChatId);
      setPendingFile((prev) => prev ? { ...prev, progress: 90 } : null);

      let userMessage: string;
      if (isAudio) {
        // URL firmada para que el reproductor pueda leer el audio del bucket privado
        const signed = await getSignedDocumentUrl(doc.file_path, 60 * 60 * 24 * 365);
        userMessage = `[Audio](${signed}){.audio-player|${doc.mime_type}}`;
      } else {
        userMessage = `📎 Documento subido: ${doc.file_name}`;
      }
      const msg = await sendMessage(activeChatId, userMessage, "user");
      setMessages((prev) => [...prev, msg]);
      scrollToBottom();

      setPendingFile((prev) => prev ? { ...prev, status: "uploaded", progress: 100 } : null);
      setTimeout(() => setPendingFile(null), 2000);

      setIsTyping(true);
      const n8nMessage = isAudio ? "🎤 Audio" : userMessage;
      const n8nResponse = await sendToN8n(activeChatId, user?.id || '', n8nMessage, 'user', {
        id: doc.id,
        file_name: doc.file_name,
        file_path: doc.file_path,
        mime_type: doc.mime_type,
        size_bytes: doc.size_bytes,
      }, userName, userEmail);
      setIsTyping(false);
      if (n8nResponse) {
        const botMsg = await sendMessage(activeChatId, n8nResponse, "assistant");
        setMessages((prev) => [...prev, botMsg]);
        scrollToBottom();
      }
      if (!isAudio) toast.success("Documento subido correctamente");
    } catch (err: any) {
      setIsTyping(false);
      setPendingFile((prev) => prev ? { ...prev, status: "error", error: err.message } : null);
      toast.error(err.message || (isAudio ? "Error enviando audio" : "Error subiendo documento"));
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
    
    const isToday = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    if (isToday) return time;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate();
    if (isYesterday) return `Ayer, ${time}`;

    const day = d.getDate();
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${day} ${months[d.getMonth()]}, ${time}`;
  };

  if (initialLoading) {
    return (
      <div className="neo-chat flex items-center justify-center h-full">
        <span className="neo-strip neo-text-2 text-sm font-semibold px-3 py-1 rounded-lg">Cargando...</span>
      </div>
    );
  }

  return (
    <div className="neo-chat flex flex-col h-full min-h-0">
      <div className="px-3 sm:px-6 pt-3 sm:pt-4 safe-top">
        <header className="neo-raised-sm max-w-3xl mx-auto flex items-center gap-2.5 sm:gap-3 rounded-[22px] p-2 sm:py-3 sm:pl-5 sm:pr-3">
          <button
            onClick={openSidebar}
            className="neo-raised-sm neo-press neo-accent lg:hidden w-11 h-11 rounded-full flex items-center justify-center shrink-0"
            aria-label="Abrir menú"
          >
            <Menu size={19} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="neo-text text-sm sm:text-base font-extrabold truncate">{chatTitle}</h1>
            {messages.length > 0 && (
              <p className="neo-text-2 text-[11px] sm:text-xs font-medium">
                {messages.length} {messages.length === 1 ? "mensaje" : "mensajes"}
              </p>
            )}
          </div>
          <button
            onClick={handleNewChat}
            aria-label="Nueva conversación"
            className="neo-raised-sm neo-press neo-accent flex items-center justify-center gap-2 w-11 h-11 sm:w-auto sm:h-auto sm:px-[18px] sm:py-2.5 rounded-full text-[13px] font-extrabold shrink-0"
          >
            <Plus size={17} strokeWidth={2.4} />
            <span className="hidden sm:inline">Nueva conversación</span>
          </button>
        </header>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-5 sm:py-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-4 sm:gap-[22px]">
          {messages.length === 0 && !currentChatId && (
            <div className="flex items-center justify-center py-16">
              <p className="neo-strip neo-text-2 text-sm font-semibold px-3 py-1 rounded-lg">
                Envía un mensaje para comenzar una conversación
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              sender={msg.role === "user" ? "user" : "bot"}
              text={msg.content}
              time={formatTime(msg.created_at)}
            />
          ))}
          {isTyping && (
            <div className="flex items-center gap-2.5 sm:gap-3">
              <BotBadge />
              <span
                className="neo-raised-sm inline-flex items-center gap-1.5 px-[18px] py-3.5 rounded-[6px_22px_22px_22px]"
                aria-label="Polarier está escribiendo"
              >
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="inline-block w-2 h-2 rounded-full animate-bounce"
                    style={{ animationDelay: `${delay}ms`, background: "var(--neo-accent)" }}
                  />
                ))}
              </span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={loading}
        uploading={!!pendingFile && pendingFile.status === "uploading"}
        pendingFile={pendingFile}
        onRemovePendingFile={() => setPendingFile(null)}
        onRetryPendingFile={() => {
          if (pendingFile) handleFileUpload(pendingFile.file);
        }}
        onFileSelect={handleFileUpload}
        onAudioSend={handleFileUpload}
      />
    </div>
  );
};

export default Chat;