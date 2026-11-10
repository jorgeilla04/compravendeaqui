import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GuiaTallesEditor } from "@/components/tiendas/admin/guia-talles-editor";
import { GuiaTalles } from "@/components/tiendas/guia-talles";
import type { Medidas, ProductoAdmin } from "@/lib/tiendas/types";
import { mockApi } from "@/test-utils/api-mock";

const medidas: Medidas = {
  columnas: ["Largo total", "Ancho de pecho (axila a axila)"],
  filas: [
    { talle: "4", valores: [44, 33] },
    { talle: "6", valores: [47, null] },
  ],
  aproximadas: true,
};

const remera: ProductoAdmin = {
  slug: "remera",
  nombre: "Remera / chomba",
  descripcion: null,
  tipo: "remera",
  precio_base: "10000",
  opciones: ["4", "6"],
  foto_url: null,
  medidas: null,
  orden: 0,
  activo: true,
};

describe("GuiaTalles", () => {
  it("muestra las medidas en cm y resalta el talle elegido", async () => {
    const user = userEvent.setup();
    render(<GuiaTalles prenda="Remera" medidas={medidas} seleccionado="6" />);

    await user.click(screen.getByRole("button", { name: "Guía de talles" }));
    const dialog = screen.getByRole("dialog", {
      name: "Guía de talles: Remera",
    });
    expect(within(dialog).getByText(/Medidas aproximadas/)).toBeVisible();
    const fila6 = within(dialog).getByRole("row", { name: /^6/ });
    expect(fila6).toHaveAttribute("aria-current", "true");
    // Sin medida se muestra un guion, no un cero.
    expect(within(fila6).getByText("—")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("columnheader", { name: "Largo total" }),
    ).toBeInTheDocument();
  });
});

describe("GuiaTallesEditor", () => {
  it("arma la guía con los talles, valida y guarda medidas propias", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "PUT /admin/tiendas/uniformes/productos/remera": (body) => ({
        status: 200,
        json: { ...remera, ...(body as object) },
      }),
    });
    const onSaved = jest.fn();
    render(
      <GuiaTallesEditor slug="uniformes" producto={remera} onSaved={onSaved} />,
    );

    await user.click(screen.getByText("Guía de talles (medidas en cm)"));
    await user.click(
      screen.getByRole("button", { name: "Armar guía de talles" }),
    );
    await user.type(
      screen.getByLabelText("Largo total, talle 4, en cm"),
      "45,5",
    );
    await user.type(
      screen.getByLabelText("Ancho de pecho (axila a axila), talle 6, en cm"),
      "500",
    );
    await user.click(screen.getByRole("button", { name: "Guardar medidas" }));
    expect(screen.getByText(/Revisá las medidas del talle 6/)).toBeVisible();
    expect(calls).toHaveLength(0);

    await user.clear(
      screen.getByLabelText("Ancho de pecho (axila a axila), talle 6, en cm"),
    );
    await user.type(
      screen.getByLabelText("Ancho de pecho (axila a axila), talle 6, en cm"),
      "36",
    );
    await user.click(screen.getByRole("button", { name: "Guardar medidas" }));
    expect(await screen.findByText("Guardamos las medidas.")).toBeVisible();
    expect(calls[0].body).toEqual({
      medidas: {
        columnas: ["Largo total", "Ancho de pecho (axila a axila)"],
        filas: [
          { talle: "4", valores: [45.5, null] },
          { talle: "6", valores: [null, 36] },
        ],
        aproximadas: false,
      },
    });
    expect(onSaved).toHaveBeenCalled();
  });
});
