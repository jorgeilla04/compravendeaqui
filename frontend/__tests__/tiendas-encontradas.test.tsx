import { render, screen, within } from "@testing-library/react";

import { TiendasEncontradas } from "@/components/search/tiendas-encontradas";
import type { TiendaEncontrada } from "@/lib/tiendas/types";

const tienda = {
  slug: "uniformes",
  nombre: "Uniformes escolares",
  descripcion: "El uniforme de tu colegio con envío a tu casa.",
};
const sanPablo = {
  slug: "colegio-san-pablo",
  nombre: "Colegio San Pablo",
  subtitulo: "Capital",
  categoria: null,
  color1: "#1e3a8a",
  color2: "#ffffff",
  logo_url: null,
};

describe("TiendasEncontradas", () => {
  it("muestra los colegios que coinciden y lleva a su catálogo", () => {
    const encontradas: TiendaEncontrada[] = [
      { tienda, grupo_label: "Colegio", grupos: [sanPablo], total_grupos: 1 },
    ];
    render(<TiendasEncontradas encontradas={encontradas} />);
    const seccion = screen.getByRole("region", {
      name: "Uniformes escolares",
    });
    expect(
      within(seccion).getByRole("link", { name: /Colegio San Pablo/ }),
    ).toHaveAttribute("href", "/tiendas/uniformes/colegio-san-pablo");
    expect(within(seccion).queryByText(/Ver los/)).toBeNull();
  });

  it("con muchos colegios ofrece ver todos", () => {
    render(
      <TiendasEncontradas
        encontradas={[
          {
            tienda,
            grupo_label: "Colegio",
            grupos: [sanPablo],
            total_grupos: 42,
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Ver los 42 colegios" }),
    ).toHaveAttribute("href", "/tiendas/uniformes");
  });
});
