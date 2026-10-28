import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import AuthCard from "@/components/AuthCard";
import GoogleIcon from "@/components/GoogleIcon";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const Register = () => {
  const navigate = useNavigate();
  const { signUp, loginGoogle } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sent, setSent] = useState(false);

  // Con Google no hay correo de verificación: la cuenta queda creada al volver.
  const handleGoogle = async () => {
    if (!accepted) {
      toast.error("Debes aceptar los términos y condiciones");
      return;
    }
    setGoogleLoading(true);
    try {
      await loginGoogle();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo continuar con Google");
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name || !email || !password || !confirmPassword) {
      toast.error("Por favor completa todos los campos");
      return;
    }
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (!accepted) {
      toast.error("Debes aceptar los términos y condiciones");
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, name);
      setSent(true);
    } catch (err: any) {
      const msg: string = (err.message || "").toLowerCase();
      if (msg.includes("already registered") || msg.includes("user already")) {
        toast.error("Este correo ya está registrado. Inicia sesión.");
      } else {
        toast.error(err.message || "Error al crear cuenta");
      }
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthCard>
        <div className="text-center space-y-4 py-4">
          <h2 className="text-lg font-semibold text-foreground">Revisa tu correo</h2>
          <p className="text-sm text-muted-foreground">
            Te hemos enviado un enlace de verificación a{" "}
            <span className="font-medium text-foreground">{email}</span>. Ábrelo para completar el
            registro.
          </p>
          <button
            onClick={() => navigate("/login")}
            className="text-sm text-secondary hover:underline"
          >
            Volver al inicio de sesión
          </button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <p className="text-center text-sm text-muted-foreground mb-6">Crea tu cuenta en Polarier</p>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Nombre completo</label>
          <input
            type="text"
            placeholder="Tu nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring bg-card"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Correo electrónico</label>
          <input
            type="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring bg-card"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Contraseña</label>
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring bg-card pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Confirmar contraseña</label>
          <input
            type={showPass ? "text" : "password"}
            placeholder="Repite la contraseña"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="w-full border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring bg-card"
          />
        </div>

        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-1 accent-secondary"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          <span className="text-sm text-muted-foreground">
            Acepto los términos y condiciones y la política de privacidad
          </span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity text-sm disabled:opacity-50"
        >
          {loading ? "Creando..." : "Crear cuenta"}
        </button>

        <div className="flex items-center gap-3" aria-hidden="true">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">o</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          className="w-full py-2.5 border border-border rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-muted transition-colors bg-card disabled:opacity-50"
        >
          <GoogleIcon size={16} />
          {googleLoading ? "Redirigiendo a Google..." : "Continuar con Google"}
        </button>

        <p className="text-center text-sm text-muted-foreground mt-4">
          ¿Ya tienes cuenta?{" "}
          <button onClick={() => navigate("/login")} className="text-foreground font-medium hover:underline">
            Inicia sesión
          </button>
        </p>
      </div>
    </AuthCard>
  );
};

export default Register;
