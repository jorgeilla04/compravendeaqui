import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GrupoExplorer } from "@/components/tiendas/grupo-explorer";
import type { Tienda } from "@/lib/tiendas/types";
import { mockApi } from "@/test-utils/api-mock";

const tienda = {
  slug: "uniformes",
  nombre: "Uniformes escolares",
  grupo_label: "Colegio",
  categorias: [],
  vendedor_nombre: "Virginia Tello",
  whatsapp_url: "https://wa.me/5492645408193?text=hola",
  grupos: [
    {
      slug: "santa-rosa",
      nombre: "Colegio Santa Rosa de Lima",
      subtitulo: "Capital",
      categoria: null,
      color1: "#1E3A8A",
      color2: "#FFFFFF",
      logo_url: null,
    },
  ],
} as unknown as Tienda;

describe("¿No está tu colegio?", () => {
  it("si la búsqueda no encuentra el colegio, ofrece consultarlo por la plataforma o WhatsApp", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "POST /tiendas/uniformes/consultas": () => ({
        status: 201,
        json: { whatsapp_url: "https://wa.me/x" },
      }),
    });
    render(<GrupoExplorer tienda={tienda} />);
    await user.type(
      screen.getByLabelText("Buscá tu colegio"),
      "Nuevo Horizonte",
    );

    const consulta = screen.getByRole("region", {
      name: "¿No está tu colegio?",
    });
    expect(within(consulta).getByLabelText("Nombre del colegio")).toHaveValue(
      "Nuevo Horizonte",
    );
    const wa = within(consulta).getByRole("link", {
      name: /Preguntar por WhatsApp/,
    });
    expect(decodeURIComponent(wa.getAttribute("href") ?? "")).toContain(
      "¿tienen uniformes escolares del colegio Nuevo Horizonte?",
    );

    await user.click(
      within(consulta).getByRole("button", { name: "Enviar consulta" }),
    );
    expect(within(consulta).getByText("Poné tu nombre.")).toBeVisible();
    await user.type(within(consulta).getByLabelText("Tu nombre"), "Ana");
    await user.type(
      within(consulta).getByLabelText("Teléfono (WhatsApp)"),
      "264 412-3456",
    );
    await user.type(
      within(consulta).getByLabelText(/Qué necesitás/),
      "Chomba talle 10",
    );
    await user.click(
      within(consulta).getByRole("button", { name: "Enviar consulta" }),
    );

    expect(await screen.findByText(/Recibimos tu consulta/)).toBeVisible();
    expect(calls[0].body).toEqual({
      grupo: "Nuevo Horizonte",
      nombre: "Ana",
      telefono: "264 412-3456",
      mensaje: "Chomba talle 10",
    });
  });

  it("junto al buscador se puede preguntar aunque haya resultados", async () => {
    const user = userEvent.setup();
    render(<GrupoExplorer tienda={tienda} />);
    expect(
      screen.queryByRole("region", { name: "¿No está tu colegio?" }),
    ).toBeNull();
    await user.type(screen.getByLabelText("Buscá tu colegio"), "Santa");
    await user.click(
      screen.getByRole("button", { name: "Preguntanos por el tuyo" }),
    );
    const consulta = screen.getByRole("region", {
      name: "¿No está tu colegio?",
    });
    expect(within(consulta).getByLabelText("Nombre del colegio")).toHaveValue(
      "Santa",
    );
  });
});
