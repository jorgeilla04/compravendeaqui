import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import EnlacePage from "@/app/ingresar/enlace/page";
import IngresarPage from "@/app/ingresar/page";
import { AuthProvider } from "@/components/auth/auth-provider";
import { LinkSignIn } from "@/components/auth/login/link-sign-in";
import { LoginFlow } from "@/components/auth/login/login-flow";
import { PhotoPicker } from "@/components/publish/photo-picker";
import { loginMethod } from "@/lib/login-method";
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
  "POST /auth/refresh": () => ({ status: 401, json: { detail: "Vencida" } }),
};

/** Usuario recién creado por email: sin celular todavía. */
function emailUser(overrides: Partial<Me> = {}): Me {
  return {
    id: "6f1c1d2e-0000-4000-8000-000000000002",
    username: "usuario0000002",
    display_name: "Usuario",
    avatar_url: null,
    created_at: "2026-01-01T00:00:00Z",
    phone_masked: null,
    phone_verified: false,
    email: "juan@gmail.com",
    email_verified: true,
    full_name: null,
    role: "user",
    whatsapp_optin: true,
    profile_pending: true,
    has_password: false,
    ...overrides,
  };
}

const emailOtp = {
  destination: "ju***@gmail.com",
  channel: "email",
  expires_in: 300,
  resend_in: 0,
};

function renderFlow() {
  return render(
    <AuthProvider>
      <LoginFlow method="email" />
    </AuthProvider>,
  );
}

beforeEach(() => {
  replace.mockReset();
  search = new URLSearchParams();
});

describe("/ingresar por email", () => {
  it("recorre email → código → perfil con celular y va a next", async () => {
    const user = userEvent.setup();
    search = new URLSearchParams({ next: "/mis-avisos" });
    const calls = mockApi({
      ...unauthenticated,
      "POST /auth/otp/request": () => ({ status: 200, json: emailOtp }),
      "POST /auth/otp/verify": () => ({
        status: 200,
        json: {
          user: emailUser(),
          is_new_user: true,
          access_token: "t",
          expires_in: 900,
        },
      }),
      "POST /auth/register": () => ({
        status: 200,
        json: emailUser({
          profile_pending: false,
          phone_masked: "+54 9 264 ***-3456",
        }),
      }),
    });
    renderFlow();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Ingresá con tu email",
      }),
    ).toBeVisible();
    await user.type(screen.getByLabelText("Tu email"), "juan@");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(screen.getByText(/Escribí tu email completo/)).toBeVisible();
    expect(calls.some((c) => c.key === "POST /auth/otp/request")).toBe(false);

    await user.type(screen.getByLabelText("Tu email"), "Gmail.com");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));

    await screen.findByRole("heading", { level: 1, name: "Ingresá el código" });
    expect(calls.find((c) => c.key === "POST /auth/otp/request")?.body).toEqual(
      { email: "juan@gmail.com", next: "/mis-avisos" },
    );
    expect(screen.getByText(/Te enviamos un código por email a/)).toBeVisible();
    expect(screen.getByText("ju***@gmail.com")).toBeVisible();
    expect(screen.getByText(/revisá en Spam/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Cambiar email" }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Código de 6 números"), "123456");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    await screen.findByRole("heading", {
      level: 1,
      name: "Completá tu perfil",
    });
    expect(calls.find((c) => c.key === "POST /auth/otp/verify")?.body).toEqual({
      email: "juan@gmail.com",
      code: "123456",
    });
    // El email ya está verificado: no se vuelve a pedir. El celular sí.
    expect(screen.queryByLabelText(/^Email/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Nombre de usuario"), "juanp");
    await user.type(screen.getByLabelText("Nombre y apellido"), "Juan Pérez");
    await user.click(screen.getByLabelText(/Acepto los/));
    await user.type(screen.getByLabelText(/Tu celular/), "264 41");
    await user.click(screen.getByRole("button", { name: "Crear mi cuenta" }));
    expect(screen.getByLabelText(/Tu celular/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(calls.some((c) => c.key === "POST /auth/register")).toBe(false);

    await user.type(screen.getByLabelText(/Tu celular/), "2-3456");
    await user.click(screen.getByRole("button", { name: "Crear mi cuenta" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/mis-avisos"));
    expect(calls.find((c) => c.key === "POST /auth/register")?.body).toEqual({
      username: "juanp",
      full_name: "Juan Pérez",
      phone: "264 412-3456",
      password: null,
      accept_terms: true,
      whatsapp_optin: true,
    });
  });

  it("sin next no lo manda: la API lleva el link a publicar", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...unauthenticated,
      "POST /auth/otp/request": () => ({ status: 200, json: emailOtp }),
    });
    renderFlow();
    await user.type(
      await screen.findByLabelText("Tu email"),
      " Juan@Gmail.com ",
    );
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    await screen.findByRole("heading", { level: 1, name: "Ingresá el código" });
    await user.click(screen.getByRole("button", { name: "Reenviar código" }));
    const requests = calls.filter((c) => c.key === "POST /auth/otp/request");
    expect(requests.map((c) => c.body)).toEqual([
      { email: "juan@gmail.com" },
      { email: "juan@gmail.com" },
    ]);
    expect(
      await screen.findByText("Te mandamos un código nuevo por email."),
    ).toBeVisible();
  });

  it("con contraseña usa el email", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      ...unauthenticated,
      "POST /auth/login": () => ({
        status: 401,
        json: { detail: "Email o contraseña incorrectos" },
      }),
    });
    renderFlow();
    await user.click(
      await screen.findByRole("button", { name: "Ingresar con contraseña" }),
    );
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(
      screen.getByText("Completá tu email y tu contraseña."),
    ).toBeVisible();
    await user.type(screen.getByLabelText("Tu email"), "juan@gmail.com");
    await user.type(screen.getByLabelText("Contraseña"), "clave-segura");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));
    expect(
      await screen.findByText("Email o contraseña incorrectos"),
    ).toBeVisible();
    expect(calls.find((c) => c.key === "POST /auth/login")?.body).toEqual({
      email: "juan@gmail.com",
      password: "clave-segura",
    });
    expect(
      screen.getByRole("button", { name: "Ingresar con código por email" }),
    ).toBeInTheDocument();
  });
});

describe("link del mail (/ingresar/enlace)", () => {
  const TOKEN = "a".repeat(43);

  function renderLink() {
    return render(
      <AuthProvider>
        <LinkSignIn />
      </AuthProvider>,
    );
  }

  it("no entra solo: entra al tocar y va directo a publicar", async () => {
    const user = userEvent.setup();
    search = new URLSearchParams({ t: TOKEN, next: "/publicar" });
    const calls = mockApi({
      ...unauthenticated,
      "POST /auth/otp/link": () => ({
        status: 200,
        json: {
          user: emailUser({ profile_pending: false }),
          access_token: "t",
          expires_in: 900,
        },
      }),
    });
    renderLink();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Entrá y publicá tu aviso",
      }),
    ).toBeVisible();
    expect(screen.getByText(/sacarlas en el momento/)).toBeVisible();
    expect(calls.some((c) => c.key === "POST /auth/otp/link")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Entrar y publicar" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/publicar"));
    expect(calls.find((c) => c.key === "POST /auth/otp/link")?.body).toEqual({
      token: TOKEN,
    });
  });

  it("con perfil pendiente pasa por completar perfil y sigue a next", async () => {
    const user = userEvent.setup();
    search = new URLSearchParams({ t: TOKEN, next: "/publicar" });
    mockApi({
      ...unauthenticated,
      "POST /auth/otp/link": () => ({
        status: 200,
        json: { user: emailUser(), access_token: "t", expires_in: 900 },
      }),
    });
    renderLink();
    await user.click(screen.getByRole("button", { name: "Entrar y publicar" }));
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/ingresar?next=%2Fpublicar"),
    );
  });

  it("ignora un next externo y muestra el error si el link venció", async () => {
    const user = userEvent.setup();
    search = new URLSearchParams({ t: TOKEN, next: "//evil.com" });
    mockApi({
      ...unauthenticated,
      "POST /auth/otp/link": () => ({
        status: 400,
        json: { detail: "El link venció o ya se usó. Pedí un código nuevo." },
      }),
    });
    renderLink();
    await user.click(screen.getByRole("button", { name: "Entrar y publicar" }));
    expect(await screen.findByText(/El link venció o ya se usó/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Pedir un código nuevo" }),
    ).toHaveAttribute("href", "/ingresar?next=%2Fpublicar");
    expect(replace).not.toHaveBeenCalled();
  });

  it("a otra página muestra solo «Entrar»", () => {
    search = new URLSearchParams({ t: TOKEN, next: "/mis-avisos" });
    mockApi(unauthenticated);
    renderLink();
    expect(
      screen.getByRole("heading", { level: 1, name: "Entrá a tu cuenta" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  it("sin token avisa que el link está incompleto", () => {
    search = new URLSearchParams({ t: "corto" });
    mockApi(unauthenticated);
    renderLink();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "El link está incompleto",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Pedir un código nuevo" }),
    ).toHaveAttribute("href", "/ingresar");
  });
});

describe("loginMethod", () => {
  it("usa lo que dice la API y si falla ofrece email", async () => {
    mockApi({
      "GET /auth/methods": () => ({ status: 200, json: { otp: "phone" } }),
    });
    await expect(loginMethod()).resolves.toBe("phone");
    mockApi({
      "GET /auth/methods": () => ({ status: 200, json: { otp: "email" } }),
    });
    await expect(loginMethod()).resolves.toBe("email");
    mockApi({
      "GET /auth/methods": () => ({ status: 500, json: { detail: "x" } }),
    });
    await expect(loginMethod()).resolves.toBe("email");
  });
});

describe("PhotoPicker", () => {
  it("ofrece sacar la foto con la cámara además de la galería", async () => {
    const user = userEvent.setup();
    const onFiles = jest.fn();
    render(<PhotoPicker id="fotos" count={0} onFiles={onFiles} />);
    const camera = screen.getByLabelText("Sacar foto");
    expect(camera).toHaveAttribute("capture", "environment");
    expect(camera).not.toHaveAttribute("multiple");
    expect(screen.getByLabelText("Subí fotos")).toHaveAttribute("multiple");
    const photo = new File(["x"], "foto.jpg", { type: "image/jpeg" });
    await user.upload(camera, photo);
    expect(onFiles).toHaveBeenCalledWith([photo]);
  });

  it("al llegar al máximo oculta la cámara", () => {
    render(<PhotoPicker id="fotos" count={10} onFiles={jest.fn()} />);
    expect(screen.queryByLabelText("Sacar foto")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Llegaste al máximo de fotos")).toBeDisabled();
  });
});

describe("páginas de ingreso", () => {
  it("/ingresar arma el formulario según el método de la API", async () => {
    mockApi({
      ...unauthenticated,
      "GET /auth/methods": () => ({ status: 200, json: { otp: "phone" } }),
    });
    render(<AuthProvider>{await IngresarPage()}</AuthProvider>);
    expect(await screen.findByLabelText("Tu celular")).toBeVisible();
  });

  it("/ingresar/enlace muestra el botón para entrar", () => {
    search = new URLSearchParams({ t: "b".repeat(43) });
    mockApi(unauthenticated);
    render(
      <AuthProvider>
        <EnlacePage />
      </AuthProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Entrar y publicar" }),
    ).toBeVisible();
  });
});
