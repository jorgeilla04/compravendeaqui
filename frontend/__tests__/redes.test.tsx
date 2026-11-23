import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EstadoPublicacion } from "@/components/redes/estado-publicacion";
import { KitRedes } from "@/components/redes/kit-redes";
import { PublicarEnRedes } from "@/components/redes/publicar-en-redes";
import { PublicarProductoEnRedes } from "@/components/redes/publicar-producto";
import type { GrupoDetalle } from "@/lib/tiendas/types";
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
    expect(screen.queryByText(/falta conectar/i)).not.toBeInTheDocument();
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

describe("Publicar uniformes de un colegio", () => {
  const grupo = {
    slug: "colegio-san-pablo",
    nombre: "Colegio San Pablo",
    productos: [
      { slug: "remera", nombre: "Remera" },
      { slug: "campera", nombre: "Campera" },
    ],
  } as unknown as GrupoDetalle;
  const base = "/admin/redes/tiendas/uniformes/grupos/colegio-san-pablo";
  const respuesta = () => ({
    status: 200,
    json: {
      textos,
      conectadas: { facebook: true, instagram: false },
      publicaciones: [],
    },
  });

  it("se elige la prenda y la vista previa es la de esa prenda", async () => {
    const user = userEvent.setup();
    mockApi({
      [`GET ${base}/productos/remera`]: respuesta,
      [`GET ${base}/productos/campera`]: respuesta,
    });
    render(<PublicarProductoEnRedes tienda="uniformes" grupo={grupo} />);
    const img = await screen.findByAltText("Imagen que se va a publicar");
    expect(img).toHaveAttribute(
      "src",
      expect.stringContaining(`${base}/productos/remera/imagen.jpg`),
    );
    await user.selectOptions(screen.getByLabelText("Prenda"), "campera");
    expect(
      await screen.findByAltText("Imagen que se va a publicar"),
    ).toHaveAttribute(
      "src",
      expect.stringContaining(`${base}/productos/campera/imagen.jpg`),
    );
  });

  it("no aparece para quien no es administrador", () => {
    role = "user";
    const { container } = render(
      <PublicarProductoEnRedes tienda="uniformes" grupo={grupo} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Eliminar una publicación", () => {
  const base = {
    id: "p1",
    listing_id: "a1",
    producto_id: null,
    grupo_id: null,
    texto: "x",
    imagen_url: null,
    error: null,
    created_at: "2026-11-23T14:00:00Z",
    publicada_at: "2026-11-23T14:00:05Z",
  };

  it("borra de Facebook desde la herramienta, con confirmación", async () => {
    const user = userEvent.setup();
    const confirmar = jest.spyOn(window, "confirm").mockReturnValue(true);
    const calls = mockApi({
      "DELETE /admin/redes/p1": () => ({
        status: 200,
        json: {
          ...base,
          red: "facebook",
          estado: "eliminada",
          permalink: null,
        },
      }),
    });
    const onChange = jest.fn();
    render(
      <EstadoPublicacion
        publicacion={{
          ...base,
          red: "facebook",
          estado: "publicada",
          permalink: "https://www.facebook.com/1_2",
        }}
        onChange={onChange}
      />,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Eliminar la publicación de Facebook",
      }),
    );
    expect(confirmar).toHaveBeenCalled();
    expect(calls[0].key).toBe("DELETE /admin/redes/p1");
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ estado: "eliminada" }),
    );
    confirmar.mockRestore();
  });

  it("en Instagram no ofrece borrar (Meta no lo permite)", () => {
    render(
      <EstadoPublicacion
        publicacion={{
          ...base,
          red: "instagram",
          estado: "publicada",
          permalink: "https://www.instagram.com/p/x/",
        }}
        onChange={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: /Eliminar/ })).toBeNull();
  });
});

describe("Kit para tus redes (tiendas)", () => {
  it("muestra imagen y texto, y copia el texto para la red elegida", async () => {
    const user = userEvent.setup();
    const path =
      "/admin/tiendas/uniformes/grupos/colegio-san-pablo/productos/remera/kit";
    mockApi({
      [`GET ${path}`]: () => ({
        status: 200,
        json: {
          textos: {
            facebook: "Remera\n👉 https://x",
            instagram: "Remera\n👉 link en el perfil",
          },
          url: "https://x",
        },
      }),
    });
    render(<KitRedes path={path} archivo="remera" />);
    expect(await screen.findByAltText("Imagen para publicar")).toHaveAttribute(
      "src",
      expect.stringContaining(`${path}/imagen.jpg`),
    );
    expect(screen.getByText(/link en el perfil/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Texto Facebook" }));
    await user.click(screen.getByRole("button", { name: "Copiar texto" }));
    expect(await navigator.clipboard.readText()).toBe("Remera\n👉 https://x");
    expect(screen.getByRole("button", { name: "Copiado" })).toBeVisible();
  });
});
