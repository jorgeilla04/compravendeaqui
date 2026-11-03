import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PublicarLayout, {
  metadata as publicarMetadata,
} from "@/app/publicar/layout";
import PublicarPage from "@/app/publicar/page";
import {
  emptyDraft,
  parsePrice,
  priceToInput,
  toListingInput,
  validateCategory,
  validateDetails,
  validatePricing,
} from "@/components/publish/listing-draft";
import {
  MAX_PHOTO_BYTES,
  checkPhotoFiles,
  moveToFront,
} from "@/components/publish/photo-files";
import type { CategoryNode } from "@/lib/types";
import { jsonResponse } from "@/test-utils/fetch";

const push = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/publicar",
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/components/auth/require-auth", () => ({
  RequireAuth: ({ children }: { children: React.ReactNode }) => children,
}));

// --- fetch mock ---------------------------------------------------------------

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

const created = {
  id: "lst-1",
  url_path: "/autos/heladera-gafa-lst1",
  status: "draft",
  images: [],
};

function photo(name: string, type = "image/jpeg", size?: number): File {
  const file = new File(["x"], name, { type });
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  return file;
}

beforeAll(() => {
  URL.createObjectURL = jest.fn((f: Blob) => `blob:${(f as File).name}`);
  URL.revokeObjectURL = jest.fn();
  window.scrollTo = jest.fn();
});

beforeEach(() => {
  push.mockReset();
});

// --- helpers puros --------------------------------------------------------------

describe("parsePrice", () => {
  it.each([
    ["", null],
    ["480.000", "480000"],
    ["480000", "480000"],
    ["15.900,50", "15900.5"],
    ["15900,5", "15900.5"],
    ["15900.50", "15900.5"],
    ["$ 1.500", "1500"],
    ["0", "0"],
  ])("normaliza %p → %p", (raw, value) => {
    expect(parsePrice(raw)).toEqual({ ok: true, value });
  });

  it.each(["abc", "-5", "1,2,3", "12.3456", "1234567890123"])(
    "rechaza %p",
    (raw) => {
      expect(parsePrice(raw).ok).toBe(false);
    },
  );

  it("vuelve al formato de edición", () => {
    expect(priceToInput("480000.00")).toBe("480.000");
    expect(priceToInput("15900.50")).toBe("15.900,50");
    expect(priceToInput(null)).toBe("");
  });
});

describe("validación por paso", () => {
  it("pide categoría y subcategoría", () => {
    expect(validateCategory(emptyDraft, TREE).category).toMatch(
      /Elegí una categoría/,
    );
    expect(
      validateCategory({ ...emptyDraft, parentId: "cat-veh" }, TREE).category,
    ).toMatch(/subcategoría de Vehículos/);
    expect(
      validateCategory({ ...emptyDraft, categoryId: "cat-hogar" }, TREE),
    ).toEqual({});
  });

  it("valida largo de título y descripción", () => {
    const errors = validateDetails({
      ...emptyDraft,
      title: " ab ",
      description: "corta",
    });
    expect(errors.title).toBeDefined();
    expect(errors.description).toBeDefined();
    expect(
      validateDetails({
        ...emptyDraft,
        title: "Heladera Gafa",
        description: "Funciona perfecto, poco uso.",
      }),
    ).toEqual({});
  });

  it("exige departamento válido y precio numérico", () => {
    const errors = validatePricing({ ...emptyDraft, price: "mil" });
    expect(errors.price).toBeDefined();
    expect(errors.department).toBeDefined();
    expect(
      validatePricing({ ...emptyDraft, price: "", department: "Rivadavia" }),
    ).toEqual({});
  });

  it("arma el cuerpo de la API", () => {
    expect(
      toListingInput({
        ...emptyDraft,
        categoryId: "cat-hogar",
        title: " Heladera ",
        description: "Funciona perfecto",
        condition: "na",
        currency: "USD",
        price: "1.500",
        department: "Capital",
        location: "  ",
      }),
    ).toEqual({
      title: "Heladera",
      description: "Funciona perfecto",
      category_id: "cat-hogar",
      price: "1500",
      price_currency: "USD",
      condition: null,
      department: "Capital",
      location: null,
    });
  });
});

describe("checkPhotoFiles", () => {
  it("rechaza tipos no soportados y fotos de más de 10 MB", () => {
    const { accepted, errors } = checkPhotoFiles(
      [
        photo("ok.jpg"),
        photo("doc.pdf", "application/pdf"),
        photo("pesada.png", "image/png", MAX_PHOTO_BYTES + 1),
      ],
      0,
    );
    expect(accepted.map((f) => f.name)).toEqual(["ok.jpg"]);
    expect(errors).toHaveLength(2);
    expect(errors[1]).toMatch(/hasta 10 MB/);
  });

  it("respeta el máximo de 10 fotos", () => {
    const { accepted, errors } = checkPhotoFiles(
      [photo("a.jpg"), photo("b.jpg"), photo("c.jpg")],
      8,
    );
    expect(accepted).toHaveLength(2);
    expect(errors[0]).toMatch(/hasta 10 fotos/);
  });

  it("mueve una foto a portada", () => {
    expect(moveToFront(["a", "b", "c"], 2)).toEqual(["c", "a", "b"]);
    expect(moveToFront(["a", "b"], 0)).toEqual(["a", "b"]);
  });
});

const photoInput = () =>
  screen.getByLabelText(/Subí fotos/, { selector: "input" });

// --- wizard -----------------------------------------------------------------------

async function fillUntilPhotos(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /Vehículos/ }));
  await user.click(screen.getByRole("button", { name: "Autos" }));
  expect(screen.getByText(/Paso 2 de 5/)).toBeInTheDocument();

  await user.type(screen.getByLabelText("Título"), "Heladera Gafa 350 litros");
  await user.type(
    screen.getByLabelText("Descripción"),
    "Funciona perfecto, poco uso.",
  );
  await user.click(screen.getByLabelText("Usado"));
  await user.click(screen.getByRole("button", { name: /Siguiente/ }));
  expect(screen.getByText(/Paso 3 de 5/)).toBeInTheDocument();

  await user.type(screen.getByLabelText(/Precio en pesos/), "480.000");
  await user.selectOptions(screen.getByLabelText("Departamento"), "Rivadavia");
  await user.click(screen.getByRole("button", { name: /Siguiente/ }));
  expect(screen.getByText(/Paso 4 de 5/)).toBeInTheDocument();
}

describe("PublicarPage (wizard)", () => {
  it("no avanza si falta la categoría o los datos del paso", async () => {
    mockApi(() => ({ body: TREE }));
    const user = userEvent.setup();
    render(<PublicarPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Publicá tu aviso" }),
    ).toBeInTheDocument();
    await screen.findByRole("button", { name: /Hogar/ });

    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Elegí una categoría/,
    );
    expect(screen.getByText(/Paso 1 de 5/)).toBeInTheDocument();

    // Padre con hijas: hay que elegir subcategoría.
    await user.click(screen.getByRole("button", { name: /Vehículos/ }));
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /subcategoría de Vehículos/,
    );

    await user.click(screen.getByRole("button", { name: "Autos" }));
    expect(screen.getByText(/Paso 2 de 5/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Título"), "Hela");
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(screen.getByText(/Paso 2 de 5/)).toBeInTheDocument();
    expect(screen.getByLabelText("Título")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText(/al menos 5 caracteres/)).toBeInTheDocument();
  });

  it("rechaza fotos de más de 10 MB con un mensaje claro", async () => {
    mockApi(() => ({ body: TREE }));
    const user = userEvent.setup();
    render(<PublicarPage />);
    await fillUntilPhotos(user);

    await user.upload(
      photoInput(),
      photo("enorme.jpg", "image/jpeg", MAX_PHOTO_BYTES + 1),
    );
    expect(screen.getByText(/«enorme.jpg» pesa/)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Fotos elegidas" })).toBeNull();
  });

  it("publica: borrador → fotos en orden → activar → redirige", async () => {
    mockApi(({ method, path }) => {
      if (path === "/categories") return { body: TREE };
      if (method === "POST" && path === "/listings")
        return { status: 201, body: created };
      if (method === "POST" && path === "/listings/lst-1/images")
        return { body: created };
      if (method === "PUT" && path === "/listings/lst-1")
        return { body: { ...created, status: "active" } };
      return { status: 404, body: { detail: "No" } };
    });
    const user = userEvent.setup();
    render(<PublicarPage />);
    await fillUntilPhotos(user);

    await user.upload(photoInput(), [
      photo("frente.jpg"),
      photo("costado.png", "image/png"),
    ]);
    const list = screen.getByRole("list", { name: "Fotos elegidas" });
    expect(within(list).getAllByRole("img")).toHaveLength(2);
    await user.click(
      screen.getByRole("button", { name: "Usar como portada (foto 2)" }),
    );

    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(screen.getByText(/Paso 5 de 5/)).toBeInTheDocument();
    expect(screen.getByText("Vehículos › Autos")).toBeInTheDocument();
    expect(screen.getByText("$ 480.000")).toBeInTheDocument();

    const publish = screen.getByRole("button", { name: "Publicar aviso" });
    await user.click(publish);

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/autos/heladera-gafa-lst1"),
    );

    const writes = calls.filter((c) => c.method !== "GET");
    expect(writes.map((c) => `${c.method} ${c.path}`)).toEqual([
      "POST /listings",
      "POST /listings/lst-1/images",
      "POST /listings/lst-1/images",
      "PUT /listings/lst-1",
    ]);
    expect(JSON.parse(String(writes[0].init.body))).toMatchObject({
      status: "draft",
      category_id: "cat-autos",
      price: "480000",
      price_currency: "ARS",
      condition: "usado",
      department: "Rivadavia",
    });
    const uploaded = writes
      .slice(1, 3)
      .map((c) => ((c.init.body as FormData).get("files") as File).name);
    expect(uploaded).toEqual(["costado.png", "frente.jpg"]);
    expect(JSON.parse(String(writes[3].init.body))).toEqual({
      status: "active",
    });
  });

  it("si fallan las fotos, deja el borrador y manda a editar", async () => {
    mockApi(({ method, path }) => {
      if (path === "/categories") return { body: TREE };
      if (method === "POST" && path === "/listings")
        return { status: 201, body: created };
      if (path.endsWith("/images"))
        return { status: 503, body: { detail: "Storage caído" } };
      return { body: created };
    });
    const user = userEvent.setup();
    render(<PublicarPage />);
    await fillUntilPhotos(user);
    await user.upload(photoInput(), photo("a.jpg"));
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await user.click(screen.getByRole("button", { name: "Publicar aviso" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/avisos/lst-1/editar?aviso=fotos-pendientes",
      ),
    );
    expect(calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("muestra el error y permite reintentar si falla la creación", async () => {
    mockApi(({ method, path }) => {
      if (path === "/categories") return { body: TREE };
      if (method === "POST")
        return { status: 422, body: { detail: "Categoría inválida" } };
      return { body: {} };
    });
    const user = userEvent.setup();
    render(<PublicarPage />);
    await fillUntilPhotos(user);
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await user.click(screen.getByRole("button", { name: "Publicar aviso" }));

    expect(await screen.findByText("Categoría inválida")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Publicar aviso" }),
    ).toBeEnabled();
  });
});

describe("PublicarPage — navegación y casos borde", () => {
  it("«Cambiar categoría» vuelve a la lista sin mostrar errores", async () => {
    mockApi(() => ({ body: TREE }));
    const user = userEvent.setup();
    render(<PublicarPage />);

    await user.click(await screen.findByRole("button", { name: /Vehículos/ }));
    expect(
      screen.getByRole("list", { name: "Subcategorías de Vehículos" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Cambiar categoría/ }));

    expect(
      screen.getByRole("list", { name: "Categorías" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Paso 1 de 5/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("si fallan las categorías permite reintentar", async () => {
    let fail = true;
    mockApi(() =>
      fail
        ? { status: 500, body: { detail: "No cargaron las categorías" } }
        : { body: TREE },
    );
    const user = userEvent.setup();
    render(<PublicarPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No cargaron las categorías",
    );
    fail = false;
    await user.click(
      screen.getByRole("button", { name: "Cargar categorías de nuevo" }),
    );
    expect(
      await screen.findByRole("button", { name: /Hogar/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/Paso 1 de 5/)).toBeInTheDocument();
  });

  it("vuelve con «Atrás» conservando lo cargado", async () => {
    mockApi(() => ({ body: TREE }));
    const user = userEvent.setup();
    render(<PublicarPage />);
    await fillUntilPhotos(user);

    await user.click(screen.getByRole("button", { name: "Atrás" }));
    expect(screen.getByText(/Paso 3 de 5/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Poné precio y ubicación",
      }),
    ).toHaveFocus();
    expect(screen.getByLabelText(/Precio en pesos/)).toHaveValue("480.000");
    expect(
      screen.getByText("Se va a ver así:", { exact: false }),
    ).toHaveTextContent("$ 480.000");

    await user.click(screen.getByRole("button", { name: "Atrás" }));
    expect(screen.getByLabelText("Título")).toHaveValue(
      "Heladera Gafa 350 litros",
    );
    await user.click(screen.getByRole("button", { name: "Atrás" }));
    expect(screen.getByText(/Paso 1 de 5/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Atrás" })).toBeNull();
  });

  it("valida precio con formato inválido y cambia la moneda", async () => {
    mockApi(() => ({ body: TREE }));
    const user = userEvent.setup();
    render(<PublicarPage />);
    await user.click(await screen.findByRole("button", { name: /Hogar/ }));
    await user.type(screen.getByLabelText("Título"), "Heladera Gafa");
    await user.type(screen.getByLabelText("Descripción"), "Funciona perfecto.");
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));

    await user.click(screen.getByRole("radio", { name: /Dólares/ }));
    const price = screen.getByLabelText(/Precio en dólares \(US\$\)/);
    await user.type(price, "1,2,3");
    expect(screen.queryByText(/Se va a ver así/)).toBeNull();
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(price).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/solo con números/)).toBeInTheDocument();
    expect(screen.getByText(/Elegí el departamento/)).toBeInTheDocument();
    expect(screen.getByText(/Paso 3 de 5/)).toBeInTheDocument();

    // Corregir limpia el error de ese campo.
    await user.clear(price);
    expect(price).not.toHaveAttribute("aria-invalid", "true");
    await user.type(price, "15.900,50");
    expect(screen.getByText(/Se va a ver así/)).toHaveTextContent("US$ 15.901");
  });

  it("revisión: sin precio, sin fotos y atajos «Editar» a cada paso", async () => {
    mockApi(() => ({ body: TREE }));
    const user = userEvent.setup();
    render(<PublicarPage />);
    await user.click(await screen.findByRole("button", { name: /Hogar/ }));
    await user.type(screen.getByLabelText("Título"), "Heladera Gafa");
    await user.type(screen.getByLabelText("Descripción"), "Funciona perfecto.");
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await user.selectOptions(screen.getByLabelText("Departamento"), "Capital");
    await user.type(screen.getByLabelText(/Localidad/), "Centro");
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(
      screen.getByText(/Te recomendamos subir al menos una foto/),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));

    expect(screen.getByText(/Paso 5 de 5/)).toBeInTheDocument();
    expect(screen.getByText("Hogar")).toBeInTheDocument();
    expect(screen.getByText("Precio a consultar")).toBeInTheDocument();
    expect(screen.getByText("No aplica")).toBeInTheDocument();
    expect(screen.getByText("Centro, Capital")).toBeInTheDocument();
    expect(screen.getByText("Sin fotos")).toBeInTheDocument();

    const steps: [string, RegExp][] = [
      ["Editar fotos", /Paso 4 de 5/],
      ["Editar precio y ubicación", /Paso 3 de 5/],
      ["Editar detalles", /Paso 2 de 5/],
      ["Editar categoría", /Paso 1 de 5/],
    ];
    for (const [label, step] of steps) {
      // Volver a la revisión: siguiente hasta el paso 5.
      while (!screen.queryByText(/Paso 5 de 5/)) {
        await user.click(screen.getByRole("button", { name: /Siguiente/ }));
      }
      await user.click(screen.getByRole("button", { name: label }));
      expect(screen.getByText(step)).toBeInTheDocument();
    }
  });

  it("quita una foto elegida y muestra la cantidad en la revisión", async () => {
    mockApi(() => ({ body: TREE }));
    const user = userEvent.setup();
    render(<PublicarPage />);
    await fillUntilPhotos(user);
    await user.upload(photoInput(), [
      photo("a.jpg"),
      photo("b.jpg"),
      photo("c.jpg"),
    ]);
    await user.click(screen.getByRole("button", { name: "Quitar (foto 2)" }));
    const list = screen.getByRole("list", { name: "Fotos elegidas" });
    expect(
      within(list)
        .getAllByRole("img")
        .map((i) => i.getAttribute("alt")),
    ).toEqual(["Foto 1: a.jpg", "Foto 2: c.jpg"]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:b.jpg");

    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    expect(screen.getByText("2 fotos")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Portada" })).toHaveAttribute(
      "src",
      "blob:a.jpg",
    );
    expect(screen.getByText("Usado")).toBeInTheDocument();
  });

  it("si falla la activación manda a editar con ?aviso=sin-publicar", async () => {
    mockApi(({ method, path }) => {
      if (path === "/categories") return { body: TREE };
      if (method === "POST" && path === "/listings")
        return { status: 201, body: created };
      if (method === "PUT")
        return { status: 409, body: { detail: "Límite de avisos" } };
      return { body: created };
    });
    const user = userEvent.setup();
    render(<PublicarPage />);
    await fillUntilPhotos(user);
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));
    await user.click(screen.getByRole("button", { name: "Publicar aviso" }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/avisos/lst-1/editar?aviso=sin-publicar",
      ),
    );
  });

  it("muestra el progreso mientras publica", async () => {
    let release: () => void = () => {};
    mockApi(() => ({ body: TREE }));
    const user = userEvent.setup();
    render(<PublicarPage />);
    await fillUntilPhotos(user);
    await user.click(screen.getByRole("button", { name: /Siguiente/ }));

    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = () =>
            resolve(jsonResponse({ detail: "Sin conexión" }, 500));
        }),
    ) as jest.Mock;
    await user.click(screen.getByRole("button", { name: "Publicar aviso" }));
    expect(screen.getByRole("status")).toHaveTextContent("Guardando tu aviso…");
    expect(screen.getByRole("button", { name: "Publicando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Atrás" })).toBeDisabled();
    release();
    expect(await screen.findByText("Sin conexión")).toBeInTheDocument();
  });
});

describe("layout de /publicar", () => {
  it("no se indexa y renderiza a los hijos", () => {
    expect(publicarMetadata.robots).toEqual({ index: false });
    render(<PublicarLayout>hijo</PublicarLayout>);
    expect(screen.getByText("hijo")).toBeInTheDocument();
  });
});
