import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ChatMessage from "@/components/ChatMessage";

const MARCADOR = "[TABLA CA 2026.xlsx](https://x.supabase.co/firmada?token=1){.file-download|xlsx}";

describe("ChatMessage con fichero", () => {
  it("pinta solo la tarjeta cuando el mensaje es únicamente el marcador", () => {
    render(<ChatMessage sender="bot" text={MARCADOR} time="10:00" />);
    expect(screen.getByRole("button", { name: /TABLA CA 2026\.xlsx/ })).toBeInTheDocument();
  });

  it("pinta el texto y la tarjeta cuando el marcador va en la última línea", () => {
    const resumen = "TABLA CA 2026 · Caibarién · SEPTIEMBRE\nEscritos (2):\n- CONSUMO AGUA: 1795";
    render(<ChatMessage sender="bot" text={`${resumen}\n\n${MARCADOR}`} time="10:00" />);
    expect(screen.getByText(/Escritos \(2\)/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /TABLA CA 2026\.xlsx/ })).toBeInTheDocument();
    expect(screen.queryByText(/file-download/)).not.toBeInTheDocument();
  });

  it("no confunde un corchete del texto con el marcador", () => {
    const texto = `Revisa [la fila 12 de la tabla\n\n${MARCADOR}`;
    render(<ChatMessage sender="bot" text={texto} time="10:00" />);
    expect(screen.getByText(/Revisa \[la fila 12/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /TABLA CA 2026\.xlsx/ })).toBeInTheDocument();
  });

  it("deja como texto un marcador que no está en su propia línea", () => {
    const texto = `El fichero es ${MARCADOR}`;
    render(<ChatMessage sender="bot" text={texto} time="10:00" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/El fichero es/)).toBeInTheDocument();
  });
});
