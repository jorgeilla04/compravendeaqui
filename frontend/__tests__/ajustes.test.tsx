import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AjustesPage from "@/app/ajustes/page";
import { AuthProvider } from "@/components/auth/auth-provider";
import type { Me } from "@/lib/types";
import { jsonResponse } from "@/test-utils/fetch";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/ajustes",
}));

const me: Me = {
  id: "6f1c1d2e-0000-4000-8000-000000000001",
  username: "juan.perez",
  display_name: "Juan Pérez",
  avatar_url: null,
  created_at: "2026-01-01T00:00:00Z",
  phone_masked: "+54 9 264 ***-3456",
  phone_verified: true,
  email: null,
  email_verified: false,
  full_name: "Juan Pérez",
  role: "user",
  whatsapp_optin: true,
  profile_pending: false,
  has_password: false,
};

function mockFetch(user: Me, onPut?: (body: unknown) => Me) {
  global.fetch = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      let json: unknown = user;
      if (init?.method === "PUT" && path.endsWith("/users/me") && onPut) {
        json = onPut(JSON.parse(String(init.body)));
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => json,
      } as unknown as Response;
    },
  ) as jest.Mock;
}

function renderPage() {
  return render(
    <AuthProvider>
      <AjustesPage />
    </AuthProvider>,
  );
}

describe("/ajustes", () => {
  it("sin contraseña previa no pide la actual", async () => {
    mockFetch(me);
    renderPage();
    expect(
      await screen.findByRole("heading", {
        level: 2,
        name: "Crear contraseña",
      }),
    ).toBeVisible();
    expect(
      screen.queryByLabelText("Contraseña actual"),
    ).not.toBeInTheDocument();
  });

  it("con contraseña pide la actual", async () => {
    mockFetch({ ...me, has_password: true });
    renderPage();
    expect(
      await screen.findByLabelText("Contraseña actual"),
    ).toBeInTheDocument();
  });

  it("apaga las consultas por WhatsApp", async () => {
    const user = userEvent.setup();
    const onPut = jest.fn((body) => ({ ...me, ...(body as Partial<Me>) }));
    mockFetch(me, onPut);
    renderPage();
    const toggle = await screen.findByRole("switch", {
      name: "Recibir consultas de compradores",
    });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.click(toggle);
    expect(
      await screen.findByText(/dejaste de recibir consultas/),
    ).toBeVisible();
    expect(onPut).toHaveBeenCalledWith({ whatsapp_optin: false });
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("el borrado exige escribir ELIMINAR", async () => {
    const user = userEvent.setup();
    mockFetch(me);
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Eliminar mi cuenta" }),
    );
    const confirm = screen.getByRole("button", {
      name: "Eliminar definitivamente",
    });
    expect(confirm).toBeDisabled();
    await user.type(
      screen.getByLabelText("Escribí ELIMINAR para confirmar"),
      "ELIMINA",
    );
    expect(confirm).toBeDisabled();
    await user.type(
      screen.getByLabelText("Escribí ELIMINAR para confirmar"),
      "R",
    );
    expect(confirm).toBeEnabled();
  });
});

describe("/ajustes — contraseña, exportación y errores", () => {
  type Route = (init?: RequestInit) => { status?: number; body?: unknown };
  let calls: { key: string; body: unknown }[] = [];

  /** Responde según "MÉTODO /ruta"; /auth/me devuelve `user`. */
  function mockRoutes(user: Me, routes: Record<string, Route> = {}) {
    calls = [];
    global.fetch = jest.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input)).pathname.replace(/^\/api\/v1/, "");
        const key = `${init?.method ?? "GET"} ${path}`;
        calls.push({
          key,
          body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
        });
        if (key === "GET /auth/me") return jsonResponse(user);
        const route = routes[key];
        const { status = 200, body = {} } = route ? route(init) : {};
        return jsonResponse(body, status);
      },
    ) as jest.Mock;
  }

  it("crea la contraseña sin pedir la actual", async () => {
    const user = userEvent.setup();
    mockRoutes(me, { "PUT /users/me/password": () => ({ status: 204 }) });
    renderPage();

    const field = await screen.findByLabelText("Contraseña nueva");
    await user.type(field, "corta");
    await user.click(
      screen.getByRole("button", { name: "Guardar contraseña" }),
    );
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/al menos 8 caracteres/)).toBeVisible();
    expect(calls.some((c) => c.key === "PUT /users/me/password")).toBe(false);

    await user.type(field, "segura1");
    await user.click(
      screen.getByRole("button", { name: "Guardar contraseña" }),
    );
    expect(
      await screen.findByText("Guardamos tu contraseña nueva."),
    ).toBeVisible();
    expect(calls.find((c) => c.key === "PUT /users/me/password")?.body).toEqual(
      { new_password: "cortasegura1" },
    );
    expect(field).toHaveValue("");
    // Ahora la cuenta tiene contraseña: pasa a "Cambiar contraseña".
    expect(
      screen.getByRole("heading", { level: 2, name: "Cambiar contraseña" }),
    ).toBeInTheDocument();
  });

  it("para cambiarla exige la actual y muestra el error del backend", async () => {
    const user = userEvent.setup();
    mockRoutes(
      { ...me, has_password: true },
      {
        "PUT /users/me/password": () => ({
          status: 400,
          body: { detail: "La contraseña actual no es correcta." },
        }),
      },
    );
    renderPage();

    await user.type(
      await screen.findByLabelText("Contraseña nueva"),
      "nuevasegura",
    );
    await user.click(
      screen.getByRole("button", { name: "Guardar contraseña" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Escribí tu contraseña actual.",
    );

    await user.type(screen.getByLabelText("Contraseña actual"), "vieja123");
    await user.click(
      screen.getByRole("button", { name: "Guardar contraseña" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La contraseña actual no es correcta.",
    );
    expect(calls.find((c) => c.key === "PUT /users/me/password")?.body).toEqual(
      { current_password: "vieja123", new_password: "nuevasegura" },
    );
  });

  it("enciende WhatsApp y muestra errores al guardar", async () => {
    const user = userEvent.setup();
    let fail = true;
    mockRoutes(
      { ...me, whatsapp_optin: false },
      {
        "PUT /users/me": () =>
          fail
            ? { status: 500, body: { detail: "No pudimos guardar." } }
            : { body: { ...me, whatsapp_optin: true } },
      },
    );
    renderPage();
    const toggle = await screen.findByRole("switch", {
      name: "Recibir consultas de compradores",
    });
    expect(screen.getByText("Desactivado")).toBeInTheDocument();
    await user.click(toggle);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos guardar.",
    );
    expect(toggle).toHaveAttribute("aria-checked", "false");

    fail = false;
    await user.click(toggle);
    expect(
      await screen.findByText(/pueden escribirte por WhatsApp/),
    ).toBeVisible();
    expect(screen.getByText("Activado")).toBeInTheDocument();
  });

  it("descarga los datos como JSON", async () => {
    const user = userEvent.setup();
    const createObjectURL = jest.fn(() => "blob:datos");
    const revokeObjectURL = jest.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    mockRoutes(me, {
      "GET /users/me/export": () => ({ body: { user: { id: me.id } } }),
    });
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: "Descargar mis datos" }),
    );
    expect(
      await screen.findByText("Descargamos tus datos en un archivo JSON."),
    ).toBeVisible();
    expect(click).toHaveBeenCalledTimes(1);
    const link = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(link.download).toMatch(
      /^mis-datos-compravendeaqui-\d{4}-\d{2}-\d{2}\.json$/,
    );
    expect(link.href).toBe("blob:datos");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:datos");
    click.mockRestore();
  });

  it("muestra el error si falla la exportación", async () => {
    const user = userEvent.setup();
    mockRoutes(me, {
      "GET /users/me/export": () => ({
        status: 429,
        body: { detail: "Probá de nuevo en un rato." },
      }),
    });
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Descargar mis datos" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Probá de nuevo en un rato.",
    );
    expect(
      screen.getByRole("button", { name: "Descargar mis datos" }),
    ).toBeEnabled();
  });

  it("si falla el borrado muestra el error; al cerrar se limpia", async () => {
    const user = userEvent.setup();
    mockRoutes(me, {
      "DELETE /users/me": () => ({
        status: 500,
        body: { detail: "No pudimos eliminar tu cuenta." },
      }),
    });
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Eliminar mi cuenta" }),
    );
    const input = screen.getByLabelText("Escribí ELIMINAR para confirmar");
    await user.type(input, " ELIMINAR ");
    await user.click(
      screen.getByRole("button", { name: "Eliminar definitivamente" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No pudimos eliminar tu cuenta.",
    );
    expect(calls.some((c) => c.key === "DELETE /users/me")).toBe(true);

    await user.click(
      screen.getByRole("button", { name: "Conservar mi cuenta" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(
      screen.getByRole("button", { name: "Eliminar mi cuenta" }),
    );
    expect(
      screen.getByLabelText("Escribí ELIMINAR para confirmar"),
    ).toHaveValue("");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
