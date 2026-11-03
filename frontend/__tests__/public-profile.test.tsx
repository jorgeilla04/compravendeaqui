import { render, screen, within } from "@testing-library/react";

import SellerProfilePage, { generateMetadata } from "@/app/u/[id]/page";
import type { ListingCard, PublicProfile } from "@/lib/types";
import { jsonResponse } from "@/test-utils/fetch";

jest.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const ID = "6f1c1d2e-0000-4000-8000-000000000001";

const profile: PublicProfile = {
  id: ID,
  username: "juan.perez",
  display_name: "Juan Pérez",
  avatar_url: null,
  created_at: "2026-01-15T12:00:00Z",
  active_listings_count: 2,
};

function card(overrides: Partial<ListingCard> = {}): ListingCard {
  return {
    id: "lst-1",
    slug: "heladera-gafa",
    title: "Heladera Gafa 350 litros",
    price: "480000.00",
    price_currency: "ARS",
    price_usd_ref: null,
    condition: "usado",
    department: "Rivadavia",
    status: "active",
    category_slug: "hogar",
    url_path: "/hogar/heladera-gafa",
    thumb_url: null,
    created_at: "2026-10-01T12:00:00Z",
    ...overrides,
  };
}

let paths: string[] = [];

function mockServer(
  user: PublicProfile | null,
  items: ListingCard[] | null = [],
) {
  paths = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, "");
    paths.push(path);
    if (path === `/users/${ID}`)
      return user ? jsonResponse(user) : jsonResponse({ detail: "No" }, 404);
    if (path === `/users/${ID}/listings`)
      return items
        ? jsonResponse({ items, next_cursor: null })
        : jsonResponse({ detail: "No" }, 404);
    return jsonResponse({ detail: "No" }, 404);
  }) as jest.Mock;
}

async function renderPage(id = ID) {
  return render(await SellerProfilePage({ params: { id } }));
}

describe("/u/[id]", () => {
  it("muestra el vendedor y sus avisos", async () => {
    mockServer(profile, [
      card(),
      card({ id: "lst-2", title: "Bici rodado 29", url_path: "/bicis/bici" }),
    ]);
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Juan Pérez" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /En CompraVendeAqui desde enero de 2026 · 2 avisos publicados/,
      ),
    ).toBeInTheDocument();
    // Sin foto: inicial.
    expect(screen.getByText("J")).toBeInTheDocument();
    const section = screen.getByRole("region", { name: "Avisos publicados" });
    expect(within(section).getAllByRole("listitem")).toHaveLength(2);
    expect(within(section).getByText("Bici rodado 29")).toBeInTheDocument();
    expect(paths).toEqual([`/users/${ID}`, `/users/${ID}/listings`]);
  });

  it("muestra el estado vacío y la foto si la tiene", async () => {
    mockServer(
      {
        ...profile,
        active_listings_count: 1,
        avatar_url: "http://localhost:9000/avatars/u1.webp",
      },
      [],
    );
    await renderPage();
    expect(
      screen.getByRole("img", { name: "Foto de Juan Pérez" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 aviso publicado$/)).toBeInTheDocument();
    expect(
      screen.getByText("Por ahora no tiene avisos publicados."),
    ).toBeInTheDocument();
  });

  it("tolera que el listado de avisos no exista", async () => {
    mockServer({ ...profile, active_listings_count: 0 }, null);
    await renderPage();
    expect(screen.getByText(/0 avisos publicados/)).toBeInTheDocument();
    expect(
      screen.getByText("Por ahora no tiene avisos publicados."),
    ).toBeInTheDocument();
  });

  it("llama a notFound si el vendedor no existe", async () => {
    mockServer(null);
    await expect(renderPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("llama a notFound sin consultar la API si el id no es UUID", async () => {
    mockServer(profile);
    await expect(renderPage("no-es-uuid")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(paths).toHaveLength(0);
  });

  it("propaga errores del servidor", async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ detail: "Mantenimiento" }, 503),
    ) as jest.Mock;
    await expect(renderPage()).rejects.toThrow("Mantenimiento");
  });
});

describe("generateMetadata de /u/[id]", () => {
  it("arma título, descripción y canonical", async () => {
    mockServer(profile);
    expect(await generateMetadata({ params: { id: ID } })).toEqual({
      title: "Juan Pérez — avisos en San Juan",
      description: "Avisos de Juan Pérez en CompraVendeAqui. 2 publicados.",
      alternates: { canonical: `/u/${ID}` },
    });
  });

  it("usa un título genérico si no existe", async () => {
    mockServer(null);
    expect(await generateMetadata({ params: { id: ID } })).toEqual({
      title: "Vendedor no encontrado",
    });
    expect(await generateMetadata({ params: { id: "x" } })).toEqual({
      title: "Vendedor no encontrado",
    });
  });
});
