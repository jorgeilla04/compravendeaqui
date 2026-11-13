import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  ConsultarPaquete,
  ReservarPaquete,
} from "@/components/transporte/paquete-acciones";
import type { Paquete } from "@/lib/transporte/types";
import { mockApi } from "@/test-utils/api-mock";

const paquete: Paquete = {
  slug: "mar-del-plata",
  titulo: "Mar del Plata",
  resumen: "10 días frente al mar.",
  foto_url: null,
  dias: 10,
  noches: 7,
  precio_desde: "700000",
  descripcion: null,
  incluye: ["Transporte"],
  sena_pct: 30,
  whatsapp_url: "https://wa.me/5492644148579",
  salidas: [
    {
      id: "s1",
      nombre: "Enero 2027",
      fecha: null,
      precio_persona: "700000",
      disponibles: 3,
    },
    {
      id: "s2",
      nombre: "Febrero 2027",
      fecha: null,
      precio_persona: "650000",
      disponibles: 0,
    },
  ],
};

describe("Paquetes", () => {
  it("reserva con seña sin pasarse de los lugares que quedan", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "POST /transporte/blanca-paloma/paquetes/mar-del-plata/reservas": () => ({
        status: 201,
        json: {
          codigo: "R-ABC234",
          total: "2100000",
          sena: "630000",
          sena_pct: 30,
          datos_transferencia: "Alias: BP.VIAJES",
          whatsapp_url: "https://wa.me/5492644148579?text=r",
        },
      }),
    });
    render(<ReservarPaquete transportista="blanca-paloma" paquete={paquete} />);

    const salidas = screen.getByRole("radiogroup", { name: "Salida" });
    expect(
      within(salidas).getByRole("radio", { name: /Febrero/ }),
    ).toBeDisabled();
    expect(within(salidas).getByText("¡Quedan 3 lugares!")).toBeVisible();

    // 2 por defecto; hasta 3 (los que quedan).
    await user.click(screen.getByRole("button", { name: "Un pasajero más" }));
    expect(
      screen.getByRole("button", { name: "Un pasajero más" }),
    ).toBeDisabled();
    expect(screen.getByText("$ 2.100.000")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /Reservar con \$ 630\.000/ }),
    );
    expect(screen.getByText("Poné tu nombre.")).toBeVisible();
    expect(calls).toHaveLength(0);

    await user.type(screen.getByLabelText("Nombre y apellido"), "Laura Gómez");
    await user.type(
      screen.getByLabelText("Teléfono (WhatsApp)"),
      "264 555-1234",
    );
    await user.type(screen.getByLabelText("Email"), "laura@gmail.com");
    await user.click(screen.getByRole("button", { name: /Reservar con/ }));

    expect(
      await screen.findByRole("heading", { name: "Reservaste: R-ABC234" }),
    ).toBeVisible();
    expect(screen.getByText("Alias: BP.VIAJES")).toBeVisible();
    expect(calls[0].body).toMatchObject({
      salida_id: "s1",
      pasajeros: 3,
      dni: null,
    });
  });

  it("deja una consulta", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "POST /transporte/blanca-paloma/consultas": () => ({
        status: 201,
        json: { whatsapp_url: "x" },
      }),
    });
    render(
      <ConsultarPaquete
        transportista="blanca-paloma"
        paquete="mar-del-plata"
        whatsappUrl="https://wa.me/1"
      />,
    );
    await user.type(screen.getByLabelText("Nombre"), "Pedro");
    await user.type(screen.getByLabelText("Teléfono (WhatsApp)"), "2645551234");
    await user.click(
      screen.getByRole("button", { name: "Quiero que me contacten" }),
    );
    expect(
      await screen.findByText("Listo, te contactamos a la brevedad."),
    ).toBeVisible();
    expect(calls[0].body).toEqual({
      paquete: "mar-del-plata",
      nombre: "Pedro",
      telefono: "2645551234",
      mensaje: null,
    });
  });
});
