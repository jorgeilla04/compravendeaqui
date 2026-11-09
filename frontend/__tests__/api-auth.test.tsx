import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { api, ApiError, errorMessage, serverGet } from "@/lib/api";
import { jsonResponse } from "@/test-utils/fetch";

const replace = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/mis-avisos",
}));

describe("cliente de API", () => {
  it("si el access token venció, rota el refresh y reintenta una vez", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ detail: "Tenés que ingresar" }, 401),
      )
      .mockResolvedValueOnce(jsonResponse({}, 200))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    await expect(api<{ ok: boolean }>("/auth/me")).resolves.toEqual({
      ok: true,
    });
    const urls = (global.fetch as jest.Mock).mock.calls.map((c) =>
      String(c[0]),
    );
    expect(urls[1]).toContain("/auth/refresh");
  });

  it("convierte errores de validación en mensajes en español", async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse(
        { detail: [{ msg: "Value error, Departamento de San Juan inválido" }] },
        422,
      ),
    ) as jest.Mock;
    const error = await api("/listings", {
      method: "POST",
      body: { a: 1 },
      noRefresh: true,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("Departamento de San Juan inválido");
    expect(errorMessage(new Error("x"))).toMatch(/conexión/);
  });

  it("serverGet devuelve null en 404 y lanza en 5xx", async () => {
    global.fetch = jest.fn(async () => jsonResponse({}, 404)) as jest.Mock;
    await expect(serverGet("/listings/x")).resolves.toBeNull();
    global.fetch = jest.fn(async () =>
      jsonResponse({ detail: "caído" }, 503, { "Retry-After": "5" }),
    ) as jest.Mock;
    await expect(
      serverGet("/listings/x", undefined, false),
    ).rejects.toMatchObject({ status: 503, retryAfter: 5 });
  });

  it("204 devuelve undefined y FormData no fuerza Content-Type", async () => {
    global.fetch = jest.fn(async () => jsonResponse(null, 204)) as jest.Mock;
    const form = new FormData();
    await expect(
      api("/x", { method: "POST", body: form }),
    ).resolves.toBeUndefined();
    expect(
      (global.fetch as jest.Mock).mock.calls[0][1].headers,
    ).toBeUndefined();
  });
});

function WhoAmI() {
  const { user, logout } = useAuth();
  return (
    <div>
      <p>{user ? user.display_name : "anónimo"}</p>
      <button onClick={() => void logout()}>salir</button>
    </div>
  );
}

describe("sesión", () => {
  beforeEach(() => replace.mockReset());

  it("AuthProvider carga /auth/me y logout limpia la sesión", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ display_name: "Ana" }))
      .mockResolvedValueOnce(jsonResponse(null, 204));
    render(
      <AuthProvider>
        <WhoAmI />
      </AuthProvider>,
    );
    expect(await screen.findByText("Ana")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "salir" }));
    expect(await screen.findByText("anónimo")).toBeInTheDocument();
  });

  it("RequireAuth manda a ingresar con la ruta de vuelta", async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ detail: "no" }, 401),
    ) as jest.Mock;
    render(
      <AuthProvider>
        <RequireAuth>
          <p>privado</p>
        </RequireAuth>
      </AuthProvider>,
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/ingresar?next=%2Fmis-avisos"),
    );
    expect(screen.queryByText("privado")).not.toBeInTheDocument();
  });

  it("RequireAuth muestra el contenido con perfil completo", async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ display_name: "Ana", profile_pending: false }),
    ) as jest.Mock;
    render(
      <AuthProvider>
        <RequireAuth>
          <p>privado</p>
        </RequireAuth>
      </AuthProvider>,
    );
    expect(await screen.findByText("privado")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("useAuth fuera del provider avisa del error", () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<WhoAmI />)).toThrow(/AuthProvider/);
  });
});

describe("buildUrl", () => {
  it("rechaza rutas que intentan salir del endpoint", () => {
    const { buildUrl } = jest.requireActual("@/lib/api");
    expect(() => buildUrl("/tiendas/pedidos/../../users/me")).toThrow(
      "Dirección inválida",
    );
    expect(() => buildUrl("/tiendas/pedidos/%2e%2E/admin")).toThrow();
    expect(() => buildUrl("/tiendas//x")).toThrow();
    expect(buildUrl("/tiendas/pedidos/abc", { payment_id: "1" })).toMatch(
      /\/api\/v1\/tiendas\/pedidos\/abc\?payment_id=1$/,
    );
  });
});
