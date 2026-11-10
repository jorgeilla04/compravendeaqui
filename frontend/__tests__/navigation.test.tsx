import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AccountMenu } from "@/components/layout/account-menu";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import type { Me } from "@/lib/types";

const push = jest.fn();
const refresh = jest.fn();
let pathname = "/";
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}));

const logout = jest.fn(async () => undefined);
let auth: { user: Me | null; loading: boolean } = {
  user: null,
  loading: false,
};
jest.mock("@/components/auth/auth-provider", () => ({
  useAuth: () => ({ ...auth, logout, reload: jest.fn(), setUser: jest.fn() }),
}));

const me = { id: "u1", display_name: "Ana Gómez", username: "ana" } as Me;

describe("navegación", () => {
  it("menú de cuenta: ingresar, cargando y sesión iniciada", async () => {
    auth = { user: null, loading: false };
    const { rerender } = render(<AccountMenu />);
    expect(screen.getByRole("link", { name: "Ingresar" })).toHaveAttribute(
      "href",
      "/ingresar",
    );

    auth = { user: null, loading: true };
    rerender(<AccountMenu />);
    expect(
      screen.queryByRole("link", { name: "Ingresar" }),
    ).not.toBeInTheDocument();

    auth = { user: me, loading: false };
    rerender(<AccountMenu />);
    await userEvent.click(screen.getByText("Ana Gómez"));
    expect(screen.getByRole("link", { name: "Mis avisos" })).toHaveAttribute(
      "href",
      "/mis-avisos",
    );
    // Sin tiendas a cargo no ve el panel.
    expect(
      screen.queryByRole("link", { name: "Mis tiendas" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Salir" }));
    expect(logout).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("menú de cuenta: el admin o encargado ve Mis tiendas", async () => {
    auth = { user: { ...me, gestiona_tiendas: true }, loading: false };
    render(<AccountMenu />);
    await userEvent.click(screen.getByText("Ana Gómez"));
    expect(screen.getByRole("link", { name: "Mis tiendas" })).toHaveAttribute(
      "href",
      "/tiendas/admin",
    );
  });

  it("bottom nav marca la página actual y cambia según la sesión", () => {
    pathname = "/buscar";
    auth = { user: null, loading: false };
    const { rerender } = render(<MobileNav />);
    expect(screen.getByRole("link", { name: "Buscar" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Inicio" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Ingresar" })).toHaveAttribute(
      "href",
      "/ingresar",
    );
    auth = { user: me, loading: false };
    rerender(<MobileNav />);
    expect(screen.getByRole("link", { name: "Cuenta" })).toHaveAttribute(
      "href",
      "/perfil",
    );
  });

  it("breadcrumbs: el último es la página actual", () => {
    render(
      <Breadcrumbs
        items={[
          { name: "Inicio", href: "/" },
          { name: "Autos", href: "/autos" },
          { name: "Corolla" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: "Autos" })).toHaveAttribute(
      "href",
      "/autos",
    );
    expect(screen.getByText("Corolla")).toHaveAttribute("aria-current", "page");
  });

  it("header y footer: publicar y links legales", () => {
    auth = { user: null, loading: false };
    render(
      <>
        <SiteHeader />
        <SiteFooter />
      </>,
    );
    expect(
      screen.getByRole("link", { name: "Publicar aviso" }),
    ).toHaveAttribute("href", "/publicar");
    expect(
      screen.getByRole("link", { name: "Términos y condiciones" }),
    ).toHaveAttribute("href", "/terminos");
    expect(
      screen.getByRole("link", { name: "Política de privacidad" }),
    ).toHaveAttribute("href", "/privacidad");
  });
});
