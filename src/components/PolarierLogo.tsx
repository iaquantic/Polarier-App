import logoAmarillo from "@/assets/polarier-logo.png";
import logoAzul from "@/assets/polarier-logo-azul.png";

interface PolarierLogoProps {
  className?: string;
  /**
   * "auto": azul marino en claro (va sobre amarillo) y amarillo en oscuro (va sobre azul).
   * "azul": siempre azul marino, para superficies blancas como la barra lateral del chat.
   */
  tone?: "auto" | "azul";
}

// El logo original es amarillo y desaparece sobre el fondo amarillo del modo claro;
// polarier-logo-azul.png es el mismo dibujo en #30397F.
const PolarierLogo = ({ className = "h-8", tone = "auto" }: PolarierLogoProps) => {
  if (tone === "azul") return <img src={logoAzul} alt="Polarier" className={`w-auto ${className}`} />;
  return (
    <>
      <img src={logoAzul} alt="Polarier" className={`w-auto dark:hidden ${className}`} />
      <img src={logoAmarillo} alt="Polarier" className={`w-auto hidden dark:block ${className}`} />
    </>
  );
};

export default PolarierLogo;
