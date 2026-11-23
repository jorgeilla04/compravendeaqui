import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CalendarioRedes } from "@/components/redes/calendario-redes";
import { mockApi } from "@/test-utils/api-mock";

let role = "admin";
jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ user: { role } }),
}));

// "Hoy" fijo: lunes 23 de noviembre de 2026 → el calendario arranca el 24.
const HOY = new Date(2026, 10, 23, 12, 0);

const programada = {
  id: "c1",
  fecha: "2026-11-24",
  orden: 1,
  publicar_at: "2026-11-24T22:00:00Z",
  titulo: "Remera · Colegio San Pablo",
  tipo: "uniforme",
  vista_previa:
    "/admin/redes/tiendas/uniformes/grupos/colegio-san-pablo/productos/remera/imagen.jpg",
  redes: ["facebook"],
  estado: "programada",
  error: null,
  publicaciones: [],
};

describe("Calendario de publicaciones", () => {
  beforeEach(() => {
    role = "admin";
  });

  it("muestra 31 días desde mañana, con lo programado y su hora", async () => {
    const calls = mockApi({
      "GET /admin/redes/calendario": () => ({
        status: 200,
        json: [programada],
      }),
      "GET /admin/redes/estado": () => ({
        status: 200,
        json: { facebook: true, instagram: false },
      }),
    });
    render(<CalendarioRedes hoy={HOY} />);
    const dia = await screen.findByRole("listitem", {
      name: "Martes, 24 de noviembre",
    });
    expect(within(dia).getByText("Remera · Colegio San Pablo")).toBeVisible();
    expect(within(dia).getByText("19:00 h")).toBeVisible();
    expect(within(dia).getByText("1/3")).toBeVisible();
    expect(calls[0].key).toBe("GET /admin/redes/calendario");
    const url = String((global.fetch as jest.Mock).mock.calls[0][0]);
    expect(url).toContain("desde=2026-11-24");
    expect(url).toContain("dias=31");
    expect(
      screen.getAllByRole("button", { name: /^Agregar producto el / }),
    ).toHaveLength(31);
  });

  it("programa una prenda de un colegio en un día", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /admin/redes/calendario": () => ({ status: 200, json: [] }),
      "GET /admin/redes/estado": () => ({
        status: 200,
        json: { facebook: true, instagram: false },
      }),
      "GET /tiendas/uniformes": () => ({
        status: 200,
        json: {
          grupos: [{ slug: "colegio-san-pablo", nombre: "Colegio San Pablo" }],
        },
      }),
      "GET /tiendas/uniformes/grupos/colegio-san-pablo": () => ({
        status: 200,
        json: {
          productos: [
            { slug: "remera", nombre: "Remera" },
            { slug: "campera", nombre: "Campera" },
          ],
        },
      }),
      "POST /admin/redes/calendario": () => ({ status: 201, json: programada }),
    });
    render(<CalendarioRedes hoy={HOY} />);
    await user.click(
      await screen.findByRole("button", {
        name: "Agregar producto el Martes, 24 de noviembre",
      }),
    );
    const form = screen.getByRole("group", {
      name: "Agregar producto el Martes, 24 de noviembre",
    });
    await user.selectOptions(
      await within(form).findByLabelText("Colegio"),
      await within(form).findByRole("option", { name: "Colegio San Pablo" }),
    );
    await within(form).findByRole("option", { name: "Campera" });
    await user.selectOptions(within(form).getByLabelText("Prenda"), "campera");
    expect(within(form).getByLabelText("Instagram")).toBeDisabled();
    await user.click(within(form).getByRole("button", { name: "Programar" }));

    const post = calls.find((c) => c.key === "POST /admin/redes/calendario");
    expect(post?.body).toEqual({
      fecha: "2026-11-24",
      redes: ["facebook"],
      tienda: "uniformes",
      grupo: "colegio-san-pablo",
      producto: "campera",
    });
  });

  it("no es para quien no es administrador", () => {
    role = "user";
    render(<CalendarioRedes hoy={HOY} />);
    expect(screen.getByText(/solo para administradores/)).toBeVisible();
  });
});
