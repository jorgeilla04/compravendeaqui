import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PublicarEnRedes } from "@/components/redes/publicar-en-redes";
import { mockApi } from "@/test-utils/api-mock";

let role = "admin";
jest.mock("@/components/auth/auth-provider", () => ({
  useOptionalAuth: () => ({ user: { role } }),
}));

const textos = {
  facebook: "Heladera\n💰 $ 500.000\n👉 Consultá: https://x",
  instagram: "Heladera\n💰 $ 500.000\n👉 link en el perfil",
};

describe("Publicar en redes", () => {
  beforeEach(() => {
    role = "admin";
  });

  it("no aparece para quien no es administrador", () => {
    role = "user";
    const { container } = render(<PublicarEnRedes listingId="a1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("sin conectar muestra la vista previa y no deja publicar", async () => {
    mockApi({
      "GET /admin/redes/avisos/a1": () => ({
        status: 200,
        json: {
          textos,
          conectadas: { facebook: false, instagram: false },
          publicaciones: [],
        },
      }),
    });
    render(<PublicarEnRedes listingId="a1" />);
    expect(
      await screen.findByAltText("Imagen que se va a publicar"),
    ).toHaveAttribute(
      "src",
      expect.stringContaining("/admin/redes/avisos/a1/imagen.jpg"),
    );
    expect(screen.getByLabelText(/Facebook/)).toBeDisabled();
    expect(screen.getByRole("button", { name: "Publicar" })).toBeDisabled();
    expect(screen.getByText(/Todavía no está conectada/)).toBeVisible();
  });

  it("publica en las redes elegidas y muestra el link", async () => {
    const user = userEvent.setup();
    let publicadas: unknown[] = [];
    const calls = mockApi({
      "GET /admin/redes/avisos/a1": () => ({
        status: 200,
        json: {
          textos,
          conectadas: { facebook: true, instagram: true },
          publicaciones: publicadas,
        },
      }),
      "POST /admin/redes/avisos/a1": () => {
        publicadas = [
          {
            id: "p1",
            listing_id: "a1",
            red: "facebook",
            estado: "publicada",
            texto: textos.facebook,
            imagen_url: "https://cdn/x.jpg",
            permalink: "https://www.facebook.com/111_9",
            error: null,
            created_at: "2026-11-23T10:00:00Z",
            publicada_at: "2026-11-23T10:00:05Z",
          },
        ];
        return { status: 202, json: [] };
      },
    });
    render(<PublicarEnRedes listingId="a1" />);
    await user.click(await screen.findByLabelText(/Facebook/));
    await user.click(screen.getByRole("button", { name: "Publicar" }));
    expect(
      await screen.findByRole("link", { name: /Ver la publicación/ }),
    ).toHaveAttribute("href", "https://www.facebook.com/111_9");
    expect(calls.find((c) => c.key.startsWith("POST"))?.body).toEqual({
      redes: ["facebook"],
    });

    await user.click(screen.getByRole("button", { name: "Texto Instagram" }));
    expect(screen.getByText(/link en el perfil/)).toBeVisible();
  });
});
