import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";

import { MAX_PHOTO_BYTES } from "@/components/publish/photo-files";
import { PhotoManager } from "@/components/publish/photo-manager";
import type { ListingImage, OwnerListing } from "@/lib/types";
import { jsonResponse } from "@/test-utils/fetch";

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

function image(n: number, order = n): ListingImage {
  return {
    id: `img-${n}`,
    url: `http://localhost:9000/listings/img-${n}.webp`,
    thumb_url:
      n % 2 === 0 ? null : `http://localhost:9000/thumbs/img-${n}.webp`,
    width: 800,
    height: 600,
    is_primary: order === 0,
    display_order: order,
  };
}

function listing(images: ListingImage[] = []): OwnerListing {
  return {
    id: "lst-1",
    slug: "heladera",
    title: "Heladera Gafa",
    price: null,
    price_currency: "ARS",
    price_usd_ref: null,
    condition: null,
    department: "Capital",
    status: "draft",
    category_slug: "hogar",
    url_path: "/hogar/heladera",
    thumb_url: null,
    created_at: "2026-10-01T12:00:00Z",
    description: "Funciona perfecto",
    location: null,
    category: {
      id: "cat-hogar",
      parent_id: null,
      name: "Hogar",
      slug: "hogar",
      icon: null,
      display_order: 1,
    },
    images,
    seller: {
      id: "u1",
      username: "jorge",
      display_name: "Jorge",
      avatar_url: null,
      created_at: "2026-01-01T00:00:00Z",
    },
    fx_rate_at_publish: null,
    updated_at: "2026-10-01T12:00:00Z",
    expires_at: null,
    views_count: 0,
    contacts_count: 0,
  };
}

function photo(name: string, type = "image/jpeg", size?: number): File {
  const file = new File(["x"], name, { type });
  if (size !== undefined) Object.defineProperty(file, "size", { value: size });
  return file;
}

const onChange = jest.fn();

/** Mantiene el aviso en estado, como hace EditListing. */
function Harness({ initial }: { initial: OwnerListing }) {
  const [current, setCurrent] = React.useState(initial);
  return (
    <PhotoManager
      listing={current}
      onChange={(next) => {
        onChange(next);
        setCurrent(next);
      }}
    />
  );
}

const photoInput = () =>
  screen.getByLabelText(/fotos/i, { selector: "input[type=file]" });
const writes = () => calls.filter((c) => c.method !== "GET");

beforeEach(() => {
  onChange.mockReset();
});

describe("PhotoManager", () => {
  it("sin fotos invita a subir la primera", () => {
    mockApi(() => ({ body: {} }));
    render(<Harness initial={listing()} />);
    expect(screen.getByRole("heading", { name: "Fotos" })).toBeInTheDocument();
    expect(screen.getByText(/Tu aviso no tiene fotos/)).toBeInTheDocument();
    expect(screen.getByText(/Subí fotos/)).toBeInTheDocument();
    expect(screen.getByText(/0 de 10 fotos/)).toBeInTheDocument();
  });

  it("ordena las fotos por display_order y marca la portada", () => {
    mockApi(() => ({ body: {} }));
    render(<Harness initial={listing([image(2, 1), image(1, 0)])} />);
    const list = screen.getByRole("list", { name: "Fotos del aviso" });
    const imgs = within(list).getAllByRole("img");
    expect(imgs.map((i) => i.getAttribute("alt"))).toEqual([
      "Portada del aviso",
      "Foto 2",
    ]);
    expect(within(list).getByText("Portada")).toBeInTheDocument();
    expect(screen.getByText(/Sumá más fotos/)).toBeInTheDocument();
    // La portada no ofrece "Usar como portada".
    expect(
      screen.queryByRole("button", { name: "Usar como portada (foto 1)" }),
    ).toBeNull();
  });

  it("sube cada foto con FormData y avisa al terminar", async () => {
    let n = 0;
    mockApi(({ method, path }) => {
      if (method === "POST" && path === "/listings/lst-1/images") {
        n += 1;
        return {
          body: listing(Array.from({ length: n }, (_, i) => image(i + 1, i))),
        };
      }
      return { status: 404, body: { detail: "No" } };
    });
    const user = userEvent.setup();
    render(<Harness initial={listing()} />);

    await user.upload(photoInput(), [
      photo("frente.jpg"),
      photo("lado.png", "image/png"),
    ]);

    expect(await screen.findByText("Subimos 2 fotos.")).toBeInTheDocument();
    const posts = writes();
    expect(posts.map((c) => `${c.method} ${c.path}`)).toEqual([
      "POST /listings/lst-1/images",
      "POST /listings/lst-1/images",
    ]);
    const names = posts.map((c) => {
      const body = c.init.body as FormData;
      expect(body).toBeInstanceOf(FormData);
      return (body.get("files") as File).name;
    });
    expect(names).toEqual(["frente.jpg", "lado.png"]);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(
      within(
        screen.getByRole("list", { name: "Fotos del aviso" }),
      ).getAllByRole("img"),
    ).toHaveLength(2);
  });

  it("una sola foto usa el mensaje en singular", async () => {
    mockApi(() => ({ body: listing([image(1, 0)]) }));
    const user = userEvent.setup();
    render(<Harness initial={listing()} />);
    await user.upload(photoInput(), photo("frente.jpg"));
    expect(await screen.findByText("Subimos la foto.")).toBeInTheDocument();
  });

  it("rechaza fotos de más de 10 MB sin llamar a la API", async () => {
    mockApi(() => ({ body: {} }));
    const user = userEvent.setup();
    render(<Harness initial={listing()} />);
    await user.upload(
      photoInput(),
      photo("enorme.jpg", "image/jpeg", MAX_PHOTO_BYTES + 1),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      /«enorme.jpg» pesa .* hasta 10 MB/,
    );
    expect(calls).toHaveLength(0);
  });

  it("rechaza tipos no soportados", async () => {
    mockApi(() => ({ body: {} }));
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness initial={listing()} />);
    await user.upload(photoInput(), photo("doc.pdf", "application/pdf"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "«doc.pdf» no es una foto JPG, PNG o WEBP.",
    );
    expect(calls).toHaveLength(0);
  });

  it("respeta el máximo de 10: sube las que entran y avisa el resto", async () => {
    const nine = Array.from({ length: 9 }, (_, i) => image(i + 1, i));
    mockApi(() => ({ body: listing([...nine, image(10, 9)]) }));
    const user = userEvent.setup();
    render(<Harness initial={listing(nine)} />);

    await user.upload(photoInput(), [photo("a.jpg"), photo("b.jpg")]);
    expect(await screen.findByText("Subimos la foto.")).toBeInTheDocument();
    expect(writes()).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Podés subir hasta 10 fotos por aviso. Quedó 1 foto afuera.",
    );
    // Con 10 fotos el selector queda deshabilitado.
    expect(screen.getByText("Llegaste al máximo de fotos")).toBeInTheDocument();
    expect(photoInput()).toBeDisabled();
  });

  it("si falla la subida muestra el error junto a los rechazos", async () => {
    mockApi(() => ({ status: 503, body: { detail: "Storage caído" } }));
    const user = userEvent.setup();
    render(<Harness initial={listing()} />);
    await user.upload(photoInput(), [
      photo("a.jpg"),
      photo("enorme.jpg", "image/jpeg", MAX_PHOTO_BYTES + 1),
    ]);
    const alert = await screen.findByRole("alert");
    const items = within(alert).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Storage caído");
    expect(items[1]).toHaveTextContent(/«enorme.jpg» pesa/);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText(/Subimos/)).toBeNull();
  });

  it("elige portada con PUT del nuevo orden", async () => {
    const images = [image(1, 0), image(2, 1), image(3, 2)];
    mockApi(({ method, path }) => {
      if (method === "PUT" && path === "/listings/lst-1/images/order")
        return {
          body: listing([image(3, 0), image(1, 1), image(2, 2)]),
        };
      return { status: 404, body: { detail: "No" } };
    });
    const user = userEvent.setup();
    render(<Harness initial={listing(images)} />);

    await user.click(
      screen.getByRole("button", { name: "Usar como portada (foto 3)" }),
    );
    expect(
      await screen.findByText("Cambiamos la portada."),
    ).toBeInTheDocument();
    const [put] = writes();
    expect(`${put.method} ${put.path}`).toBe(
      "PUT /listings/lst-1/images/order",
    );
    expect(JSON.parse(String(put.init.body))).toEqual({
      image_ids: ["img-3", "img-1", "img-2"],
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("elimina una foto con DELETE", async () => {
    mockApi(({ method, path }) => {
      if (method === "DELETE" && path === "/listings/lst-1/images/img-2")
        return { body: listing([image(1, 0)]) };
      return { status: 404, body: { detail: "No" } };
    });
    const user = userEvent.setup();
    render(<Harness initial={listing([image(1, 0), image(2, 1)])} />);

    await user.click(screen.getByRole("button", { name: "Eliminar (foto 2)" }));
    expect(await screen.findByText("Eliminamos la foto.")).toBeInTheDocument();
    expect(writes().map((c) => `${c.method} ${c.path}`)).toEqual([
      "DELETE /listings/lst-1/images/img-2",
    ]);
    expect(
      within(
        screen.getByRole("list", { name: "Fotos del aviso" }),
      ).getAllByRole("img"),
    ).toHaveLength(1);
  });

  it("muestra el error si falla una acción y deshabilita mientras trabaja", async () => {
    let release: () => void = () => {};
    global.fetch = jest.fn(
      () =>
        new Promise<Response>((resolve) => {
          release = () =>
            resolve(jsonResponse({ detail: "No se pudo borrar" }, 500));
        }),
    ) as jest.Mock;
    const user = userEvent.setup();
    render(<Harness initial={listing([image(1, 0), image(2, 1)])} />);

    await user.click(screen.getByRole("button", { name: "Eliminar (foto 1)" }));
    expect(screen.getByText("Eliminando la foto…")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Eliminar (foto 2)" }),
    ).toBeDisabled();
    expect(photoInput()).toBeDisabled();

    release();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo borrar",
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Eliminar (foto 2)" }),
      ).toBeEnabled(),
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
