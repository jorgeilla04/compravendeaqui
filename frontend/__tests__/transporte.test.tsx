import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Cotizador } from "@/components/transporte/cotizador";
import type { Transportista } from "@/lib/transporte/types";
import { mockApi } from "@/test-utils/api-mock";

const transportista: Transportista = {
  slug: "blanca-paloma",
  nombre: "Blanca Paloma",
  descripcion: null,
  foto_url: null,
  iva_incluido: true,
  whatsapp_url: "https://wa.me/5492644148579",
  unidades: [
    { id: "u1", nombre: "Combi", asientos: 15, foto_url: null },
    { id: "u2", nombre: "Minibús", asientos: 24, foto_url: null },
  ],
};

const SJ = {
  nombre: "San Juan",
  detalle: "Capital, San Juan",
  lat: -31.53,
  lon: -68.53,
};
const RODEO = {
  nombre: "Rodeo",
  detalle: "Iglesia, San Juan",
  lat: -30.21,
  lon: -69.14,
};

async function elegirLugar(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  texto: string,
  nombre: string,
) {
  await user.type(screen.getByRole("combobox", { name: label }), texto);
  await user.click(
    await screen.findByRole("option", { name: new RegExp(nombre) }),
  );
}

describe("Cotizador de transporte", () => {
  it("cotiza al instante, elige la unidad y deja el pedido", async () => {
    const user = userEvent.setup();
    let lugares = [SJ];
    const calls = mockApi({
      "GET /transporte/lugares": () => ({ status: 200, json: lugares }),
      "POST /transporte/blanca-paloma/cotizar": () => ({
        status: 200,
        json: {
          km: "200.0",
          km_cobrados: "400.0",
          iva_incluido: true,
          opciones: [
            {
              unidad_id: "u2",
              unidad: "Minibús",
              asientos: 24,
              foto_url: null,
              cantidad: 1,
              precio: "340000",
            },
            {
              unidad_id: "u1",
              unidad: "Combi",
              asientos: 15,
              foto_url: null,
              cantidad: 2,
              precio: "520000",
            },
          ],
        },
      }),
      "POST /transporte/blanca-paloma/pedidos": () => ({
        status: 201,
        json: {
          codigo: "T-ABC234",
          total: "520000",
          whatsapp_url: "https://wa.me/5492644148579?text=x",
        },
      }),
    });
    render(<Cotizador transportista={transportista} />);

    // Sin elegir lugares de la lista no cotiza.
    await user.click(screen.getByRole("button", { name: "Ver precios" }));
    expect(screen.getByText("Elegí el origen de la lista.")).toBeVisible();

    await elegirLugar(user, "Origen", "san juan", "San Juan");
    lugares = [RODEO];
    await elegirLugar(user, "Destino", "rodeo", "Rodeo");
    await user.type(screen.getByLabelText("Pasajeros"), "20");
    await user.click(screen.getByLabelText("Ida y vuelta"));
    await user.click(screen.getByRole("button", { name: "Ver precios" }));

    const opciones = await screen.findByRole("radiogroup");
    expect(
      screen.getByText(/200 km por ruta · 400 km ida y vuelta/),
    ).toBeVisible();
    const minibus = within(opciones).getByRole("radio", { name: /Minibús/ });
    expect(minibus).toHaveAttribute("aria-checked", "true");
    expect(within(minibus).getByText("Más conveniente")).toBeVisible();
    expect(calls.find((c) => c.key.endsWith("/cotizar"))?.body).toEqual({
      origen: { nombre: "San Juan", lat: -31.53, lon: -68.53 },
      destino: { nombre: "Rodeo", lat: -30.21, lon: -69.14 },
      pasajeros: 20,
      ida_vuelta: true,
      horas_espera: 0,
    });

    await user.click(
      within(opciones).getByRole("radio", { name: /2 × Combi/ }),
    );
    expect(
      screen.getByRole("heading", { name: /Pedir combi por \$ 520\.000/ }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Enviar pedido" }));
    expect(screen.getByText("Poné el nombre o la razón social.")).toBeVisible();

    await user.type(
      screen.getByLabelText("Empresa o razón social"),
      "Minera Andina",
    );
    await user.type(screen.getByLabelText("Nombre y apellido"), "Ana Pérez");
    await user.type(
      screen.getByLabelText("Teléfono (WhatsApp)"),
      "264 412-3456",
    );
    await user.type(screen.getByLabelText("Email"), "ana@minera.com");
    await user.click(screen.getByRole("button", { name: "Enviar pedido" }));

    expect(
      await screen.findByRole("heading", {
        name: "Recibimos tu pedido T-ABC234",
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
      "href",
      "https://wa.me/5492644148579?text=x",
    );
    expect(calls.find((c) => c.key.endsWith("/pedidos"))?.body).toMatchObject({
      unidad_id: "u1",
      empresa: "Minera Andina",
      fecha: null,
      notas: null,
    });
  });
});
