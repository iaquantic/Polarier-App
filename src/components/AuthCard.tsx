import PolarierLogo from "@/components/PolarierLogo";

interface AuthCardProps {
  children: React.ReactNode;
}

const VALORES = "Excelencia · Proactividad · Innovación · Compromiso · Orientación al Cliente · Responsabilidad Ambiental";

const AuthCard = ({ children }: AuthCardProps) => {
  return (
    <div className="neo-ground polarier-pattern min-h-screen-dvh flex flex-col items-center justify-center gap-7 px-4 py-10 safe-top safe-bottom">
      <div className="neo-raised w-full max-w-[440px] rounded-[28px] sm:rounded-[32px] px-6 py-8 sm:px-9 sm:pt-10 sm:pb-9">
        <div className="text-center mb-5">
          <PolarierLogo className="h-9 sm:h-11 mx-auto" />
        </div>
        {children}
      </div>
      <p
        className="neo-strip neo-accent text-center text-[11px] sm:text-xs leading-relaxed px-4 py-1.5 rounded-full max-w-xl"
        style={{ fontFamily: "'Poppins', sans-serif", fontStyle: "italic", fontWeight: 400 }}
      >
        {VALORES}
      </p>
    </div>
  );
};

export default AuthCard;
