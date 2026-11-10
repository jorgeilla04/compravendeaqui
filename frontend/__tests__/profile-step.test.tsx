import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {
  normalizeUsername,
  ProfileStep,
} from "@/components/auth/login/profile-step";

describe("ProfileStep", () => {
  it("borra el error del usuario apenas se corrige", async () => {
    const user = userEvent.setup();
    render(<ProfileStep user={null} onDone={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: "Crear mi cuenta" }));
    expect(screen.getByText(/Usá entre 3 y 30 caracteres/)).toBeVisible();

    await user.type(screen.getByLabelText(/Nombre de usuario/), "jorgeilla");
    expect(screen.queryByText(/Usá entre 3 y 30 caracteres/)).toBeNull();
    // Los demás errores siguen hasta que se corrija cada campo.
    expect(screen.getByText("Escribí tu nombre y apellido.")).toBeVisible();
  });

  it("lleva el foco al primer campo con error y avisa junto al botón", async () => {
    const user = userEvent.setup();
    const scroll = jest.fn();
    Element.prototype.scrollIntoView = scroll;
    render(<ProfileStep user={null} onDone={jest.fn()} />);

    await user.type(screen.getByLabelText(/Nombre de usuario/), "jorge");
    await user.click(screen.getByRole("button", { name: "Crear mi cuenta" }));
    // Falta el nombre: el foco va ahí aunque esté fuera de la pantalla.
    expect(screen.getByLabelText(/Nombre y apellido/)).toHaveFocus();
    expect(scroll).toHaveBeenCalled();
    expect(
      screen.getByText("Revisá los campos marcados en rojo."),
    ).toBeVisible();
  });

  it("acepta tildes, eñes y guiones en el usuario y los convierte", async () => {
    expect(normalizeUsername("María Peña-Gómez")).toBe("mariapena_gomez");
    const user = userEvent.setup();
    render(<ProfileStep user={null} onDone={jest.fn()} />);
    await user.type(
      screen.getByLabelText(/Nombre de usuario/),
      "Virginia Tello",
    );
    expect(screen.getByLabelText(/Nombre de usuario/)).toHaveValue(
      "virginiatello",
    );
  });
});
