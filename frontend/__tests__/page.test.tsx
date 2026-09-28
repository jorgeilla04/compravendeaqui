import { render, screen } from "@testing-library/react";

import HomePage from "@/app/page";

describe("HomePage (landing mínima)", () => {
  it("renderiza el título principal", () => {
    render(<HomePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /San Juan/i }),
    ).toBeInTheDocument();
  });

  it("muestra el CTA de contacto por WhatsApp (WhatsApp-first)", () => {
    render(<HomePage />);
    const whatsappCtas = screen.getAllByRole("button", {
      name: /Contactar por WhatsApp/i,
    });
    expect(whatsappCtas.length).toBeGreaterThan(0);
  });

  it("expone una barra de búsqueda con label accesible", () => {
    render(<HomePage />);
    expect(screen.getByLabelText(/qué estás buscando/i)).toBeInTheDocument();
  });
});
