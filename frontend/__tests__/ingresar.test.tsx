import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AuthProvider } from "@/components/auth/auth-provider";
import { validateProfile } from "@/components/auth/login/profile-step";
import { safeNext } from "@/components/auth/login/safe-next";
import { LoginFlow } from "@/components/auth/login/login-flow";
import type { Me } from "@/lib/types";
import { type Handler, mockApi } from "@/test-utils/api-mock";

const replace = jest.fn();
let search = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace,
    push: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => search,
  usePathname: () => "/ingresar",
}));

const unauthenticated: Record<string, Handler> = {
  "GET /auth/me": () => ({ status: 401, json: { detail: "No autenticado" } }),
  "POST /auth/refresh": () => ({
    status: 401,
    json: { detail: "Sesión vencida" },
  }),
};

function makeUser(overrides: Partial<Me> = {}): Me {
  return {
    id: "6f1c1d2e-0000-4000-8000-000000000001",
    username: "usuario0000001",
    display_name: "Usuario",
    avatar_url: null,
    created_at: "2026-01-01T00:00:00Z",
    phone_masked: "+54 9 264 ***-3456",
    phone_verified: true,
    email: null,
    email_verified: false,
    full_name: null,
    role: "user",
    whatsapp_optin: true,
    profile_pending: false,
    has_password: false,
    ...overrides,
  };
}

const otpResponse = {
  destination: "+54 9 264 ***-3456",
  channel: "whatsapp",
  expires_in: 300,
  resend_in: 30,
};

/** Estos tests recorren el ingreso por celular (WhatsApp); el de email está en ingresar-email. */
function renderPage() {
  return render(
    <AuthProvider>
      <LoginFlow method="phone" />
    </AuthProvider>,
  );
}

beforeEach(() => {
  replace.mockReset();
  search = new URLSearchParams();
});

describe("safeNext", () => {
  it.each([
    [null, "/"],
    ["", "/"],
    ["/publicar", "/publicar"],
    ["/perfil?tab=1#x", "/perfil?tab=1#x"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["https://evil.com", "/"],
    ["javascript:alert(1)", "/"],
    ["publicar", "/"],
    ["/\t/evil.com", "/"],
    ["/ingresar", "/"],
    ["/ingresar?next=/x", "/"],
  ])("safeNext(%p) → %p", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });
});

describe("validateProfile", () => {
  const ok = {
    username: "juan.perez",
    full_name: "Juan Pérez",
    email: "",
    phone: "",
    password: "",
    accept_terms: true,
    whatsapp_optin: true,
  };
  it("acepta un perfil válido con email y contraseña vacíos", () => {
    expect(validateProfile(ok)).toEqual({});
  });
  it("rechaza usuario inválido, contraseña corta y términos sin aceptar", () => {
    const errors = validateProfile({
      ...ok,
      username: "Ju",
      password: "123",
      accept_terms: false,
      email: "no-es-email",
    });
    expect(Object.keys(errors).sort()).toEqual([
      "accept_terms",
      "email",
      "password",
      "username",
    ]);
  });
});

describe("/ingresar", () => {
  it("recorre celular → código → perfil y redirige a next", async () => {
    const user = userEvent.setup();
    search = new URLSearchParams({ next: "/publicar" });
    const pending = makeUser({ profile_pending: true });
    const calls = mockApi({
      ...unauthenticated,
      "POST /auth/otp/request": () => ({ status: 200, json: otpResponse }),
      "POST /auth/otp/verify": () => ({
        status: 200,
        json: {
          user: pending,
          is_new_user: true,
          access_token: "t",
          expires_in: 900,
        },
      }),
      "POST /auth/register": (body) => ({
        status: 200,
        json: makeUser({ ...(body as Partial<Me>), profile_pending: false }),
      }),
    });

    renderPage();

    await user.type(await screen.findByLabelText("Tu celular"), "264 412-3456");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Ingresá el código",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/Te enviamos un código por WhatsApp a/),
    ).toBeInTheDocument();
    expect(screen.getByText("+54 9 264 ***-3456")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Reenviar código en 30 s/ }),
    ).toBeDisabled();

    await user.type(screen.getByLabelText("Código de 6 números"), "123456");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Completá tu perfil",
      }),
    ).toBeVisible();
    expect(calls.find((c) => c.key === "POST /auth/otp/verify")?.body).toEqual({
      phone: "264 412-3456",
      code: "123456",
    });
    // WhatsApp opt-in viene marcado por defecto.
    expect(screen.getByLabelText(/Quiero recibir consultas/)).toBeChecked();

    // Sin aceptar términos no se envía.
    await user.type(screen.getByLabelText("Nombre de usuario"), "Juan.Perez");
    await user.type(screen.getByLabelText("Nombre y apellido"), "Juan Pérez");
    await user.click(screen.getByRole("button", { name: "Crear mi cuenta" }));
    expect(
      await screen.findByText(/tenés que aceptar los Términos/),
    ).toBeInTheDocument();
    expect(calls.some((c) => c.key === "POST /auth/register")).toBe(false);

    await user.click(screen.getByLabelText(/Acepto los/));
    await user.click(screen.getByRole("button", { name: "Crear mi cuenta" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/publicar"));
    expect(calls.find((c) => c.key === "POST /auth/register")?.body).toEqual({
      username: "juan.perez",
      full_name: "Juan Pérez",
      email: null,
      password: null,
      accept_terms: true,
      whatsapp_optin: true,
    });
  });

  it("muestra el error del servidor con los intentos restantes", async () => {
    const user = userEvent.setup();
    mockApi({
      ...unauthenticated,
      "POST /auth/otp/request": () => ({
        status: 200,
        json: { ...otpResponse, channel: "sms" },
      }),
      "POST /auth/otp/verify": () => ({
        status: 400,
        json: {
          detail: "El código es incorrecto o venció. Te quedan 4 intentos.",
        },
      }),
    });
    renderPage();

    await user.type(await screen.findByLabelText("Tu celular"), "2644123456");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(
      await screen.findByText(/Te enviamos un código por SMS a/),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Código de 6 números"), "000000");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(
      await screen.findByText(
        "El código es incorrecto o venció. Te quedan 4 intentos.",
      ),
    ).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });

  it("muestra el 503 cuando no se pudo enviar el código", async () => {
    const user = userEvent.setup();
    mockApi({
      ...unauthenticated,
      "POST /auth/otp/request": () => ({
        status: 503,
        json: {
          detail:
            "No pudimos enviarte el código. Probá de nuevo en unos minutos.",
        },
      }),
    });
    renderPage();
    await user.type(await screen.findByLabelText("Tu celular"), "2644123456");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(
      await screen.findByText(/No pudimos enviarte el código/),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Enviar código" })).toBeEnabled();
  });

  it("muestra el mensaje de validación 422 del celular", async () => {
    const user = userEvent.setup();
    mockApi({
      ...unauthenticated,
      "POST /auth/otp/request": () => ({
        status: 422,
        json: {
          detail: [
            { msg: "Value error, El número no es un celular argentino válido" },
          ],
        },
      }),
    });
    renderPage();
    await user.type(await screen.findByLabelText("Tu celular"), "1234567");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(
      await screen.findByText("El número no es un celular argentino válido"),
    ).toBeVisible();
  });

  it("permite ingresar con contraseña e ignora un next externo", async () => {
    const user = userEvent.setup();
    search = new URLSearchParams({ next: "//evil.com" });
    const calls = mockApi({
      ...unauthenticated,
      "POST /auth/login": () => ({
        status: 200,
        json: {
          user: makeUser(),
          is_new_user: false,
          access_token: "t",
          expires_in: 900,
        },
      }),
    });
    renderPage();
    await user.click(
      await screen.findByRole("button", { name: "Ingresar con contraseña" }),
    );
    await user.type(screen.getByLabelText("Tu celular"), "2644123456");
    await user.type(screen.getByLabelText("Contraseña"), "secreta123");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(calls.find((c) => c.key === "POST /auth/login")?.body).toEqual({
      phone: "2644123456",
      password: "secreta123",
    });
  });

  it("con sesión y perfil completo redirige directo a next", async () => {
    search = new URLSearchParams({ next: "/mis-avisos" });
    mockApi({ "GET /auth/me": () => ({ status: 200, json: makeUser() }) });
    renderPage();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/mis-avisos"));
  });

  it("con sesión y perfil pendiente va directo a completar perfil", async () => {
    mockApi({
      "GET /auth/me": () => ({
        status: 200,
        json: makeUser({ profile_pending: true }),
      }),
    });
    renderPage();
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Completá tu perfil",
      }),
    ).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("/ingresar — pasos y errores", () => {
  async function goToCode(
    user: ReturnType<typeof userEvent.setup>,
    routes: Record<string, Handler>,
    otp = { ...otpResponse, resend_in: 0 },
  ) {
    const calls = mockApi({
      ...unauthenticated,
      "POST /auth/otp/request": () => ({ status: 200, json: otp }),
      ...routes,
    });
    renderPage();
    await user.type(await screen.findByLabelText("Tu celular"), "2644123456");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    await screen.findByRole("heading", { level: 1, name: "Ingresá el código" });
    return calls;
  }

  it("valida el celular antes de pedir el código", async () => {
    const user = userEvent.setup();
    const calls = mockApi(unauthenticated);
    renderPage();
    await user.type(await screen.findByLabelText("Tu celular"), "264");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(screen.getByLabelText("Tu celular")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText(/con característica/)).toBeVisible();
    expect(calls.some((c) => c.key === "POST /auth/otp/request")).toBe(false);
  });

  it("valida que el código tenga 6 números y filtra letras", async () => {
    const user = userEvent.setup();
    const calls = await goToCode(user, {});
    const code = screen.getByLabelText("Código de 6 números");
    expect(code).toHaveFocus();
    expect(screen.getByText("Vence en 5 minutos.")).toBeInTheDocument();
    await user.type(code, "12ab3");
    expect(code).toHaveValue("123");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(screen.getByText("El código tiene 6 números.")).toBeVisible();
    expect(calls.some((c) => c.key === "POST /auth/otp/verify")).toBe(false);
  });

  it("reenvía el código y reinicia la cuenta regresiva", async () => {
    const user = userEvent.setup();
    let requests = 0;
    const calls = await goToCode(user, {
      "POST /auth/otp/request": () => {
        requests += 1;
        return {
          status: 200,
          json:
            requests === 1
              ? { ...otpResponse, resend_in: 0, expires_in: 60 }
              : { ...otpResponse, channel: "sms", resend_in: 45 },
        };
      },
    });
    expect(screen.getByText("Vence en 1 minuto.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reenviar código" }));

    expect(
      await screen.findByText("Te mandamos un código nuevo por SMS."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Reenviar código en 45 s/ }),
    ).toBeDisabled();
    expect(screen.getByText(/Te enviamos un código por SMS a/)).toBeVisible();
    expect(
      calls.filter((c) => c.key === "POST /auth/otp/request").at(-1)?.body,
    ).toEqual({ phone: "2644123456" });
  });

  it("si el reenvío está limitado usa Retry-After para la espera", async () => {
    const user = userEvent.setup();
    let requests = 0;
    await goToCode(user, {
      "POST /auth/otp/request": () => {
        requests += 1;
        return requests === 1
          ? { status: 200, json: { ...otpResponse, resend_in: 0 } }
          : {
              status: 429,
              json: { detail: "Esperá un momento antes de pedir otro." },
              headers: { "Retry-After": "60" },
            };
      },
    });
    await user.click(screen.getByRole("button", { name: "Reenviar código" }));
    expect(
      await screen.findByText("Esperá un momento antes de pedir otro."),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Reenviar código en 60 s/ }),
    ).toBeDisabled();
  });

  it("la cuenta regresiva baja cada segundo", async () => {
    jest.useFakeTimers();
    try {
      const user = userEvent.setup({
        advanceTimers: jest.advanceTimersByTime,
      });
      await goToCode(user, {}, { ...otpResponse, resend_in: 2 });
      expect(
        screen.getByRole("button", { name: /Reenviar código en 2 s/ }),
      ).toBeDisabled();
      for (const left of [1, 0]) {
        await act(async () => {
          jest.advanceTimersByTime(1000);
        });
        if (left > 0)
          expect(
            screen.getByRole("button", {
              name: `Reenviar código en ${left} s`,
            }),
          ).toBeDisabled();
      }
      expect(
        screen.getByRole("button", { name: "Reenviar código" }),
      ).toBeEnabled();
    } finally {
      jest.useRealTimers();
    }
  });

  it("«Cambiar número» vuelve al celular conservando lo escrito", async () => {
    const user = userEvent.setup();
    await goToCode(user, {});
    await user.click(screen.getByRole("button", { name: "Cambiar número" }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Ingresá con tu celular" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Tu celular")).toHaveValue("2644123456");
  });

  it("con contraseña: valida campos, muestra el error y vuelve al código", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...unauthenticated,
      "POST /auth/login": () => ({
        status: 401,
        json: { detail: "Celular o contraseña incorrectos." },
      }),
    });
    renderPage();
    await user.type(await screen.findByLabelText("Tu celular"), "2644123456");
    await user.click(
      screen.getByRole("button", { name: "Ingresar con contraseña" }),
    );
    expect(screen.getByLabelText("Tu celular")).toHaveValue("2644123456");

    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Completá tu celular y tu contraseña.",
    );
    expect(calls.some((c) => c.key === "POST /auth/login")).toBe(false);

    await user.type(screen.getByLabelText("Contraseña"), "mala");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Celular o contraseña incorrectos.",
    );
    // Los endpoints de auth no reintentan tras un 401.
    expect(calls.filter((c) => c.key === "POST /auth/login")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Ingresar" })).toBeEnabled();

    await user.click(
      screen.getByRole("button", { name: "Ingresar con código por WhatsApp" }),
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Ingresá con tu celular" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Tu celular")).toHaveValue("2644123456");
  });

  it("perfil: sugiere el usuario, envía todos los campos y muestra errores", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /auth/me": () => ({
        status: 200,
        json: makeUser({
          profile_pending: true,
          username: "juan.perez",
          full_name: "Juan Pérez",
          email: "juan@example.com",
        }),
      }),
      "POST /auth/register": () => ({
        status: 409,
        json: { detail: "Ese nombre de usuario ya está en uso." },
      }),
    });
    renderPage();

    expect(await screen.findByLabelText("Nombre de usuario")).toHaveValue(
      "juan.perez",
    );
    expect(screen.getByLabelText(/Nombre y apellido/)).toHaveValue(
      "Juan Pérez",
    );
    expect(screen.getByLabelText(/Email/)).toHaveValue("juan@example.com");

    await user.type(screen.getByLabelText(/^Contraseña/), "corta");
    await user.click(screen.getByLabelText(/Quiero recibir consultas/));
    await user.click(screen.getByLabelText(/Acepto los/));
    await user.click(screen.getByRole("button", { name: "Crear mi cuenta" }));
    expect(screen.getByText(/al menos 8 caracteres/)).toBeVisible();

    await user.type(screen.getByLabelText(/^Contraseña/), "123");
    await user.clear(screen.getByLabelText(/Email/));
    await user.type(screen.getByLabelText(/Email/), " otro@example.com ");
    await user.click(screen.getByRole("button", { name: "Crear mi cuenta" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ese nombre de usuario ya está en uso.",
    );
    expect(calls.find((c) => c.key === "POST /auth/register")?.body).toEqual({
      username: "juan.perez",
      full_name: "Juan Pérez",
      email: "otro@example.com",
      password: "corta123",
      accept_terms: true,
      whatsapp_optin: false,
    });
    expect(
      screen.getByRole("button", { name: "Crear mi cuenta" }),
    ).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });
});
