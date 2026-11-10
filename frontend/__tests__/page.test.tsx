import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import HomePage from "@/app/page";
import type { CategoryNode, ListingPage } from "@/lib/types";
import { jsonResponse } from "@/test-utils/fetch";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const categories: CategoryNode[] = [
  {
    id: "c1",
    parent_id: null,
    name: "Vehículos",
    slug: "vehiculos",
    icon: "car",
    display_order: 0,
    children: [],
  },
];
const recent: ListingPage = {
  next_cursor: null,
  items: [
    {
      id: "l1",
      slug: "toyota-corolla-abc123",
      title: "Toyota Corolla XEI 2018",
      price: "15900",
      price_currency: "USD",
      price_usd_ref: "15900",
      condition: "usado",
      department: "Capital",
      status: "active",
      category_slug: "autos",
      url_path: "/autos/toyota-corolla-abc123",
      thumb_url: null,
      created_at: "2026-11-01T10:00:00Z",
    },
  ],
};

function mockApi(responses: Record<string, unknown>) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const key = Object.keys(responses).find((path) => url.includes(path));
    return jsonResponse(key ? responses[key] : {}, key ? 200 : 404);
  }) as jest.Mock;
}

describe("HomePage", () => {
  it("muestra la búsqueda, los rubros y los avisos recientes", async () => {
    mockApi({ "/categories": categories, "/listings": recent });
    render(await HomePage());

    expect(
      screen.getByRole("heading", { level: 1, name: /San Juan/i }),
    ).toBeInTheDocument();
    // Carrusel con la primera diapositiva visible y la llamada a publicar.
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Comprá y vendé en San Juan",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Pausar el carrusel" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Vehículos/ })).toHaveAttribute(
      "href",
      "/vehiculos",
    );
    expect(
      screen.getByRole("link", { name: "Toyota Corolla XEI 2018" }),
    ).toHaveAttribute("href", "/autos/toyota-corolla-abc123");
    expect(screen.getByText("US$ 15.900")).toBeInTheDocument();
  });

  it("invita a publicar cuando no hay avisos", async () => {
    mockApi({
      "/categories": [],
      "/listings": { items: [], next_cursor: null },
    });
    render(await HomePage());
    expect(
      screen.getByRole("link", { name: "Publicar el primero" }),
    ).toHaveAttribute("href", "/publicar");
  });
});

describe("HomeCarousel", () => {
  it("cambia de diapositiva con las flechas y los puntos, y se pausa", async () => {
    const user = userEvent.setup();
    mockApi({
      "/categories": [],
      "/listings": { items: [], next_cursor: null },
    });
    render(await HomePage());
    const activa = () =>
      screen
        .getAllByRole("group", { hidden: true })
        .find((g) => g.getAttribute("aria-hidden") === "false");

    expect(activa()).toHaveAccessibleName(/^1 de 3/);
    await user.click(
      screen.getByRole("button", { name: "Diapositiva siguiente" }),
    );
    expect(activa()).toHaveAccessibleName(/^2 de 3/);
    // Las diapositivas ocultas no se alcanzan con Tab.
    expect(screen.getAllByRole("group", { hidden: true })[0]).toHaveAttribute(
      "inert",
    );
    await user.click(screen.getByRole("button", { name: /Ver diapositiva 3/ }));
    expect(activa()).toHaveAccessibleName(/^3 de 3/);
    await user.click(
      screen.getByRole("button", { name: "Pausar el carrusel" }),
    );
    expect(
      screen.getByRole("button", { name: "Reanudar el carrusel" }),
    ).toBeInTheDocument();
  });
});
