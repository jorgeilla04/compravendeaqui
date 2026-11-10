import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProfileStep } from "@/components/auth/login/profile-step";

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
});
