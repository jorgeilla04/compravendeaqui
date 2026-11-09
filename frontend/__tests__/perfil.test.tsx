import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PerfilLayout, { metadata } from "@/app/perfil/layout";
import PerfilPage from "@/app/perfil/page";
import type { Me } from "@/lib/types";
import { jsonResponse } from "@/test-utils/fetch";

const replace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/perfil",
}));

const setUser = jest.fn();
let authState: { user: Me | null; loading: boolean } = {
  user: null,
  loading: false,
};

jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({
    ...authState,
    setUser,
    reload: jest.fn(),
    logout: jest.fn(),
  }),
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

type Call = { method: string; path: string; init: RequestInit };
type Handler = (call: Call) => { status?: number; body?: unknown };
let calls: Call[] = [];

function mockApi(handler: Handler) {
  calls = [];
  global.fetch = jest.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const call = {
        method: init?.method ?? "GET",
        path: url.pathname.replace(/^\/api\/v1/, ""),
        init: init ?? {},
      };
      calls.push(call);
      const { status = 200, body } = handler(call);
      return jsonResponse(body, status);
    },
  ) as jest.Mock;
}

function photo(name: string, type = "image/jpeg", size?: number): File {
  const file = new File(["x"], name, { type });
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  return file;
}

const avatarInput = (container: HTMLElement) =>
  container.querySelector<HTMLInputElement>("input#avatar")!;

beforeAll(() => {
  URL.createObjectURL = jest.fn(() => "blob:preview");
  URL.revokeObjectURL = jest.fn();
});

beforeEach(() => {
  authState = { user: me, loading: false };
  setUser.mockReset();
  replace.mockReset();
});

describe("/perfil layout", () => {
  it("no se indexa y renderiza a los hijos", () => {
    expect(metadata.robots).toEqual({ index: false });
    render(<PerfilLayout>contenido</PerfilLayout>);
    expect(screen.getByText("contenido")).toBeInTheDocument();
  });
});

describe("/perfil", () => {
  it("sin sesión manda a ingresar", async () => {
    authState = { user: null, loading: false };
    render(<PerfilPage />);
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/ingresar?next=%2Fperfil"),
    );
  });

  it("carga los datos del usuario de useAuth", () => {
    mockApi(() => ({ body: me }));
    render(<PerfilPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Mi perfil" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver mi perfil público" }),
    ).toHaveAttribute("href", `/u/${me.id}`);
    expect(screen.getByLabelText(/Nombre y apellido/)).toHaveValue(
      "Juan Pérez",
    );
    expect(screen.getByLabelText(/Nombre de usuario/)).toHaveValue(
      "juan.perez",
    );
    expect(screen.getByLabelText(/Email/)).toHaveValue("");
    expect(screen.getByText("+54 9 264 ***-3456")).toBeInTheDocument();
    expect(screen.getByText("Verificado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subir foto" })).toBeEnabled();
  });

  it("muestra la foto y datos opcionales cuando existen", () => {
    authState = {
      user: {
        ...me,
        avatar_url: "http://localhost:9000/avatars/u1.webp",
        phone_masked: null,
        phone_verified: false,
        email: "juan@example.com",
      },
      loading: false,
    };
    render(<PerfilPage />);
    expect(
      screen.getByRole("img", { name: "Tu foto de perfil" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cambiar foto" })).toBeEnabled();
    expect(screen.getByText("Sin celular")).toBeInTheDocument();
    expect(screen.queryByText("Verificado")).toBeNull();
    expect(screen.getByLabelText(/Email/)).toHaveValue("juan@example.com");
  });

  it("guarda el perfil con PUT /users/me", async () => {
    const updated = { ...me, username: "juanp", full_name: "Juan P" };
    mockApi(({ method, path }) =>
      method === "PUT" && path === "/users/me"
        ? { body: updated }
        : { status: 404, body: { detail: "No" } },
    );
    const user = userEvent.setup();
    render(<PerfilPage />);

    const name = screen.getByLabelText(/Nombre y apellido/);
    await user.clear(name);
    await user.type(name, "  Juan P ");
    const username = screen.getByLabelText(/Nombre de usuario/);
    await user.clear(username);
    // Se normaliza a minúsculas y sin espacios.
    await user.type(username, "Juan P");
    expect(username).toHaveValue("juanp");
    await user.type(screen.getByLabelText(/Email/), " juan@example.com ");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByText("Guardamos los cambios.")).toBeVisible();
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      full_name: "Juan P",
      username: "juanp",
      email: "juan@example.com",
    });
    expect(setUser).toHaveBeenCalledWith(updated);
  });

  it("envía email null si queda vacío", async () => {
    mockApi(() => ({ body: me }));
    const user = userEvent.setup();
    render(<PerfilPage />);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByText("Guardamos los cambios.");
    expect(JSON.parse(String(calls[0].init.body)).email).toBeNull();
  });

  it("muestra el 409 si el nombre de usuario está tomado", async () => {
    mockApi(() => ({
      status: 409,
      body: { detail: "Ese nombre de usuario ya está en uso." },
    }));
    const user = userEvent.setup();
    render(<PerfilPage />);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ese nombre de usuario ya está en uso.",
    );
    expect(setUser).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Guardar cambios" }),
    ).toBeEnabled();
  });

  it("valida nombre, usuario y email antes de enviar", async () => {
    mockApi(() => ({ body: me }));
    const user = userEvent.setup();
    render(<PerfilPage />);

    await user.clear(screen.getByLabelText(/Nombre y apellido/));
    await user.type(screen.getByLabelText(/Nombre y apellido/), "J");
    await user.clear(screen.getByLabelText(/Nombre de usuario/));
    await user.type(screen.getByLabelText(/Nombre de usuario/), "j!");
    await user.type(screen.getByLabelText(/Email/), "juan@");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(screen.getByText("Escribí tu nombre y apellido.")).toBeVisible();
    expect(screen.getByText(/Usá entre 3 y 30 caracteres/)).toBeVisible();
    expect(screen.getByText(/Revisá el email/)).toBeVisible();
    expect(screen.getByLabelText(/Email/)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(calls).toHaveLength(0);
  });

  it("sube el avatar con POST /users/me/avatar", async () => {
    const updated = {
      ...me,
      avatar_url: "http://localhost:9000/avatars/u1.webp",
    };
    let finish: () => void = () => {};
    calls = [];
    global.fetch = jest.fn(
      (input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve) => {
          calls.push({
            method: init?.method ?? "GET",
            path: new URL(String(input)).pathname.replace(/^\/api\/v1/, ""),
            init: init ?? {},
          });
          finish = () => resolve(jsonResponse(updated));
        }),
    ) as jest.Mock;
    const user = userEvent.setup();
    const { container } = render(<PerfilPage />);

    await user.upload(avatarInput(container), photo("yo.png", "image/png"));
    // Vista previa mientras sube.
    expect(
      screen.getByRole("button", { name: "Subiendo foto…" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("img", { name: "Tu foto de perfil" }),
    ).toHaveAttribute("src", "blob:preview");

    finish();
    expect(
      await screen.findByText("Listo, actualizamos tu foto."),
    ).toBeVisible();
    expect(`${calls[0].method} ${calls[0].path}`).toBe("POST /users/me/avatar");
    const body = calls[0].init.body as FormData;
    expect((body.get("file") as File).name).toBe("yo.png");
    expect(setUser).toHaveBeenCalledWith(updated);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("el botón abre el selector de archivos", async () => {
    const user = userEvent.setup();
    const { container } = render(<PerfilPage />);
    const click = jest.spyOn(avatarInput(container), "click");
    await user.click(screen.getByRole("button", { name: "Subir foto" }));
    expect(click).toHaveBeenCalled();
  });

  it("muestra el error si falla la subida del avatar", async () => {
    mockApi(() => ({
      status: 413,
      body: { detail: "La foto es muy grande." },
    }));
    const user = userEvent.setup();
    const { container } = render(<PerfilPage />);
    await user.upload(avatarInput(container), photo("yo.jpg"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La foto es muy grande.",
    );
    expect(setUser).not.toHaveBeenCalled();
    // Sin vista previa: vuelve a la inicial.
    expect(screen.getByRole("button", { name: "Subir foto" })).toBeEnabled();
  });

  it("rechaza archivos que no son fotos o pesan más de 5 MB", async () => {
    mockApi(() => ({ body: me }));
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(<PerfilPage />);

    await user.upload(
      avatarInput(container),
      photo("cv.pdf", "application/pdf"),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Elegí una foto (JPG, PNG o WebP).",
    );

    await user.upload(
      avatarInput(container),
      photo("enorme.jpg", "image/jpeg", 5 * 1024 * 1024 + 1),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "La foto puede pesar hasta 5 MB.",
    );
    expect(calls).toHaveLength(0);
  });
});
