import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Gallery } from "@/components/listings/gallery";

import { listing } from "./fixtures";

describe("Gallery", () => {
  it("navega entre fotos con flechas y miniaturas, y amplía", async () => {
    render(<Gallery images={listing().images} title="Toyota" />);
    expect(
      screen.getByRole("img", { name: "Foto 1 de 2: Toyota" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Foto siguiente" })[0],
    );
    expect(
      screen.getByRole("img", { name: "Foto 2 de 2: Toyota" }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Foto anterior" })[0],
    );
    await userEvent.click(screen.getByRole("button", { name: "Ver foto 2" }));
    expect(screen.getByRole("button", { name: "Ver foto 2" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    await userEvent.click(
      screen.getByRole("button", { name: /Ampliar foto 2/ }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("img", { name: "Foto 2 de 2: Toyota" }),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Foto siguiente" }),
    );
    expect(
      within(dialog).getByRole("img", { name: "Foto 1 de 2: Toyota" }),
    ).toBeInTheDocument();
  });

  it("sin fotos muestra un estado claro", () => {
    render(<Gallery images={[]} title="Toyota" />);
    expect(screen.getByText("Este aviso no tiene fotos")).toBeInTheDocument();
  });

  it("con una sola foto no muestra flechas ni miniaturas", () => {
    render(<Gallery images={listing().images.slice(0, 1)} title="Toyota" />);
    expect(
      screen.queryByRole("button", { name: "Foto siguiente" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Miniaturas" }),
    ).not.toBeInTheDocument();
  });
});
