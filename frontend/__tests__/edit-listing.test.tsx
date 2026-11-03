import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import EditarAvisoLayout, {
  metadata as editarMetadata,
} from "@/app/avisos/[id]/editar/layout";
import EditarAvisoPage from "@/app/avisos/[id]/editar/page";
import type { CategoryNode, OwnerListing } from "@/lib/types";
import { jsonResponse } from "@/test-utils/fetch";

let search = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/avisos/lst-1/editar",
  useSearchParams: () => search,
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

const TREE: CategoryNode[] = [
  {
    id: "cat-veh",
    parent_id: null,
    name: "Vehículos",
    slug: "vehiculos",
    icon: "car",
    display_order: 1,
    children: [
      {
        id: "cat-autos",
        parent_id: "cat-veh",
        name: "Autos",
        slug: "autos",
        icon: null,
        display_order: 1,
        children: [],
      },
    ],
  },
  {
    id: "cat-hogar",
    parent_id: null,
    name: "Hogar",
    slug: "hogar",
    icon: "sofa",
    display_order: 2,
    children: [],
  },
];

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
    description: "Funciona perfecto, poco uso.",
    location: "Barrio Aramburu",
    category: {
      id: "cat-hogar",
      parent_id: null,
      name: "Hogar",
      slug: "hogar",
      icon: "sofa",
      display_order: 2,
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
    views_count: 0,
    contacts_count: 0,
    ...overrides,
  };
}

/** API típica: GET manage + categorías; PUT devuelve el aviso con el body. */
function standardApi(
  owned: OwnerListing,
  put?: (body: Record<string, unknown>) => { status?: number; body?: unknown },
) {
  mockApi(({ method, path, init }) => {
    if (path === "/categories") return { body: TREE };
    if (method === "GET" && path === "/listings/lst-1/manage")
      return { body: owned };
    if (method === "PUT" && path === "/listings/lst-1") {
      const body = JSON.parse(String(init.body));
      return put ? put(body) : { body: { ...owned, ...body } };
    }
    return { status: 404, body: { detail: "No" } };
  });
}

function renderPage() {
  return render(<EditarAvisoPage params={{ id: "lst-1" }} />);
}

const writes = () => calls.filter((c) => c.method !== "GET");

beforeAll(() => {
  window.scrollTo = jest.fn();
});

beforeEach(() => {
  search = new URLSearchParams();
});

describe("/avisos/[id]/editar", () => {
  it("carga el aviso con el formulario completo", async () => {
    standardApi(listing());
    renderPage();

    expect(screen.getByText("Cargando tu aviso…")).toBeInTheDocument();
    expect(await screen.findByLabelText("Título")).toHaveValue(
      "Heladera Gafa 350 litros",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Editar aviso" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Precio en pesos/)).toHaveValue("480.000");
    expect(screen.getByLabelText("Departamento")).toHaveValue("Rivadavia");
    expect(screen.getByLabelText("Categoría")).toHaveValue("cat-hogar");
    expect(screen.getByLabelText(/Localidad/)).toHaveValue("Barrio Aramburu");
    expect(screen.getByText("Publicado")).toBeInTheDocument();
    expect(screen.getByText(/Vence el/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver aviso/ })).toHaveAttribute(
      "href",
      "/hogar/heladera-gafa",
    );
    expect(screen.getByRole("link", { name: /Mis avisos/ })).toHaveAttribute(
      "href",
      "/mis-avisos",
    );
    // Activo: no ofrece publicar.
    expect(
      screen.queryByRole("button", { name: "Publicar aviso" }),
    ).not.toBeInTheDocument();
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(
      expect.arrayContaining(["GET /listings/lst-1/manage", "GET /categories"]),
    );
  });

  it("guarda con PUT y muestra la confirmación", async () => {
    standardApi(listing());
    const user = userEvent.setup();
    renderPage();

    const title = await screen.findByLabelText("Título");
    await user.clear(title);
    await user.type(title, "Heladera Gafa no frost");
    await user.click(screen.getByRole("radio", { name: /Dólares/ }));
    const price = screen.getByLabelText(/Precio en dólares/);
    await user.clear(price);
    await user.type(price, "1.500");
    expect(screen.getByText("US$ 1.500")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Categoría"), "cat-autos");
    await user.click(screen.getByRole("radio", { name: "No aplica" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Guardamos los cambios.")).toBeVisible();
    const [put] = writes();
    expect(`${put.method} ${put.path}`).toBe("PUT /listings/lst-1");
    expect(JSON.parse(String(put.init.body))).toEqual({
      title: "Heladera Gafa no frost",
      description: "Funciona perfecto, poco uso.",
      category_id: "cat-autos",
      price: "1500",
      price_currency: "USD",
      condition: null,
      department: "Rivadavia",
      location: "Barrio Aramburu",
    });

    // Editar de nuevo borra la confirmación.
    await user.type(title, "!");
    expect(
      screen.queryByText("Guardamos los cambios."),
    ).not.toBeInTheDocument();
  });

  it("no guarda si hay errores y enfoca el primer campo inválido", async () => {
    standardApi(listing());
    const user = userEvent.setup();
    renderPage();

    const title = await screen.findByLabelText("Título");
    await user.clear(title);
    await user.type(title, "abc");
    const price = screen.getByLabelText(/Precio en pesos/);
    await user.clear(price);
    await user.type(price, "mil");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(price).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/al menos 5 caracteres/)).toBeInTheDocument();
    await waitFor(() => expect(title).toHaveFocus());
    expect(writes()).toHaveLength(0);

    // Al corregir el campo se limpia su error.
    await user.type(title, "defg");
    expect(title).not.toHaveAttribute("aria-invalid", "true");
  });

  it("muestra el error del backend al guardar", async () => {
    standardApi(listing(), () => ({
      status: 422,
      body: { detail: [{ msg: "Value error, Precio fuera de rango" }] },
    }));
    const user = userEvent.setup();
    renderPage();

    await screen.findByLabelText("Título");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Precio fuera de rango",
    );
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
  });

  it("borrador: muestra el aviso de ?aviso=fotos-pendientes y publica", async () => {
    search = new URLSearchParams("aviso=fotos-pendientes");
    standardApi(listing({ status: "draft", expires_at: null }));
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByText(/no pudimos subir todas las fotos/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Tu aviso es un borrador/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ver aviso/ })).toBeNull();
    expect(screen.queryByText(/Vence el/)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Publicar aviso" }));
    expect(
      await screen.findByText("Tu aviso ya está publicado."),
    ).toBeVisible();
    const [put] = writes();
    expect(JSON.parse(String(put.init.body))).toMatchObject({
      status: "active",
      title: "Heladera Gafa 350 litros",
      category_id: "cat-hogar",
    });
    // Ya activo: desaparece el bloque de publicar y aparece el link.
    expect(screen.queryByRole("button", { name: "Publicar aviso" })).toBeNull();
    expect(screen.getByRole("link", { name: /Ver aviso/ })).toBeInTheDocument();
  });

  it("borrador: muestra el aviso de ?aviso=sin-publicar", async () => {
    search = new URLSearchParams("aviso=sin-publicar");
    standardApi(listing({ status: "draft" }));
    renderPage();
    expect(
      await screen.findByText(/no pudimos publicarlo/),
    ).toBeInTheDocument();
  });

  it("ignora ?aviso si el aviso ya está activo", async () => {
    search = new URLSearchParams("aviso=sin-publicar");
    standardApi(listing());
    renderPage();
    await screen.findByLabelText("Título");
    expect(screen.queryByText(/no pudimos publicarlo/)).toBeNull();
  });

  it("vencido: ofrece volver a publicar y muestra errores al activar", async () => {
    standardApi(listing({ status: "expired" }), () => ({
      status: 409,
      body: { detail: "Llegaste al límite de avisos" },
    }));
    const user = userEvent.setup();
    renderPage();

    expect(
      await screen.findByText(/Tu aviso venció y no aparece/),
    ).toBeInTheDocument();
    expect(screen.getByText("Vencido")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Volver a publicar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Llegaste al límite de avisos",
    );
  });

  it("no publica si el formulario tiene errores", async () => {
    standardApi(listing({ status: "draft", department: null }));
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Publicar aviso" }),
    );
    expect(screen.getByLabelText("Departamento")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(writes()).toHaveLength(0);
  });

  it("suspendido: avisa que está moderado", async () => {
    standardApi(listing({ status: "suspended" }));
    renderPage();
    expect(
      await screen.findByText(/fue suspendido por moderación/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /publicar/i })).toBeNull();
  });

  it("muestra la categoría actual aunque no esté en el árbol", async () => {
    standardApi(
      listing({
        category: {
          id: "cat-veh",
          parent_id: null,
          name: "Vehículos",
          slug: "vehiculos",
          icon: "car",
          display_order: 1,
        },
      }),
    );
    renderPage();
    const select = await screen.findByLabelText("Categoría");
    expect(select).toHaveValue("cat-veh");
    expect(
      screen.getByRole("option", { name: "Vehículos" }),
    ).toBeInTheDocument();
  });

  it.each([404, 422])("con %p muestra que no encontró el aviso", async (s) => {
    mockApi(({ path }) =>
      path === "/categories"
        ? { body: TREE }
        : { status: s, body: { detail: "No existe" } },
    );
    renderPage();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "No encontramos este aviso",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir a mis avisos" }),
    ).toHaveAttribute("href", "/mis-avisos");
  });

  it("si falla la carga, muestra el error y permite reintentar", async () => {
    let fail = true;
    mockApi(({ path }) => {
      if (path === "/categories") return { body: TREE };
      if (fail) return { status: 500, body: { detail: "Servidor caído" } };
      return { body: listing() };
    });
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Servidor caído",
    );
    fail = false;
    await user.click(
      screen.getByRole("button", { name: "Cargar el aviso de nuevo" }),
    );
    expect(await screen.findByLabelText("Título")).toHaveValue(
      "Heladera Gafa 350 litros",
    );
  });

  it("sin conexión muestra un mensaje genérico", async () => {
    global.fetch = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as jest.Mock;
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos conectarnos",
    );
  });
});

describe("layout de /avisos/[id]/editar", () => {
  it("no se indexa y renderiza a los hijos", () => {
    expect(editarMetadata.robots).toEqual({ index: false });
    render(<EditarAvisoLayout>hijo</EditarAvisoLayout>);
    expect(screen.getByText("hijo")).toBeInTheDocument();
  });
});
