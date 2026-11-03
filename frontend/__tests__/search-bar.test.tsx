import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SearchBar } from "@/components/layout/search-bar";
import { jsonResponse } from "@/test-utils/fetch";

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams("q=moto"),
}));

beforeEach(() => {
  push.mockReset();
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

describe("SearchBar", () => {
  it("toma el texto de la URL y busca con Enter", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: "Buscar avisos" });
    expect(input).toHaveValue("moto");
    await user.clear(input);
    await user.type(input, "heladera{Enter}");
    expect(push).toHaveBeenCalledWith("/buscar?q=heladera");
  });

  it("sugiere categorías y búsquedas con debounce y se navega con el teclado", async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({
        queries: [{ text: "Heladera Whirlpool" }],
        categories: [{ name: "Electrodomésticos", slug: "electrodomesticos" }],
      }),
    ) as jest.Mock;
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: "Buscar avisos" });
    await user.clear(input);
    await user.type(input, "hel");
    expect(global.fetch).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(
      await screen.findByRole("option", { name: /Electrodomésticos/ }),
    ).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(
      screen.getByRole("option", { name: "Heladera Whirlpool" }),
    ).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}");
    expect(
      screen.getByRole("option", { name: /Electrodomésticos/ }),
    ).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/electrodomesticos");
  });

  it("Escape cierra las sugerencias y vacío va a /buscar", async () => {
    global.fetch = jest.fn(async () =>
      jsonResponse({ queries: [{ text: "Moto Honda" }], categories: [] }),
    ) as jest.Mock;
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SearchBar />);
    const input = screen.getByRole("combobox", { name: "Buscar avisos" });
    await user.type(input, "s");
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.clear(input);
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/buscar");
  });
});
