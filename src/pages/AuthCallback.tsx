import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import AuthCard from "@/components/AuthCard";
import { useAuth } from "@/context/AuthContext";

/**
 * Callback tras verificar email, recuperar contraseña o entrar con Google.
 * - type=recovery → /reset-password
 * - resto (verificación de signup, OAuth) → /lobby
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const { setAuthProcessing, setIsRecovery } = useAuth();
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    setAuthProcessing(true);

    const hashParams = new URLSearchParams(
      window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash
    );
    const queryParams = new URLSearchParams(window.location.search);
    const urlType = hashParams.get("type") || queryParams.get("type");
    const urlError = hashParams.get("error") || queryParams.get("error");
    const urlErrorDescription =
      hashParams.get("error_description") || queryParams.get("error_description");

    const run = async () => {
      if (urlError) {
        setError(decodeURIComponent(urlErrorDescription || urlError).replace(/\+/g, " "));
        setTimeout(() => {
          setAuthProcessing(false);
          navigate("/login", { replace: true });
        }, 2500);
        return;
      }

      await new Promise((r) => setTimeout(r, 500));
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        setAuthProcessing(false);
        navigate("/login", { replace: true });
        return;
      }

      if (urlType === "recovery") {
        setIsRecovery(true);
        setAuthProcessing(false);
        navigate("/reset-password", { replace: true });
        return;
      }

      setAuthProcessing(false);
      navigate("/lobby", { replace: true });
    };

    run();
  }, [navigate, setAuthProcessing, setIsRecovery]);

  return (
    <AuthCard>
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">Completando autenticación...</p>
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      </div>
    </AuthCard>
  );
};

export default AuthCallback;
