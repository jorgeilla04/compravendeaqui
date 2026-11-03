import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ContactButton } from "@/components/listings/contact-button";
import { jsonResponse } from "@/test-utils/fetch";

describe("ContactButton", () => {
  it("pide el link al backend recién con el clic y abre WhatsApp", async () => {
    const popup = { opener: {}, location: { href: "" } };
    window.open = jest.fn(() => popup as unknown as Window);
    global.fetch = jest.fn(async () =>
      jsonResponse(
        {
          whatsapp_url: "https://wa.me/5492644123456?text=Hola",
          phone_display: "+54 9 264 412-3456",
        },
        200,
      ),
    ) as jest.Mock;

    render(<ContactButton listingId="abc" />);
    // El teléfono no está en el HTML inicial.
    expect(screen.queryByText(/412-3456/)).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole("button", { name: "Contactar por WhatsApp" }),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/listings/abc/contact"),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(popup.location.href).toBe("https://wa.me/5492644123456?text=Hola");
    expect(popup.opener).toBeNull();
    expect(await screen.findByText("+54 9 264 412-3456")).toBeInTheDocument();
  });

  it("muestra el error del backend y cierra la ventana", async () => {
    const popup = { opener: {}, location: { href: "" }, close: jest.fn() };
    window.open = jest.fn(() => popup as unknown as Window);
    global.fetch = jest.fn(async () =>
      jsonResponse(
        { detail: "Este vendedor no recibe consultas por WhatsApp" },
        409,
      ),
    ) as jest.Mock;

    render(<ContactButton listingId="abc" />);
    await userEvent.click(
      screen.getByRole("button", { name: "Contactar por WhatsApp" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "no recibe consultas por WhatsApp",
    );
    expect(popup.close).toHaveBeenCalled();
  });
});
