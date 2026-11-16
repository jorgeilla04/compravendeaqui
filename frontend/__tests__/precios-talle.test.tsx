import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  margen,
  PreciosTalleEditor,
} from "@/components/tiendas/admin/precios-talle-editor";
import { ProductoCard } from "@/components/tiendas/producto-card";
import { CartProvider, cartStorageKey } from "@/lib/tiendas/cart";
import type { GrupoDetalle, ProductoAdmin } from "@/lib/tiendas/types";
import { mockApi } from "@/test-utils/api-mock";

const camisa = {
  slug: "camisa",
  nombre: "Camisa",
  descripcion: null,
  tipo: "remera",
  precio: "20000.00",
  opciones: ["4", "16", "S", "XL", "XXL", "5XL"],
  foto_url: null,
  precios_talle: {
    "4": "15000.00",
    "16": "15000.00",
    S: "18000.00",
    XL: "18000.00",
    XXL: null,
    "5XL": null,
  },
  precio_desde: "15000.00",
};

const grupo: GrupoDetalle = {
  slug: "san-pablo",
  nombre: "Colegio San Pablo",
  subtitulo: null,
  categoria: null,
  color1: "#1E3A8A",
  color2: "#FFFFFF",
  logo_url: null,
  fotos: [],
  productos: [camisa],
};

describe("Precios por talle", () => {
  beforeEach(() => window.localStorage.clear());

  it("publica el más económico, cambia al elegir talle y los de consultar van a WhatsApp", async () => {
    const user = userEvent.setup();
    render(
      <CartProvider tienda="uniformes">
        <ul>
          <ProductoCard
            grupo={grupo}
            producto={camisa}
            opcionLabel="Talle"
            whatsappUrl="https://wa.me/5492644000000?text=hola"
          />
        </ul>
      </CartProvider>,
    );
    expect(screen.getByText("Desde")).toBeVisible();
    expect(screen.getByText("$ 15.000")).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Talle"), "XL");
    expect(screen.getByText("$ 18.000")).toBeVisible();
    expect(screen.queryByText("Desde")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "Agregar al carrito" }),
    );
    const carrito = JSON.parse(
      window.localStorage.getItem(cartStorageKey("uniformes")) ?? "[]",
    );
    expect(carrito[0]).toMatchObject({ opcion: "XL", precio: 18000 });

    await user.selectOptions(screen.getByLabelText("Talle"), "5XL");
    expect(screen.getByText("Consultar")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Agregar al carrito" }),
    ).toBeNull();
    const link = screen.getByRole("link", { name: /Consultar por WhatsApp/ });
    expect(decodeURIComponent(link.getAttribute("href") ?? "")).toContain(
      "Camisa talle 5XL de Colegio San Pablo",
    );
  });

  it("calcula el margen de referencia", () => {
    expect(margen("18000", "11000")).toBe("Ganás $ 7.000 (39%)");
    expect(margen("10000", "12000")).toBe("Perdés $ 2.000 (-20%)");
    expect(margen("10000", "")).toBeNull();
  });

  it("guarda tramos con talles, precio, consultar y costos", async () => {
    const user = userEvent.setup();
    const producto: ProductoAdmin = {
      slug: "camisa",
      nombre: "Camisa",
      descripcion: null,
      tipo: "remera",
      precio_base: "20000",
      opciones: ["4", "16", "S", "XL", "XXL"],
      foto_url: null,
      tramos: [],
      costo: null,
      orden: 0,
      activo: true,
    };
    const calls = mockApi({
      "PUT /admin/tiendas/uniformes/productos/camisa": (body) => ({
        status: 200,
        json: { ...producto, ...(body as object) },
      }),
    });
    render(
      <PreciosTalleEditor
        slug="uniformes"
        producto={producto}
        onSaved={jest.fn()}
      />,
    );
    await user.click(screen.getByText("Precios por talle y costos"));

    await user.click(
      screen.getByRole("button", { name: "Agregar precio por talle" }),
    );
    await user.click(screen.getByRole("button", { name: "4" }));
    await user.click(screen.getByRole("button", { name: "16" }));
    await user.type(screen.getByLabelText("Precio de venta ($)"), "15000");
    await user.type(screen.getByLabelText("Costo ($, solo para vos)"), "9000");
    expect(screen.getByText("Ganás $ 6.000 (40%)")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Agregar precio por talle" }),
    );
    // El 4 ya está en otro precio.
    expect(screen.getAllByRole("button", { name: "4" })[1]).toBeDisabled();
    await user.click(screen.getAllByRole("button", { name: "XXL" })[1]);
    await user.click(screen.getAllByLabelText("Consultar")[1]);
    await user.type(
      screen.getByLabelText("Costo del precio base ($, solo para vos)"),
      "12000",
    );
    await user.click(screen.getByRole("button", { name: "Guardar precios" }));

    expect(
      await screen.findByText("Guardamos los precios por talle."),
    ).toBeVisible();
    expect(calls[0].body).toEqual({
      tramos: [
        { talles: ["4", "16"], precio: "15000", costo: "9000" },
        { talles: ["XXL"], precio: null, costo: null },
      ],
      costo: "12000",
    });
  });
});
