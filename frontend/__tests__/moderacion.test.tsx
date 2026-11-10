import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AuthProvider } from "@/components/auth/auth-provider";
import { ModeracionPanel } from "@/components/moderacion/moderacion-panel";
import type { AvisoMod, UsuarioMod } from "@/lib/moderacion";
import type { Me } from "@/lib/types";
import { mockApi } from "@/test-utils/api-mock";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => "/admin/moderacion",
  useSearchParams: () => new URLSearchParams(),
}));

const me = (role: string): Me =>
  ({
    id: "u1",
    username: "jorge",
    display_name: "Jorge",
    avatar_url: null,
    created_at: "2026-01-01T00:00:00Z",
    phone_masked: null,
    phone_verified: false,
    email: "jorge@mail.com",
    email_verified: true,
    full_name: "Jorge",
    role,
    whatsapp_optin: true,
    profile_pending: false,
    has_password: false,
  }) as Me;

const aviso: AvisoMod = {
  id: "a1",
  title: "Toyota Corolla 2018",
  status: "active",
  price: "15900",
  price_currency: "USD",
  url_path: "/autos/toyota-corolla-2018-a1",
  thumb_url: null,
  created_at: "2026-11-01T00:00:00Z",
  moderation_reason: null,
  dueno: {
    id: "u2",
    username: "vendedor",
    display_name: "Ana Vendedora",
    email: "ana@mail.com",
    is_active: true,
  },
};

const usuario: UsuarioMod = {
  id: "u2",
  username: "vendedor",
  display_name: "Ana Vendedora",
  email: "ana@mail.com",
  role: "user",
  is_active: true,
  suspension_reason: null,
  avisos_activos: 1,
  created_at: "2026-10-01T00:00:00Z",
};

function renderPanel() {
  return render(
    <AuthProvider>
      <ModeracionPanel />
    </AuthProvider>,
  );
}

describe("moderación", () => {
  it("un usuario común no ve el panel", async () => {
    mockApi({ "GET /auth/me": () => ({ status: 200, json: me("user") }) });
    renderPanel();
    expect(
      await screen.findByText(/solo para administradores y moderadores/),
    ).toBeVisible();
  });

  it("da de baja un aviso con motivo y lo restaura", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /auth/me": () => ({ status: 200, json: me("admin") }),
      "GET /admin/moderacion/avisos": () => ({ status: 200, json: [aviso] }),
      "POST /admin/moderacion/avisos/a1/suspender": (body) => ({
        status: 200,
        json: {
          ...aviso,
          status: "suspended",
          moderation_reason: (body as { motivo: string }).motivo,
        },
      }),
      "POST /admin/moderacion/avisos/a1/restaurar": () => ({
        status: 200,
        json: aviso,
      }),
    });
    renderPanel();
    const fila = (await screen.findByText("Toyota Corolla 2018")).closest(
      "li",
    )!;
    await user.click(within(fila).getByRole("button", { name: "Dar de baja" }));
    // Sin motivo no se puede confirmar.
    await user.click(
      within(fila).getByRole("button", { name: "Confirmar baja del aviso" }),
    );
    expect(within(fila).getByText(/Escribí el motivo/)).toBeVisible();
    await user.type(within(fila).getByLabelText(/Motivo/), "Precio engañoso");
    await user.click(
      within(fila).getByRole("button", { name: "Confirmar baja del aviso" }),
    );
    expect(await within(fila).findByText("Suspendido")).toBeVisible();
    expect(within(fila).getByText("Motivo: Precio engañoso")).toBeVisible();
    expect(
      calls.find((c) => c.key === "POST /admin/moderacion/avisos/a1/suspender")
        ?.body,
    ).toEqual({ motivo: "Precio engañoso" });

    await user.click(
      within(fila).getByRole("button", {
        name: "Restaurar aviso Toyota Corolla 2018",
      }),
    );
    await waitFor(() => expect(within(fila).getByText("Activo")).toBeVisible());
  });

  it("suspende un usuario y muestra el historial", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /auth/me": () => ({ status: 200, json: me("moderator") }),
      "GET /admin/moderacion/avisos": () => ({ status: 200, json: [] }),
      "GET /admin/moderacion/usuarios": () => ({
        status: 200,
        json: [usuario],
      }),
      "POST /admin/moderacion/usuarios/u2/suspender": () => ({
        status: 200,
        json: { ...usuario, is_active: false, suspension_reason: "Estafas" },
      }),
      "GET /admin/moderacion/historial": () => ({
        status: 200,
        json: [
          {
            id: 1,
            actor: "jorge",
            target_type: "user",
            target_id: "u2",
            target_label: "vendedor",
            action: "suspend",
            reason: "Estafas",
            created_at: "2026-11-10T00:00:00Z",
          },
        ],
      }),
    });
    renderPanel();
    expect(
      await screen.findByText("No hay avisos que coincidan."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Usuarios" }));
    const fila = (await screen.findByText("Ana Vendedora")).closest("li")!;
    await user.click(
      within(fila).getByRole("button", { name: "Suspender usuario" }),
    );
    await user.type(within(fila).getByLabelText(/Motivo/), "Estafas");
    await user.click(
      within(fila).getByRole("button", { name: "Confirmar suspensión" }),
    );
    expect(await within(fila).findByText("Suspendido")).toBeVisible();
    expect(
      within(fila).getByRole("button", { name: "Reactivar a vendedor" }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Historial" }));
    expect(await screen.findByText(/Motivo: Estafas/)).toBeVisible();
  });
});
