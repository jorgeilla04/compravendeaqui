import { render, screen } from "@testing-library/react";

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
    expect(screen.getByRole("search")).toBeInTheDocument();
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
