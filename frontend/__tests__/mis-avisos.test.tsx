import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MisAvisosLayout, {
  metadata as misAvisosMetadata,
} from "@/app/mis-avisos/layout";
import MisAvisosPage from "@/app/mis-avisos/page";
import { actionsFor, metricsText } from "@/components/publish/listing-status";
import type { OwnerListing } from "@/lib/types";
import { jsonResponse } from "@/test-utils/fetch";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/mis-avisos",
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/components/auth/require-auth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => children,
}));

type Call = { method: string; path: string; init: RequestInit };
type Handler = (call: Call) => { status?: number; body?: unknown };
let calls: Call[] = [];

function mockApi(handler: Handler) {
  calls = [];
  global.fetch = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const call = {
        method: init?.method ?? "GET",
        path: url.pathname.replace(/^\/api\/v1/, ""),
        init: init ?? {},
      };
      calls.push(call);
      const { status = 200, body } = handler(call);
      return jsonResponse(body, status);
    },
  ) as jest.Mock;
}

function listing(overrides: Partial<OwnerListing> = {}): OwnerListing {
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
    description: "Funciona perfecto",
    location: null,
    category: {
      id: "cat-hogar",
      parent_id: null,
      name: "Hogar",
      slug: "hogar",
      icon: "sofa",
      display_order: 1,
    },
    images: [],
    seller: {
      id: "u1",
      username: "jorge",
      display_name: "Jorge",
      avatar_url: null,
      created_at: "2026-01-01T00:00:00Z",
    },
    fx_rate_at_publish: null,
    updated_at: "2026-10-01T12:00:00Z",
    expires_at: "2026-12-01T12:00:00Z",
    views_count: 12,
    contacts_count: 3,
    ...overrides,
  };
}

describe("helpers de estado", () => {
  it("arma las métricas en singular y plural", () => {
    expect(metricsText(12, 3)).toBe("12 vistas · 3 contactos por WhatsApp");
    expect(metricsText(1, 1)).toBe("1 vista · 1 contacto por WhatsApp");
  });

  it("ofrece acciones según el estado", () => {
    expect(actionsFor("active")).toEqual(
      expect.arrayContaining(["view", "sold", "pause"]),
    );
    expect(actionsFor("expired")).toContain("reactivate");
    expect(actionsFor("expired")).not.toContain("view");
    expect(actionsFor("suspended")).toEqual(["delete"]);
  });
});

describe("MisAvisosPage", () => {
  it("muestra estado vacío con CTA para publicar", async () => {
    mockApi(() => ({ body: [] }));
    render(<MisAvisosPage />);
    const cta = await screen.findByRole("link", {
      name: "Publicar mi primer aviso",
    });
    expect(cta).toHaveAttribute("href", "/publicar");
  });

  it("lista avisos con estado en texto, métricas y vencimiento", async () => {
    mockApi(() => ({
      body: [
        listing(),
        listing({
          id: "lst-2",
          title: "Bici rodado 29",
          status: "expired",
          price: null,
        }),
      ],
    }));
    render(<MisAvisosPage />);

    const active = await screen.findByRole("article", {
      name: "Heladera Gafa 350 litros",
    });
    expect(within(active).getByText("Publicado")).toBeInTheDocument();
    expect(within(active).getByText("$ 480.000")).toBeInTheDocument();
    expect(
      within(active).getByText("12 vistas · 3 contactos por WhatsApp"),
    ).toBeInTheDocument();
    expect(within(active).getByText(/^Vence el/)).toBeInTheDocument();
    expect(within(active).getByRole("link", { name: /^Ver/ })).toHaveAttribute(
      "href",
      "/hogar/heladera-gafa",
    );

    const expired = screen.getByRole("article", { name: "Bici rodado 29" });
    expect(within(expired).getByText("Vencido")).toBeInTheDocument();
    expect(within(expired).getByText("Precio a consultar")).toBeInTheDocument();
    expect(within(expired).queryByRole("link", { name: /^Ver/ })).toBeNull();
    expect(
      within(expired).getByRole("button", { name: /^Reactivar/ }),
    ).toBeInTheDocument();
  });

  it("marca como vendido con PUT y actualiza el estado", async () => {
    mockApi(({ method }) =>
      method === "PUT"
        ? { body: listing({ status: "sold" }) }
        : { body: [listing()] },
    );
    const user = userEvent.setup();
    render(<MisAvisosPage />);

    await user.click(
      await screen.findByRole("button", { name: /^Marcar como vendido/ }),
    );

    expect(await screen.findByText("Vendido")).toBeInTheDocument();
    const put = calls.find((c) => c.method === "PUT");
    expect(put?.path).toBe("/listings/lst-1");
    expect(JSON.parse(String(put?.init.body))).toEqual({ status: "sold" });
    expect(screen.getByRole("button", { name: /^Reactivar/ })).toBeEnabled();
  });

  it("pausa un aviso activo (pasa a borrador)", async () => {
    mockApi(({ method }) =>
      method === "PUT"
        ? { body: listing({ status: "draft" }) }
        : { body: [listing()] },
    );
    const user = userEvent.setup();
    render(<MisAvisosPage />);
    await user.click(await screen.findByRole("button", { name: /^Pausar/ }));
    expect(await screen.findByText("Borrador")).toBeInTheDocument();
    const put = calls.find((c) => c.method === "PUT");
    expect(JSON.parse(String(put?.init.body))).toEqual({ status: "draft" });
  });

  it("elimina solo después de confirmar en el diálogo", async () => {
    mockApi(({ method }) =>
      method === "DELETE" ? { status: 204 } : { body: [listing()] },
    );
    const user = userEvent.setup();
    render(<MisAvisosPage />);

    await user.click(await screen.findByRole("button", { name: /^Eliminar/ }));
    let dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("¿Eliminar este aviso?"),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);

    await user.click(screen.getByRole("button", { name: /^Eliminar/ }));
    dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Eliminar aviso" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("article", { name: "Heladera Gafa 350 litros" }),
      ).toBeNull(),
    );
    const del = calls.find((c) => c.method === "DELETE");
    expect(del?.path).toBe("/listings/lst-1");
    expect(
      screen.getByText("Eliminamos «Heladera Gafa 350 litros»."),
    ).toBeInTheDocument();
  });
});

describe("MisAvisosPage — más estados y errores", () => {
  it("ofrece acciones distintas para vendido, borrador y suspendido", async () => {
    mockApi(() => ({
      body: [
        listing({ id: "s1", title: "Vendido uno", status: "sold" }),
        listing({ id: "d1", title: "Borrador uno", status: "draft" }),
        listing({
          id: "x1",
          title: "Suspendido uno",
          status: "suspended",
          thumb_url: "http://localhost:9000/thumbs/x1.webp",
        }),
      ],
    }));
    render(<MisAvisosPage />);

    const sold = await screen.findByRole("article", { name: "Vendido uno" });
    expect(within(sold).getByText("Vendido")).toBeInTheDocument();
    expect(within(sold).queryByText(/^Vence el/)).toBeNull();
    expect(within(sold).getByRole("link", { name: /^Editar/ })).toHaveAttribute(
      "href",
      "/avisos/s1/editar",
    );
    expect(
      within(sold).getByRole("button", { name: /^Reactivar/ }),
    ).toBeInTheDocument();
    expect(within(sold).queryByRole("button", { name: /^Pausar/ })).toBeNull();
    expect(within(sold).getByText("Sin foto")).toBeInTheDocument();

    const draft = screen.getByRole("article", { name: "Borrador uno" });
    expect(within(draft).getByText("Borrador")).toBeInTheDocument();
    expect(
      within(draft).queryByRole("button", { name: /^Marcar como vendido/ }),
    ).toBeNull();

    const suspended = screen.getByRole("article", { name: "Suspendido uno" });
    expect(
      within(suspended).getByText(/Suspendido por moderación/),
    ).toBeInTheDocument();
    expect(within(suspended).queryByRole("link")).toBeNull();
    expect(within(suspended).getAllByRole("button")).toHaveLength(1);
    expect(within(suspended).queryByText("Sin foto")).toBeNull();
  });

  it("reactiva un aviso y confirma el cambio", async () => {
    mockApi(({ method }) =>
      method === "PUT"
        ? { body: listing({ status: "active" }) }
        : { body: [listing({ status: "expired" })] },
    );
    const user = userEvent.setup();
    render(<MisAvisosPage />);
    await user.click(await screen.findByRole("button", { name: /^Reactivar/ }));
    expect(
      await screen.findByText(
        "«Heladera Gafa 350 litros» está publicado de nuevo.",
      ),
    ).toBeInTheDocument();
    const put = calls.find((c) => c.method === "PUT");
    expect(JSON.parse(String(put?.init.body))).toEqual({ status: "active" });
  });

  it("muestra el error si falla un cambio de estado", async () => {
    mockApi(({ method }) =>
      method === "PUT"
        ? { status: 409, body: { detail: "Llegaste al límite de avisos" } }
        : { body: [listing()] },
    );
    const user = userEvent.setup();
    render(<MisAvisosPage />);
    await user.click(await screen.findByRole("button", { name: /^Pausar/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Llegaste al límite de avisos",
    );
    expect(screen.getByText("Publicado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Pausar/ })).toBeEnabled();
  });

  it("muestra el error si falla la eliminación y conserva el aviso", async () => {
    mockApi(({ method }) =>
      method === "DELETE"
        ? { status: 500, body: { detail: "No pudimos eliminarlo" } }
        : { body: [listing()] },
    );
    const user = userEvent.setup();
    render(<MisAvisosPage />);
    await user.click(await screen.findByRole("button", { name: /^Eliminar/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Eliminar aviso" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos eliminarlo",
    );
    expect(
      screen.getByRole("article", { name: "Heladera Gafa 350 litros" }),
    ).toBeInTheDocument();
  });

  it("si falla la carga permite reintentar", async () => {
    let fail = true;
    mockApi(() =>
      fail
        ? { status: 500, body: { detail: "Servidor caído" } }
        : { body: [listing()] },
    );
    const user = userEvent.setup();
    render(<MisAvisosPage />);
    expect(screen.getByText("Cargando tus avisos…")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Servidor caído",
    );
    fail = false;
    await user.click(
      screen.getByRole("button", { name: "Cargar mis avisos de nuevo" }),
    );
    expect(
      await screen.findByRole("article", { name: "Heladera Gafa 350 litros" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Publicar aviso/ }),
    ).toHaveAttribute("href", "/publicar");
  });
});

describe("layout de /mis-avisos", () => {
  it("no se indexa y renderiza a los hijos", () => {
    expect(misAvisosMetadata.robots).toEqual({ index: false });
    render(<MisAvisosLayout>hijo</MisAvisosLayout>);
    expect(screen.getByText("hijo")).toBeInTheDocument();
  });
});
