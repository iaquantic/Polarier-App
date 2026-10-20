import { supabase } from '@/lib/supabaseClient';
import { deleteDocumentsByChat } from '@/services/storage';
import { getN8nWebhookUrl } from '@/lib/n8nMode';
import { interpretarRespuestaN8n } from '@/lib/n8nRespuesta';

export interface Chat {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at?: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export const getChats = async (): Promise<Chat[]> => {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const getLatestChat = async (): Promise<Chat | null> => {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const getChatById = async (chatId: string): Promise<Chat | null> => {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .maybeSingle();
  if (error) throw error;
  return data;
};
export const createChat = async (title: string): Promise<Chat> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user');
  const { data, error } = await supabase
    .from('chats')
    .insert({ user_id: user.id, title })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const updateChatTitle = async (chatId: string, title: string): Promise<void> => {
  const { error } = await supabase
    .from('chats')
    .update({ title })
    .eq('id', chatId);
  if (error) throw error;
};

export const getMessages = async (chatId: string): Promise<ChatMessage[]> => {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
};

export const sendMessage = async (
  chatId: string,
  content: string,
  role: 'user' | 'assistant' = 'user'
): Promise<ChatMessage> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user');
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ chat_id: chatId, user_id: user.id, role, content })
    .select()
    .single();
  if (error) throw error;
  return data;
};

export const deleteChat = async (chatId: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user');

  // 1. Documentos del chat: archivos de Storage + filas en la tabla.
  //    (El cascade de la BD nunca borra archivos de Storage, por eso va explícito.)
  await deleteDocumentsByChat(chatId);

  // 2. Mensajes del chat.
  const { error: msgError } = await supabase
    .from('chat_messages')
    .delete()
    .eq('chat_id', chatId)
    .eq('user_id', user.id);
  if (msgError) throw msgError;

  // 3. El chat.
  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', chatId)
    .eq('user_id', user.id);
  if (error) throw error;
};

export const updateProfile = async (fullName: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No authenticated user');
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id);
  if (error) throw error;
};

export const getProfile = async (): Promise<{ full_name: string | null; avatar_url: string | null } | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();
  if (error) return null;
  return data;
};

export const sendToN8n = async (
  chatId: string,
  userId: string,
  message: string,
  role: string,
  fileInfo?: { id: string; file_name: string; file_path: string; mime_type: string; size_bytes: number },
  userName?: string,
  userEmail?: string
): Promise<string | null> => {
  try {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      user_id: userId,
      user_name: userName ?? null,
      user_email: userEmail ?? null,
      message,
      role,
      timestamp: new Date().toISOString(),
    };
    if (fileInfo) {
      payload.file = fileInfo;
    }
    const res = await fetch(getN8nWebhookUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return null;

    const { mensaje } = await interpretarRespuestaN8n(res, chatId);
    return mensaje;
  } catch {
    return null;
  }
};
