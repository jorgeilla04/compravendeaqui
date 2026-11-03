import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SearchResults } from "@/components/search/search-results";
import { jsonResponse } from "@/test-utils/fetch";

import { card, categories } from "./fixtures";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => push.mockReset());

describe("SearchResults", () => {
  it("muestra chips de filtros activos con links para quitarlos", () => {
    render(
      <SearchResults
        basePath="/buscar"
        filters={{
          q: "toyota",
          category: "autos",
          department: "Rawson",
          condition: "usado",
          currency: "USD",
          price_min: "1000",
          price_max: "20000",
        }}
        initial={{ items: [card()], next_cursor: null }}
        categories={categories}
      />,
    );
    const chips = screen.getByRole("list", { name: "Filtros activos" });
    expect(within(chips).getByRole("link", { name: /Autos/ })).toHaveAttribute(
      "href",
      "/buscar?q=toyota&department=Rawson&condition=usado&currency=USD&price_min=1000&price_max=20000",
    );
    expect(
      within(chips).getByRole("link", { name: /Rawson/ }),
    ).toBeInTheDocument();
    expect(
      within(chips).getByRole("link", { name: /Usado/ }),
    ).toBeInTheDocument();
    expect(
      within(chips).getByRole("link", { name: /En dólares/ }),
    ).toBeInTheDocument();
    expect(
      within(chips).getByRole("link", { name: /US\$ 1\.000 a US\$ 20\.000/ }),
    ).toBeInTheDocument();
    expect(
      within(chips).getByRole("link", { name: "Limpiar filtros" }),
    ).toHaveAttribute("href", "/buscar?q=toyota");
  });

  it("aplica filtros desde el formulario y cambia el orden", async () => {
    render(
      <SearchResults
        basePath="/buscar"
        filters={{}}
        initial={{ items: [card()], next_cursor: null }}
        categories={categories}
      />,
    );
    const form = screen.getAllByRole("form", { name: "Filtros" })[0];
    await userEvent.selectOptions(
      within(form).getByLabelText("Departamento"),
      "Pocito",
    );
    await userEvent.selectOptions(
      within(form).getByLabelText("Categoría"),
      "autos",
    );
    await userEvent.type(within(form).getByLabelText("Hasta"), "50.000");
    await userEvent.click(
      within(form).getByRole("button", { name: "Ver resultados" }),
    );
    expect(push).toHaveBeenLastCalledWith(
      "/buscar?category=autos&department=Pocito&price_max=50000",
    );

    await userEvent.selectOptions(
      screen.getByLabelText("Ordenar"),
      "price_asc",
    );
    expect(push).toHaveBeenLastCalledWith("/buscar?sort=price_asc");
    // Sin texto de búsqueda no se ofrece "Más relevantes".
    expect(
      screen.queryByRole("option", { name: "Más relevantes" }),
    ).not.toBeInTheDocument();
  });

  it("en páginas de categoría no muestra ni manda el filtro de categoría", async () => {
    render(
      <SearchResults
        basePath="/vehiculos"
        filters={{ category: "vehiculos", department: "Capital" }}
        initial={{ items: [card()], next_cursor: null }}
        categories={categories}
        lockCategory
      />,
    );
    expect(screen.queryByLabelText("Categoría")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Capital.*Quitar/ }),
    ).toHaveAttribute("href", "/vehiculos");
    await userEvent.click(
      screen.getAllByRole("button", { name: "Ver resultados" })[0],
    );
    expect(push).toHaveBeenLastCalledWith("/vehiculos?department=Capital");
  });

  it("carga más resultados con el cursor y muestra errores", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          items: [card({ id: "l2", title: "Ford Ka 2015" })],
          next_cursor: "c2",
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ detail: "Cursor inválido" }, 400));
    render(
      <SearchResults
        basePath="/buscar"
        filters={{ q: "auto" }}
        initial={{ items: [card()], next_cursor: "c1" }}
        categories={categories}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Cargar más avisos" }),
    );
    expect(
      await screen.findByRole("link", { name: "Ford Ka 2015" }),
    ).toBeInTheDocument();
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain(
      "/api/v1/search?q=auto&sort=relevance&cursor=c1",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Cargar más avisos" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Cursor inválido",
    );
  });

  it("estado vacío distingue búsqueda con filtros", () => {
    render(
      <SearchResults
        basePath="/buscar"
        filters={{ q: "nada", department: "Zonda" }}
        initial={{ items: [], next_cursor: null }}
        categories={categories}
      />,
    );
    expect(
      screen.getByRole("heading", {
        name: "No encontramos avisos para “nada”",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/sacando algún filtro/)).toBeInTheDocument();
  });

  it("abre el drawer de filtros en mobile con el contador", async () => {
    render(
      <SearchResults
        basePath="/buscar"
        filters={{ department: "Ullum" }}
        initial={{ items: [], next_cursor: null }}
        categories={categories}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Filtros (1)" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Filtros" }),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Ver resultados" }),
    );
    expect(push).toHaveBeenLastCalledWith("/buscar?department=Ullum");
  });
});
