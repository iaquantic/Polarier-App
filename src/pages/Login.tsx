import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import AuthCard from "@/components/AuthCard";
import GoogleIcon from "@/components/GoogleIcon";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const Login = () => {
  const navigate = useNavigate();
  const { login, loginGoogle } = useAuth();
  const [showPass, setShowPass] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Si va bien, la página sale hacia Google: solo se vuelve a habilitar el botón si falla.
  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await loginGoogle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar sesión con Google");
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!email || !password) {
      toast.error("Por favor completa todos los campos");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      navigate("/lobby");
    } catch (err: any) {
      const msg: string = (err.message || "").toLowerCase();
      if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
        toast.error("Correo o contraseña incorrectos. Si no tienes cuenta, regístrate primero.");
      } else if (msg.includes("email not confirmed")) {
        toast.error("Debes verificar tu correo electrónico antes de iniciar sesión.");
      } else {
        toast.error(err.message || "Error al iniciar sesión");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard>
      <div className="text-center mb-6 space-y-2">
        <h1 className="neo-text text-[22px] sm:text-[26px] font-extrabold tracking-tight">Bienvenido de nuevo</h1>
        <p className="neo-text-2 text-sm font-medium leading-relaxed">
          Gestiona y procesa tus documentos con inteligencia artificial
        </p>
      </div>

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <div className="space-y-2">
          <label htmlFor="login-email" className="neo-text text-[13px] font-bold block pl-1.5">
            Correo electrónico
          </label>
          <div className="neo-field flex items-center gap-2.5 rounded-[18px] pl-4 pr-2 py-1">
            <Mail size={18} style={{ color: "var(--neo-field-icon)" }} aria-hidden="true" />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 min-w-0 bg-transparent py-3 text-[15px] outline-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 px-1.5">
            <label htmlFor="login-password" className="neo-text text-[13px] font-bold">
              Contraseña
            </label>
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="neo-accent text-xs font-bold hover:underline"
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
          <div className="neo-field flex items-center gap-2.5 rounded-[18px] pl-4 pr-1.5 py-1">
            <Lock size={18} style={{ color: "var(--neo-field-icon)" }} aria-hidden="true" />
            <input
              id="login-password"
              type={showPass ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 min-w-0 bg-transparent py-3 text-[15px] outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="neo-white-btn neo-press w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              style={{ color: "var(--neo-field-icon)" }}
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="neo-primary neo-press w-full mt-1 flex items-center justify-center gap-2.5 py-4 rounded-[18px] text-[15px] font-extrabold"
        >
          {loading ? "Iniciando..." : "Iniciar sesión"}
          {!loading && <ArrowRight size={18} />}
        </button>

        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="flex-1 h-px" style={{ background: "var(--neo-text-2)", opacity: 0.35 }} />
          <span className="neo-text-2 text-xs font-bold">o</span>
          <div className="flex-1 h-px" style={{ background: "var(--neo-text-2)", opacity: 0.35 }} />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          className="neo-white-btn neo-press w-full flex items-center justify-center gap-2.5 py-3.5 rounded-[18px] text-[15px] font-bold"
          style={{ color: "#0E1333" }}
        >
          <GoogleIcon />
          {googleLoading ? "Redirigiendo a Google..." : "Continuar con Google"}
        </button>

        <p className="neo-text-2 text-center text-[13px] font-medium">
          ¿No tienes cuenta?{" "}
          <button type="button" onClick={() => navigate("/register")} className="neo-accent font-extrabold hover:underline">
            Regístrate
          </button>
        </p>
      </form>
    </AuthCard>
  );
};

export default Login;
