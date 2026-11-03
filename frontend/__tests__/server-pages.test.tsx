import { render, screen } from "@testing-library/react";

import CategoryPage, {
  generateMetadata as categoryMeta,
} from "@/app/[categoria]/page";
import ListingPage, {
  generateMetadata as listingMeta,
} from "@/app/[categoria]/[slug]/page";
import SearchPage, { generateMetadata as searchMeta } from "@/app/buscar/page";
import ErrorPage from "@/app/error";
import NotFound from "@/app/not-found";
import PrivacyPage from "@/app/privacidad/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import TermsPage from "@/app/terminos/page";
import { jsonResponse } from "@/test-utils/fetch";

import { card, categories, listing } from "./fixtures";

const notFound = jest.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const permanentRedirect = jest.fn((url: string) => {
  throw new Error(`REDIRECT ${url}`);
});
jest.mock("next/navigation", () => ({
  notFound: () => notFound(),
  permanentRedirect: (url: string) => permanentRedirect(url),
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

const autosDetail = {
  ...categories[0].children[0],
  children: [],
  path: [categories[0], categories[0].children[0]],
};
const vehiculosDetail = {
  ...categories[0],
  children: categories[0].children,
  path: [categories[0]],
};

function mockApi(routes: Record<string, unknown>) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const key = Object.keys(routes)
      .sort((a, b) => b.length - a.length)
      .find((path) => url.includes(path));
    return key
      ? jsonResponse(routes[key])
      : jsonResponse({ detail: "no" }, 404);
  }) as jest.Mock;
}

describe("detalle de aviso", () => {
  beforeEach(() =>
    mockApi({
      "/listings/toyota-corolla-abc123": listing(),
      "/categories/autos": autosDetail,
    }),
  );

  it("renderiza precio, vendedor, CTA y JSON-LD Product/Offer sin el teléfono", async () => {
    const { container } = render(
      await ListingPage({
        params: { categoria: "autos", slug: "toyota-corolla-abc123" },
      }),
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Toyota Corolla XEI 2018",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/US\$ 15\.900/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Contactar por WhatsApp" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver sus otros avisos" }),
    ).toHaveAttribute("href", "/u/u1");
    expect(screen.getByRole("link", { name: "Vehículos" })).toHaveAttribute(
      "href",
      "/vehiculos",
    );

    const ld = JSON.parse(
      container.querySelector('script[type="application/ld+json"]')!.innerHTML,
    );
    expect(ld[0]["@type"]).toBe("Product");
    expect(ld[0].offers).toMatchObject({
      priceCurrency: "USD",
      price: "15900",
      itemCondition: "https://schema.org/UsedCondition",
    });
    expect(ld[1]["@type"]).toBe("BreadcrumbList");
    expect(container.innerHTML).not.toMatch(/549\d{6,}/);
  });

  it("metadata con Open Graph y canonical", async () => {
    const meta = await listingMeta({
      params: { categoria: "autos", slug: "toyota-corolla-abc123" },
    });
    expect(meta.title).toBe("Toyota Corolla XEI 2018 — US$ 15.900");
    expect(meta.alternates?.canonical).toBe("/autos/toyota-corolla-abc123");
    expect(JSON.stringify(meta.openGraph)).toContain(
      "http://localhost:9000/a.webp",
    );
  });

  it("redirige a la URL canónica si cambió la categoría", async () => {
    await expect(
      ListingPage({
        params: { categoria: "motos", slug: "toyota-corolla-abc123" },
      }),
    ).rejects.toThrow("REDIRECT /autos/toyota-corolla-abc123");
  });

  it("404 si no existe o el slug es inválido", async () => {
    await expect(
      ListingPage({ params: { categoria: "autos", slug: "no-existe" } }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(
      ListingPage({ params: { categoria: "autos", slug: "../../x" } }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(
      (await listingMeta({ params: { categoria: "autos", slug: "no-existe" } }))
        .title,
    ).toBe("Aviso no disponible");
  });
});

describe("categoría y búsqueda", () => {
  beforeEach(() =>
    mockApi({
      "/categories/vehiculos": vehiculosDetail,
      "/categories": categories,
      "/listings": { items: [card()], next_cursor: null },
      "/search": {
        items: [card({ id: "l9", title: "Toyota Hilux" })],
        next_cursor: null,
      },
    }),
  );

  it("página de categoría con subcategorías, breadcrumbs y resultados", async () => {
    render(
      await CategoryPage({
        params: { categoria: "vehiculos" },
        searchParams: {},
      }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Vehículos en San Juan" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Subcategorías" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Toyota Corolla XEI 2018" }),
    ).toBeInTheDocument();
    const meta = await categoryMeta({
      params: { categoria: "vehiculos" },
      searchParams: { department: "Rawson" },
    });
    expect(meta.title).toBe("Vehículos en San Juan");
    expect(meta.robots).toEqual({ index: false, follow: true });
    await expect(
      CategoryPage({ params: { categoria: "NO VALIDA" }, searchParams: {} }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("búsqueda con texto usa /search y no se indexa", async () => {
    render(await SearchPage({ searchParams: { q: "toyota" } }));
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Resultados para “toyota”",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Toyota Hilux" }),
    ).toBeInTheDocument();
    expect(searchMeta({ searchParams: { q: "toyota" } })).toMatchObject({
      title: "toyota en San Juan",
      robots: { index: false },
    });
    expect(searchMeta({ searchParams: {} }).title).toBe(
      "Buscar avisos en San Juan",
    );
  });

  it("si la API falla muestra un mensaje en vez de romper", async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ detail: "caído" }, 500),
    ) as jest.Mock;
    render(await SearchPage({ searchParams: {} }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar los resultados",
    );
  });
});

describe("SEO y páginas estáticas", () => {
  it("sitemap incluye categorías y avisos; robots excluye áreas privadas", async () => {
    mockApi({
      "/seo/sitemap": [
        { path: "/autos", updated_at: null },
        { path: "/autos/corolla-x", updated_at: "2026-11-01T00:00:00Z" },
      ],
    });
    const entries = await sitemap();
    expect(entries.map((e) => e.url)).toEqual(
      expect.arrayContaining([
        "http://localhost:3000/autos",
        "http://localhost:3000/autos/corolla-x",
      ]),
    );
    expect(entries.find((e) => e.url.endsWith("corolla-x"))?.priority).toBe(
      0.7,
    );
    const rules = robots();
    expect(JSON.stringify(rules)).toContain("/mis-avisos");
    expect(rules.sitemap).toBe("http://localhost:3000/sitemap.xml");
  });

  it("términos, privacidad, 404 y error", () => {
    render(<TermsPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Términos y condiciones" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ley 24\.240/, { selector: "li" }),
    ).toBeInTheDocument();
    render(<PrivacyPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Política de privacidad" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/25\.326/).length).toBeGreaterThan(0);
    render(<NotFound />);
    expect(
      screen.getByRole("heading", { name: "No encontramos esta página" }),
    ).toBeInTheDocument();
    const reset = jest.fn();
    render(<ErrorPage error={new Error("x")} reset={reset} />);
    screen.getByRole("button", { name: "Reintentar" }).click();
    expect(reset).toHaveBeenCalled();
  });
});
