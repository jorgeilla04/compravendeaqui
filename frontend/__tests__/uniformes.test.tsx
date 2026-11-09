import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AuthProvider } from "@/components/auth/auth-provider";
import { AdminPanel } from "@/components/uniformes/admin/admin-panel";
import { Checkout, validateCliente } from "@/components/uniformes/checkout";
import {
  ColegioExplorer,
  filterColegios,
} from "@/components/uniformes/colegio-explorer";
import { Escudo } from "@/components/uniformes/escudo";
import { PedidoEstado, POLL_MS } from "@/components/uniformes/pedido-estado";
import { PrendaCard } from "@/components/uniformes/prenda-card";
import { PrendaIlustracion } from "@/components/uniformes/prenda-ilustracion";
import ColegioPage from "@/app/uniformes/[colegio]/page";
import UniformesPage from "@/app/uniformes/page";
import {
  CART_STORAGE_KEY,
  CartProvider,
  type CartItem,
} from "@/lib/uniformes/cart";
import { initials, readableText } from "@/lib/uniformes/color";
import { cotizar, pesosLabel } from "@/lib/uniformes/cotizar";
import type {
  Catalogo,
  ColegioDetalle,
  Pedido,
  PedidoAdmin,
  TiendaConfig,
} from "@/lib/uniformes/types";
import { mockApi } from "@/test-utils/api-mock";

const push = jest.fn();
let search = new URLSearchParams();
const notFound = jest.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => search,
  usePathname: () => "/uniformes",
  notFound: () => notFound(),
}));

const config: TiendaConfig = {
  envio_monto: 5000,
  express_recargo_pct: 20,
  sena_pct: 10,
  departamentos_envio: [
    "Capital",
    "Chimbas",
    "Pocito",
    "Rawson",
    "Rivadavia",
    "Santa Lucía",
  ],
  pagos_online: true,
  vendedora_nombre: "Virginia Tello",
  vendedora_whatsapp_url: "https://wa.me/5492645408193?text=hola",
  retiro_direccion: "Santiago del Estero Sur 1131, Capital",
};

const santaRosa = {
  slug: "santa-rosa",
  nombre: "Colegio Santa Rosa de Lima",
  departamento: "Capital",
  categoria: "parroquiales" as const,
  color1: "#1E3A8A",
  color2: "#FFFFFF",
  logo_url: null,
};

const catalogo: Catalogo = {
  categorias: [
    { slug: "parroquiales", nombre: "Parroquiales y confesionales" },
    { slug: "privados", nombre: "Privados laicos y bilingües" },
    { slug: "preuniversitarios", nombre: "Preuniversitarios (UNSJ)" },
  ],
  colegios: [
    santaRosa,
    {
      slug: "escuela-industrial",
      nombre: "Escuela Industrial Domingo F. Sarmiento",
      departamento: "Capital",
      categoria: "preuniversitarios",
      color1: "#0F172A",
      color2: "#FACC15",
      logo_url: "https://cdn.test/escudo.webp",
    },
    {
      slug: "bilingue",
      nombre: "Colegio Bilingüe Santa Lucía",
      departamento: "Santa Lucía",
      categoria: "privados",
      color1: "#FDE68A",
      color2: "#14532D",
      logo_url: null,
    },
  ],
  config,
};

const detalle: ColegioDetalle = {
  ...santaRosa,
  prendas: [
    {
      slug: "remera",
      nombre: "Remera / chomba",
      tipo: "remera",
      precio: "10000.00",
      talles: ["8", "10", "12"],
      foto_url: null,
    },
    {
      slug: "corbata",
      nombre: "Corbata",
      tipo: "corbata",
      precio: "6000.00",
      talles: ["Único"],
      foto_url: "https://cdn.test/corbata.webp",
    },
  ],
};

const remera: CartItem = {
  colegio: "santa-rosa",
  colegioNombre: "Colegio Santa Rosa de Lima",
  color1: "#1E3A8A",
  color2: "#FFFFFF",
  prenda: "remera",
  prendaNombre: "Remera / chomba",
  tipo: "remera",
  talle: "10",
  cantidad: 2,
  precio: 10000,
};

function pedido(overrides: Partial<Pedido> = {}): Pedido {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    codigo: "U-ABC234",
    estado: "pagado",
    envio: "estandar",
    modalidad_pago: "sena",
    subtotal: "20000.00",
    recargo_express: "0.00",
    envio_monto: "5000.00",
    total: "25000.00",
    pagado_ahora: "7000.00",
    saldo: "18000.00",
    items: [
      {
        colegio_nombre: "Colegio Santa Rosa de Lima",
        prenda_nombre: "Remera / chomba",
        talle: "10",
        cantidad: 2,
        precio_unit: "10000.00",
      },
    ],
    cliente_nombre: "María González",
    created_at: "2026-11-09T12:00:00Z",
    pagado_at: "2026-11-09T12:05:00Z",
    whatsapp_url: "https://wa.me/5492645408193?text=pedido",
    pago_url: null,
    ...overrides,
  };
}

function withCart(ui: React.ReactElement, items: CartItem[] = []) {
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  return render(<CartProvider>{ui}</CartProvider>);
}

beforeEach(() => {
  push.mockReset();
  notFound.mockClear();
  search = new URLSearchParams();
  window.localStorage.clear();
});

describe("cotizar (espejo del backend)", () => {
  it.each([
    ["estandar", "sena", [30000, 0, 5000, 35000, 8000, 27000]],
    ["estandar", "total", [30000, 0, 5000, 35000, 35000, 0]],
    ["express", "sena", [30000, 6000, 5000, 41000, 14000, 27000]],
    ["express", "total", [30000, 6000, 5000, 41000, 41000, 0]],
  ] as const)("%s / %s", (envio, modalidad, esperado) => {
    const t = cotizar(30000, envio, modalidad, config);
    expect([
      t.subtotal,
      t.recargoExpress,
      t.envioMonto,
      t.total,
      t.pagadoAhora,
      t.saldo,
    ]).toEqual(esperado);
  });

  it("redondea a pesos como el servidor", () => {
    const t = cotizar(10005, "express", "sena", config);
    expect(t.recargoExpress).toBe(2001);
    expect(t.pagadoAhora).toBe(1001 + 5000 + 2001);
    expect(pesosLabel(35000)).toBe("$ 35.000");
  });
});

describe("colores y escudo provisorio", () => {
  it("elige texto legible sobre el color del colegio", () => {
    expect(readableText("#1E3A8A")).toBe("#FFFFFF");
    expect(readableText("#FDE68A")).toBe("#0F172A");
    expect(readableText("rojo")).toBe("#FFFFFF");
  });

  it("arma las iniciales sin palabras de relleno", () => {
    expect(initials("Colegio Santa Rosa de Lima")).toBe("SRL");
    expect(initials("Escuela Industrial Domingo F. Sarmiento")).toBe("IDF");
    expect(initials("Colegio")).toBe("C");
  });

  it("muestra el escudo oficial si existe", () => {
    const { rerender } = render(<Escudo colegio={santaRosa} />);
    expect(screen.getByText("SRL")).toHaveAttribute("aria-hidden", "true");
    rerender(<Escudo colegio={catalogo.colegios[1]} size="sm" />);
    expect(
      screen.getByRole("img", {
        name: "Escudo de Escuela Industrial Domingo F. Sarmiento",
      }),
    ).toBeInTheDocument();
  });

  it.each([
    "remera",
    "pantalon",
    "jogging",
    "pollera",
    "corbata",
    "buzo",
    "campera",
    "bermuda",
    "otra",
  ])("dibuja %s con los colores del colegio", (tipo) => {
    const { container } = render(
      <PrendaIlustracion tipo={tipo} color1="#123456" color2="#ABCDEF" />,
    );
    expect(container.querySelector('[fill="#123456"]')).not.toBeNull();
  });
});

describe("catálogo de colegios", () => {
  it("filtra sin importar tildes y por departamento", () => {
    expect(
      filterColegios(catalogo.colegios, "santa lucia", null).map((c) => c.slug),
    ).toEqual(["bilingue"]);
    expect(
      filterColegios(catalogo.colegios, "capital", "parroquiales").map(
        (c) => c.slug,
      ),
    ).toEqual(["santa-rosa"]);
  });

  it("busca, filtra por categoría y agrupa", async () => {
    const user = userEvent.setup();
    render(<ColegioExplorer catalogo={catalogo} />);
    expect(
      screen.getByRole("heading", { name: "Parroquiales y confesionales" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Colegio Santa Rosa de Lima/ }),
    ).toHaveAttribute("href", "/uniformes/santa-rosa");

    await user.click(
      screen.getByRole("button", { name: "Privados laicos y bilingües" }),
    );
    expect(
      screen.getByRole("button", { name: "Privados laicos y bilingües" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByRole("link", { name: /Santa Rosa/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("1 colegio")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Todos" }));
    await user.type(screen.getByLabelText("Buscá tu colegio"), "inexistente");
    expect(
      screen.getByText(/No encontramos colegios con “inexistente”/),
    ).toBeVisible();
  });

  it("sin colegios cargados ofrece consultar por WhatsApp", () => {
    render(<ColegioExplorer catalogo={{ ...catalogo, colegios: [] }} />);
    expect(
      screen.getByRole("heading", { name: "Estamos cargando los colegios" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Consultar por WhatsApp" }),
    ).toHaveAttribute("href", config.vendedora_whatsapp_url);
  });

  it("la página de la tienda y la del colegio se arman con la API", async () => {
    mockApi({
      "GET /uniformes/catalogo": () => ({ status: 200, json: catalogo }),
      "GET /uniformes/colegios/santa-rosa": () => ({
        status: 200,
        json: detalle,
      }),
      "GET /uniformes/colegios/no-existe": () => ({
        status: 404,
        json: { detail: "x" },
      }),
    });
    render(await UniformesPage());
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "El uniforme de tu colegio, en tu casa",
      }),
    ).toBeVisible();
    expect(screen.getByText(/seña del 10%/)).toBeVisible();

    render(
      <CartProvider>
        {await ColegioPage({ params: { colegio: "santa-rosa" } })}
      </CartProvider>,
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Colegio Santa Rosa de Lima",
      }),
    ).toBeVisible();
    await expect(
      ColegioPage({ params: { colegio: "no-existe" } }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("si la API no responde, avisa", async () => {
    mockApi({
      "GET /uniformes/catalogo": () => ({ status: 500, json: { detail: "x" } }),
    });
    render(await UniformesPage());
    expect(screen.getByText(/No pudimos cargar la tienda/)).toBeVisible();
  });
});

describe("agregar prendas", () => {
  it("pide el talle, suma cantidades y guarda el carrito", async () => {
    const user = userEvent.setup();
    withCart(
      <ul>
        <PrendaCard colegio={detalle} prenda={detalle.prendas[0]} />
        <PrendaCard colegio={detalle} prenda={detalle.prendas[1]} />
      </ul>,
    );
    const [remeraBtn, corbataBtn] = screen.getAllByRole("button", {
      name: "Agregar al carrito",
    });
    await user.click(remeraBtn);
    expect(screen.getByText("Elegí el talle.")).toBeVisible();

    await user.selectOptions(screen.getByLabelText("Talle"), "10");
    await user.click(
      screen.getByRole("button", { name: "Una remera / chomba más" }),
    );
    await user.click(remeraBtn);
    expect(
      await screen.findByText(/Agregaste 2 remera \/ chomba talle 10/),
    ).toBeVisible();
    await user.click(remeraBtn);

    expect(screen.getByText("Talle único")).toBeVisible();
    expect(
      screen.getByRole("img", {
        name: "Corbata de Colegio Santa Rosa de Lima",
      }),
    ).toBeVisible();
    await user.click(corbataBtn);

    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]",
      );
      expect(
        saved.map((i: CartItem) => [i.prenda, i.talle, i.cantidad]),
      ).toEqual([
        ["remera", "10", 3],
        ["corbata", "Único", 1],
      ]);
    });
  });
});

describe("carrito y checkout", () => {
  it("con el carrito vacío lleva a elegir colegio", async () => {
    withCart(<Checkout config={config} />);
    expect(
      await screen.findByRole("heading", { name: "Tu carrito está vacío" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Elegir colegio" }),
    ).toHaveAttribute("href", "/uniformes");
  });

  it("calcula los totales según envío y pago", async () => {
    const user = userEvent.setup();
    withCart(<Checkout config={config} />, [remera]);
    const resumen = await screen.findByRole("complementary", {
      name: "Resumen",
    });
    expect(within(resumen).getByText("$ 20.000")).toBeVisible();
    expect(within(resumen).getByText("$ 25.000")).toBeVisible(); // total
    expect(within(resumen).getByText("$ 7.000")).toBeVisible(); // seña 2000 + envío
    expect(within(resumen).getByText("$ 18.000")).toBeVisible();

    await user.click(screen.getByRole("radio", { name: /Express 24 hs/ }));
    await user.click(screen.getByRole("radio", { name: /^Total/ }));
    expect(within(resumen).getByText("Express (+20%)")).toBeVisible();
    expect(
      within(resumen).getByRole("button", {
        name: "Pagar $ 29.000 con Mercado Pago",
      }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: "Una más de Remera / chomba talle 10",
      }),
    );
    expect(within(resumen).getByText("$ 30.000")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Quitar Remera / chomba talle 10" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Tu carrito está vacío" }),
    ).toBeVisible();
  });

  it("valida los datos de entrega", () => {
    expect(
      Object.keys(
        validateCliente({
          nombre: " ",
          telefono: "264",
          email: "x@",
          direccion: "a",
          departamento: "",
          notas: "",
        }),
      ),
    ).toEqual(["nombre", "telefono", "email", "direccion", "departamento"]);
  });

  it("manda el pedido y va a pagar a Mercado Pago", async () => {
    const user = userEvent.setup();
    const assign = jest.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign },
      writable: true,
    });
    const calls = mockApi({
      "POST /uniformes/pedidos": () => ({
        status: 201,
        json: {
          pedido: pedido({ estado: "pendiente_pago" }),
          init_point: "https://mp.test/pagar",
        },
      }),
    });
    withCart(<Checkout config={config} />, [remera]);
    const pagar = await screen.findByRole("button", { name: /Pagar \$ 7.000/ });
    await user.click(pagar);
    expect(screen.getByLabelText("Nombre y apellido")).toHaveFocus();
    expect(calls).toHaveLength(0);

    await user.type(
      screen.getByLabelText("Nombre y apellido"),
      "María González",
    );
    await user.type(screen.getByLabelText(/Celular/), "264 412-3456");
    await user.type(
      screen.getByLabelText("Dirección de entrega"),
      "Av. Libertador 1234",
    );
    await user.selectOptions(screen.getByLabelText("Departamento"), "Rawson");
    await user.click(pagar);

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("https://mp.test/pagar"),
    );
    expect(calls[0].body).toEqual({
      items: [
        { colegio: "santa-rosa", prenda: "remera", talle: "10", cantidad: 2 },
      ],
      envio: "estandar",
      modalidad_pago: "sena",
      cliente: {
        nombre: "María González",
        telefono: "264 412-3456",
        email: null,
        direccion: "Av. Libertador 1234",
        departamento: "Rawson",
        notas: null,
      },
    });
  });

  it("sin pagos online manda el pedido a la vendedora", async () => {
    const user = userEvent.setup();
    mockApi({
      "POST /uniformes/pedidos": () => ({
        status: 201,
        json: { pedido: pedido({ estado: "a_coordinar" }), init_point: null },
      }),
    });
    withCart(<Checkout config={{ ...config, pagos_online: false }} />, [
      remera,
    ]);
    await user.type(
      await screen.findByLabelText("Nombre y apellido"),
      "María González",
    );
    await user.type(screen.getByLabelText(/Celular/), "2644123456");
    await user.type(
      screen.getByLabelText("Dirección de entrega"),
      "Av. Libertador 1234",
    );
    await user.selectOptions(screen.getByLabelText("Departamento"), "Capital");
    await user.click(
      screen.getByRole("button", { name: "Enviar pedido a Virginia" }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        "/uniformes/pedido/11111111-1111-4111-8111-111111111111",
      ),
    );
  });

  it("muestra el error del servidor", async () => {
    const user = userEvent.setup();
    mockApi({
      "POST /uniformes/pedidos": () => ({
        status: 503,
        json: { detail: "No pudimos conectar con Mercado Pago." },
      }),
    });
    withCart(<Checkout config={config} />, [remera]);
    await user.type(
      await screen.findByLabelText("Nombre y apellido"),
      "María González",
    );
    await user.type(screen.getByLabelText(/Celular/), "2644123456");
    await user.type(
      screen.getByLabelText("Dirección de entrega"),
      "Av. Libertador 1234",
    );
    await user.selectOptions(screen.getByLabelText("Departamento"), "Capital");
    await user.click(screen.getByRole("button", { name: /Pagar/ }));
    expect(
      await screen.findByText("No pudimos conectar con Mercado Pago."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /Pagar/ })).toBeEnabled();
  });
});

describe("estado del pedido", () => {
  it("pagado: confirma, vacía el carrito y ofrece WhatsApp", async () => {
    search = new URLSearchParams({ payment_id: "987", status: "approved" });
    const calls = mockApi({
      "GET /uniformes/pedidos/11111111-1111-4111-8111-111111111111": () => ({
        status: 200,
        json: pedido(),
      }),
    });
    withCart(<PedidoEstado id="11111111-1111-4111-8111-111111111111" />, [
      remera,
    ]);
    expect(
      await screen.findByRole("heading", { name: "¡Listo! Recibimos tu pago" }),
    ).toBeVisible();
    expect(screen.getByText(/Pagaste la seña de \$ 7.000/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Escribir por WhatsApp" }),
    ).toHaveAttribute("href", "https://wa.me/5492645408193?text=pedido");
    expect(
      screen.getByRole("heading", { name: "Pedido U-ABC234" }),
    ).toBeVisible();
    await waitFor(() =>
      expect(window.localStorage.getItem(CART_STORAGE_KEY)).toBe("[]"),
    );
    expect(calls[0].key).toContain("/uniformes/pedidos/");
  });

  it("pendiente: vuelve a consultar hasta que se confirma", async () => {
    jest.useFakeTimers();
    search = new URLSearchParams({ payment_id: "987" });
    let estado: Pedido["estado"] = "pendiente_pago";
    mockApi({
      "GET /uniformes/pedidos/11111111-1111-4111-8111-111111111111": () => ({
        status: 200,
        json: pedido({
          estado,
          pago_url: estado === "pagado" ? null : "https://mp.test/p",
        }),
      }),
    });
    withCart(<PedidoEstado id="11111111-1111-4111-8111-111111111111" />);
    expect(
      await screen.findByRole("heading", {
        name: "Estamos confirmando tu pago",
      }),
    ).toBeVisible();
    estado = "pagado";
    await act(async () => {
      jest.advanceTimersByTime(POLL_MS);
    });
    expect(
      await screen.findByRole("heading", { name: "¡Listo! Recibimos tu pago" }),
    ).toBeVisible();
    jest.useRealTimers();
  });

  it("rechazado: ofrece probar de nuevo; a coordinar: avisa", async () => {
    mockApi({
      "GET /uniformes/pedidos/a": () => ({
        status: 200,
        json: pedido({ estado: "rechazado", pago_url: "https://mp.test/p" }),
      }),
      "GET /uniformes/pedidos/b": () => ({
        status: 200,
        json: pedido({ estado: "a_coordinar", modalidad_pago: "total" }),
      }),
      "GET /uniformes/pedidos/c": () => ({
        status: 200,
        json: pedido({ estado: "entregado" }),
      }),
      "GET /uniformes/pedidos/d": () => ({
        status: 404,
        json: { detail: "x" },
      }),
    });
    const { unmount } = withCart(<PedidoEstado id="a" />);
    expect(
      await screen.findByRole("heading", { name: "El pago no se aprobó" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Probar de nuevo" }),
    ).toHaveAttribute("href", "https://mp.test/p");
    unmount();
    const b = withCart(<PedidoEstado id="b" />);
    expect(
      await screen.findByRole("heading", { name: "Recibimos tu pedido" }),
    ).toBeVisible();
    b.unmount();
    const c = withCart(<PedidoEstado id="c" />);
    expect(
      await screen.findByRole("heading", { name: "Entregado" }),
    ).toBeVisible();
    c.unmount();
    withCart(<PedidoEstado id="d" />);
    expect(await screen.findByText(/No encontramos ese pedido/)).toBeVisible();
  });
});

describe("administración", () => {
  const adminPedido: PedidoAdmin = {
    ...pedido({ estado: "a_coordinar" }),
    cliente_tel: "+5492644123456",
    cliente_email: "maria@gmail.com",
    direccion: "Av. Libertador 1234",
    departamento: "Capital",
    notas: "Timbre 2",
    mp_payment_id: null,
    notificado_at: null,
    cliente_whatsapp_url: "https://wa.me/5492644123456?text=hola",
  };
  const adminCatalogo = {
    colegios: [{ ...santaRosa, activo: true }],
    prendas: [
      {
        slug: "remera",
        nombre: "Remera / chomba",
        tipo: "remera",
        precio_base: "10000.00",
        talles: ["10"],
        foto_url: null,
        activo: true,
      },
    ],
    precios: [],
  };

  function renderAdmin() {
    return render(
      <AuthProvider>
        <AdminPanel />
      </AuthProvider>,
    );
  }

  it("sin rol de admin lo explica", async () => {
    mockApi({
      "GET /auth/me": () => ({ status: 401, json: { detail: "x" } }),
      "GET /admin/uniformes/catalogo": () => ({
        status: 403,
        json: { detail: "Solo administradores" },
      }),
    });
    renderAdmin();
    expect(await screen.findByText(/solo para administradores/)).toBeVisible();
  });

  it("gestiona pedidos, colegios y precios", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /auth/me": () => ({ status: 401, json: { detail: "x" } }),
      "GET /admin/uniformes/catalogo": () => ({
        status: 200,
        json: adminCatalogo,
      }),
      "GET /admin/uniformes/pedidos": () => ({
        status: 200,
        json: [adminPedido],
      }),
      [`PUT /admin/uniformes/pedidos/${adminPedido.id}`]: (body) => ({
        status: 200,
        json: { ...adminPedido, ...(body as object) },
      }),
      "POST /admin/uniformes/colegios": (body) => ({
        status: 201,
        json: { ...(body as object), slug: "nuevo", logo_url: null },
      }),
      "PUT /admin/uniformes/prendas/remera": (body) => ({
        status: 200,
        json: {
          ...adminCatalogo.prendas[0],
          precio_base: (body as { precio_base: string }).precio_base,
        },
      }),
      "PUT /admin/uniformes/precios": (body) => ({ status: 200, json: body }),
    });
    renderAdmin();

    expect(
      await screen.findByRole("heading", { name: /U-ABC234 · María González/ }),
    ).toBeVisible();
    expect(screen.getByText("Av. Libertador 1234, Capital")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "WhatsApp al cliente" }),
    ).toHaveAttribute("href", adminPedido.cliente_whatsapp_url);
    await user.selectOptions(
      screen.getByLabelText("Cambiar estado"),
      "entregado",
    );
    await user.click(screen.getByRole("button", { name: "Guardar estado" }));
    await waitFor(() =>
      expect(
        calls.find((c) => c.key.startsWith("PUT /admin/uniformes/pedidos"))
          ?.body,
      ).toEqual({
        estado: "entregado",
      }),
    );

    await user.click(screen.getByRole("button", { name: "Colegios" }));
    const nuevo = screen.getByRole("region", { name: "Agregar colegio" });
    await user.type(
      within(nuevo).getByLabelText("Nombre del colegio"),
      "Colegio Nuevo",
    );
    await user.click(
      within(nuevo).getByRole("button", { name: "Agregar colegio" }),
    );
    expect(await screen.findByText("2 colegios")).toBeVisible();
    expect(
      calls.find((c) => c.key === "POST /admin/uniformes/colegios")?.body,
    ).toMatchObject({
      nombre: "Colegio Nuevo",
      departamento: "Capital",
      categoria: "parroquiales",
    });

    await user.click(screen.getByRole("button", { name: "Precios y fotos" }));
    const base = screen.getByLabelText("Precio base ($)");
    await user.clear(base);
    await user.type(base, "12500");
    await user.click(screen.getAllByRole("button", { name: "Guardar" })[0]);
    expect(await screen.findByText("Guardado.")).toBeVisible();
    await user.type(
      screen.getByLabelText("Precio de Remera / chomba"),
      "15000",
    );
    await user.click(screen.getAllByRole("button", { name: "Guardar" })[1]);
    await waitFor(() =>
      expect(
        calls.find((c) => c.key === "PUT /admin/uniformes/precios")?.body,
      ).toEqual({
        colegio: "santa-rosa",
        prenda: "remera",
        precio: "15000",
        disponible: true,
      }),
    );
  });
});
