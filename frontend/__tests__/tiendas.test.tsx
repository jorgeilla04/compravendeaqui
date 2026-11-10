import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AuthProvider } from "@/components/auth/auth-provider";
import { TiendaAdminPanel } from "@/components/tiendas/admin/admin-panel";
import { ejemploExpress } from "@/components/tiendas/admin/config-admin";
import { MisTiendas } from "@/components/tiendas/admin/mis-tiendas";
import { parseOpciones } from "@/components/tiendas/admin/productos-admin";
import {
  Checkout,
  entregaTextos,
  validateCliente,
} from "@/components/tiendas/checkout";
import {
  filterGrupos,
  GrupoExplorer,
} from "@/components/tiendas/grupo-explorer";
import { DemoPago } from "@/components/tiendas/demo-pago";
import { GrupoLogo } from "@/components/tiendas/grupo-logo";
import { PedidoEstado, POLL_MS } from "@/components/tiendas/pedido-estado";
import { ProductoCard } from "@/components/tiendas/producto-card";
import { ProductoIlustracion } from "@/components/tiendas/producto-ilustracion";
import GrupoPage from "@/app/tiendas/[tienda]/[grupo]/page";
import TiendaPage from "@/app/tiendas/[tienda]/page";
import TiendasPage from "@/app/tiendas/page";
import {
  CartProvider,
  cartStorageKey,
  type CartItem,
} from "@/lib/tiendas/cart";
import { initials, readableText } from "@/lib/tiendas/color";
import { condiciones } from "@/lib/tiendas/condiciones";
import { cotizar, pesosLabel } from "@/lib/tiendas/cotizar";
import type {
  CatalogoAdmin,
  GrupoDetalle,
  Pedido,
  PedidoAdmin,
  Tienda,
  TiendaAdmin,
} from "@/lib/tiendas/types";
import type { Me } from "@/lib/types";
import { mockApi } from "@/test-utils/api-mock";

const push = jest.fn();
let search = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => search,
  usePathname: () => "/tiendas",
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const santaRosa = {
  slug: "santa-rosa",
  nombre: "Colegio Santa Rosa de Lima",
  subtitulo: "Capital",
  categoria: "Parroquiales y confesionales",
  color1: "#1E3A8A",
  color2: "#FFFFFF",
  logo_url: null,
};

const uniformes: Tienda = {
  slug: "uniformes",
  nombre: "Uniformes escolares",
  descripcion: "El uniforme de tu colegio con envío a tu casa.",
  grupo_label: "Colegio",
  opcion_label: "Talle",
  categorias: [
    "Parroquiales y confesionales",
    "Privados laicos y bilingües",
    "Preuniversitarios (UNSJ)",
  ],
  vendedor_nombre: "Virginia Tello",
  whatsapp_url: "https://wa.me/5492645408193?text=hola",
  entregas: ["estandar", "express"],
  modalidades: ["sena", "total"],
  envio_monto: "5000.00",
  envio_gratis_desde: null,
  envio_demora: "48 hs",
  departamentos_envio: ["Capital", "Rawson"],
  express_recargo_pct: 20,
  express_monto: "0.00",
  express_demora: "24 hs",
  retiro_direccion: null,
  sena_pct: 10,
  pagos_online: true,
  grupos: [
    santaRosa,
    {
      slug: "industrial",
      nombre: "Escuela Industrial Domingo F. Sarmiento",
      subtitulo: "Capital",
      categoria: "Preuniversitarios (UNSJ)",
      color1: "#0F172A",
      color2: "#FACC15",
      logo_url: "https://cdn.test/escudo.webp",
    },
    {
      slug: "bilingue",
      nombre: "Colegio Bilingüe Santa Lucía",
      subtitulo: "Santa Lucía",
      categoria: "Privados laicos y bilingües",
      color1: "#FDE68A",
      color2: "#14532D",
      logo_url: null,
    },
  ],
};

const libreria: Tienda = {
  ...uniformes,
  slug: "libreria",
  nombre: "Librería El Estudiante",
  grupo_label: "Lista",
  opcion_label: "Color",
  categorias: [],
  vendedor_nombre: "Laura Pérez",
  entregas: ["estandar", "retiro"],
  modalidades: ["total"],
  envio_monto: "0.00",
  retiro_direccion: "Mitre 100 (E), Capital",
  pagos_online: false,
  grupos: [
    {
      ...santaRosa,
      slug: "primer-grado",
      nombre: "1er grado",
      categoria: null,
      subtitulo: null,
    },
  ],
};

const detalle: GrupoDetalle = {
  ...santaRosa,
  fotos: [],
  productos: [
    {
      slug: "remera",
      nombre: "Remera / chomba",
      descripcion: null,
      tipo: "remera",
      precio: "10000.00",
      opciones: ["8", "10", "12"],
      foto_url: null,
    },
    {
      slug: "corbata",
      nombre: "Corbata",
      descripcion: "Con el escudo bordado",
      tipo: "corbata",
      precio: "6000.00",
      opciones: [],
      foto_url: "https://cdn.test/corbata.webp",
    },
  ],
};

const remera: CartItem = {
  grupo: "santa-rosa",
  grupoNombre: "Colegio Santa Rosa de Lima",
  color1: "#1E3A8A",
  color2: "#FFFFFF",
  producto: "remera",
  productoNombre: "Remera / chomba",
  tipo: "remera",
  fotoUrl: null,
  opcion: "10",
  cantidad: 2,
  precio: 10000,
};

const PEDIDO_ID = "11111111-1111-4111-8111-111111111111";

function pedido(overrides: Partial<Pedido> = {}): Pedido {
  return {
    id: PEDIDO_ID,
    codigo: "P-ABC234",
    tienda: {
      slug: "uniformes",
      nombre: "Uniformes escolares",
      descripcion: null,
    },
    opcion_label: "Talle",
    estado: "pagado",
    entrega: "estandar",
    entrega_label: "Envío a domicilio (48 hs)",
    modalidad_pago: "sena",
    subtotal: "20000.00",
    envio_monto: "5000.00",
    recargo_express: "0.00",
    total: "25000.00",
    pagado_ahora: "7000.00",
    saldo: "18000.00",
    items: [
      {
        grupo_nombre: "Colegio Santa Rosa de Lima",
        producto_nombre: "Remera / chomba",
        opcion: "10",
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

function withCart(
  ui: React.ReactElement,
  items: CartItem[] = [],
  tienda = "uniformes",
) {
  window.localStorage.setItem(cartStorageKey(tienda), JSON.stringify(items));
  return render(<CartProvider tienda={tienda}>{ui}</CartProvider>);
}

beforeEach(() => {
  push.mockReset();
  search = new URLSearchParams();
  window.localStorage.clear();
});

describe("cotizar con la config de cada tienda", () => {
  it.each([
    ["estandar", "sena", [30000, 5000, 0, 35000, 8000, 27000]],
    ["estandar", "total", [30000, 5000, 0, 35000, 35000, 0]],
    // Express: el envío fijo + 20% de los productos.
    ["express", "sena", [30000, 5000, 6000, 41000, 14000, 27000]],
    ["express", "total", [30000, 5000, 6000, 41000, 41000, 0]],
    ["retiro", "sena", [30000, 0, 0, 30000, 3000, 27000]],
  ] as const)("uniformes: %s / %s", (entrega, modalidad, esperado) => {
    const t = cotizar(30000, entrega, modalidad, uniformes);
    expect([
      t.subtotal,
      t.envioMonto,
      t.recargoExpress,
      t.total,
      t.pagadoAhora,
      t.saldo,
    ]).toEqual(esperado);
  });

  it("envío gratis, gratis desde, recargo fijo y redondeo", () => {
    expect(
      cotizar(30000, "estandar", "total", { ...uniformes, envio_monto: "0" })
        .total,
    ).toBe(30000);
    const desde = { ...uniformes, envio_gratis_desde: "25000.00" };
    expect(cotizar(30000, "estandar", "total", desde).envioMonto).toBe(0);
    expect(cotizar(20000, "estandar", "total", desde).envioMonto).toBe(5000);
    const fijo = {
      ...uniformes,
      express_recargo_pct: 0,
      express_monto: "3000",
    };
    expect(cotizar(30000, "express", "total", fijo).total).toBe(38000);
    const t = cotizar(10005, "express", "sena", uniformes);
    expect([t.recargoExpress, t.pagadoAhora]).toEqual([
      2001,
      1001 + 5000 + 2001,
    ]);
    expect(pesosLabel(35000)).toBe("$ 35.000");
  });

  it("explica las condiciones de la tienda", () => {
    expect(condiciones(uniformes)).toEqual([
      "Envío a domicilio: $ 5.000, en 48 hs.",
      "Express en 24 hs.",
      "Pagás una seña del 10% (o el total) y el resto cuando lo recibís.",
    ]);
    expect(condiciones(libreria)).toEqual([
      "Envío sin cargo en 48 hs.",
      "Retiro sin cargo en Mitre 100 (E), Capital.",
      "Pagás el total al hacer el pedido.",
    ]);
    expect(
      condiciones({
        ...uniformes,
        envio_gratis_desde: "60000",
        modalidades: ["sena"],
      })[0],
    ).toBe("Envío a domicilio: $ 5.000, en 48 hs (gratis desde $ 60.000).");
  });

  it("textos de entrega con la config", () => {
    expect(entregaTextos(uniformes, "express", 30000)).toEqual({
      title: "Express 24 hs · $ 11.000",
      detail: "Envío ($ 5.000) más 20% de los productos.",
    });
    expect(entregaTextos(libreria, "estandar", 1000).title).toBe(
      "A domicilio 48 hs · sin cargo",
    );
    expect(entregaTextos(libreria, "retiro", 1000)).toEqual({
      title: "Retiro en el local · sin cargo",
      detail: "Mitre 100 (E), Capital",
    });
    expect(
      entregaTextos(
        { ...uniformes, envio_gratis_desde: "50000" },
        "estandar",
        1000,
      ).detail,
    ).toContain("Gratis desde $ 50.000");
  });
});

describe("colores, logos y dibujos", () => {
  it("texto legible e iniciales", () => {
    expect(readableText("#1E3A8A")).toBe("#FFFFFF");
    expect(readableText("#FDE68A")).toBe("#0F172A");
    expect(initials("Colegio Santa Rosa de Lima")).toBe("SRL");
  });

  it("logo oficial o provisorio", () => {
    const { rerender } = render(<GrupoLogo grupo={santaRosa} />);
    expect(screen.getByText("SRL")).toHaveAttribute("aria-hidden", "true");
    rerender(<GrupoLogo grupo={uniformes.grupos[1]} size="sm" />);
    expect(
      screen.getByRole("img", {
        name: "Logo de Escuela Industrial Domingo F. Sarmiento",
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
    "generico",
  ])("dibuja %s con los colores del grupo", (tipo) => {
    const { container } = render(
      <ProductoIlustracion tipo={tipo} color1="#123456" color2="#ABCDEF" />,
    );
    expect(container.querySelector('[fill="#123456"]')).not.toBeNull();
  });
});

describe("catálogo", () => {
  it("filtra sin tildes", () => {
    expect(
      filterGrupos(uniformes.grupos, "santa lucia", null).map((g) => g.slug),
    ).toEqual(["bilingue"]);
  });

  it("busca y filtra por categoría de la tienda", async () => {
    const user = userEvent.setup();
    render(<GrupoExplorer tienda={uniformes} />);
    expect(screen.getByLabelText("Buscá tu colegio")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /Colegio Santa Rosa de Lima/ }),
    ).toHaveAttribute("href", "/tiendas/uniformes/santa-rosa");
    await user.click(
      screen.getByRole("button", { name: "Privados laicos y bilingües" }),
    );
    expect(
      screen.queryByRole("link", { name: /Santa Rosa/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Todos" }));
    await user.type(screen.getByLabelText("Buscá tu colegio"), "inexistente");
    expect(screen.getByText(/No encontramos “inexistente”/)).toBeVisible();
  });

  it("tienda sin categorías ni grupos", () => {
    const { rerender } = render(<GrupoExplorer tienda={libreria} />);
    expect(screen.getByLabelText("Buscá tu lista")).toBeVisible();
    expect(
      screen.queryByRole("group", { name: "Filtrar por categoría" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /1er grado/ })).toHaveAttribute(
      "href",
      "/tiendas/libreria/primer-grado",
    );
    rerender(<GrupoExplorer tienda={{ ...libreria, grupos: [] }} />);
    expect(
      screen.getByRole("heading", { name: "Estamos cargando el catálogo" }),
    ).toBeVisible();
  });

  it("las páginas se arman con la API", async () => {
    mockApi({
      "GET /tiendas": () => ({ status: 200, json: [uniformes, libreria] }),
      "GET /tiendas/uniformes": () => ({ status: 200, json: uniformes }),
      "GET /tiendas/uniformes/grupos/santa-rosa": () => ({
        status: 200,
        json: detalle,
      }),
      "GET /tiendas/uniformes/grupos/no": () => ({
        status: 404,
        json: { detail: "x" },
      }),
    });
    render(await TiendasPage());
    expect(
      screen.getByRole("link", { name: /Librería El Estudiante/ }),
    ).toHaveAttribute("href", "/tiendas/libreria");
    render(await TiendaPage({ params: { tienda: "uniformes" } }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Uniformes escolares" }),
    ).toBeVisible();
    expect(screen.getByText("Express en 24 hs.")).toBeVisible();
    render(
      <CartProvider tienda="uniformes">
        {await GrupoPage({
          params: { tienda: "uniformes", grupo: "santa-rosa" },
        })}
      </CartProvider>,
    );
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Colegio Santa Rosa de Lima",
      }),
    ).toBeVisible();
    await expect(
      GrupoPage({ params: { tienda: "uniformes", grupo: "no" } }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("si la API no responde, avisa", async () => {
    mockApi({ "GET /tiendas": () => ({ status: 500, json: { detail: "x" } }) });
    render(await TiendasPage());
    expect(screen.getByText(/No pudimos cargar las tiendas/)).toBeVisible();
  });
});

describe("agregar productos", () => {
  it("pide la opción, suma cantidades y guarda el carrito de esa tienda", async () => {
    const user = userEvent.setup();
    withCart(
      <ul>
        <ProductoCard
          grupo={detalle}
          producto={detalle.productos[0]}
          opcionLabel="Talle"
        />
        <ProductoCard
          grupo={detalle}
          producto={detalle.productos[1]}
          opcionLabel="Talle"
        />
      </ul>,
    );
    const [remeraBtn, corbataBtn] = screen.getAllByRole("button", {
      name: "Agregar al carrito",
    });
    await user.click(remeraBtn);
    expect(screen.getByText("Elegí talle.")).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Talle"), "10");
    await user.click(
      screen.getByRole("button", { name: "Una remera / chomba más" }),
    );
    await user.click(remeraBtn);
    expect(
      await screen.findByText(/Agregaste 2 remera \/ chomba talle 10/),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver carrito" })).toHaveAttribute(
      "href",
      "/tiendas/uniformes/carrito",
    );
    await user.click(remeraBtn);
    expect(screen.getByText("Con el escudo bordado")).toBeVisible();
    await user.click(corbataBtn);
    await waitFor(() => {
      const saved = JSON.parse(
        window.localStorage.getItem(cartStorageKey("uniformes")) ?? "[]",
      );
      expect(
        saved.map((i: CartItem) => [i.producto, i.opcion, i.cantidad]),
      ).toEqual([
        ["remera", "10", 3],
        ["corbata", null, 1],
      ]);
    });
    // Cada tienda tiene su carrito.
    expect(window.localStorage.getItem(cartStorageKey("libreria"))).toBeNull();
  });
});

describe("carrito y checkout", () => {
  it("vacío lleva al catálogo de la tienda", async () => {
    withCart(<Checkout tienda={uniformes} />);
    expect(
      await screen.findByRole("heading", { name: "Tu carrito está vacío" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Ver el catálogo" }),
    ).toHaveAttribute("href", "/tiendas/uniformes");
  });

  it("calcula los totales según entrega y pago", async () => {
    const user = userEvent.setup();
    withCart(<Checkout tienda={uniformes} />, [remera]);
    const resumen = await screen.findByRole("complementary", {
      name: "Resumen",
    });
    expect(within(resumen).getByText("$ 25.000")).toBeVisible();
    expect(within(resumen).getByText("$ 7.000")).toBeVisible();
    await user.click(screen.getByRole("radio", { name: /Express 24 hs/ }));
    await user.click(screen.getByRole("radio", { name: /^Total/ }));
    expect(within(resumen).getByText("$ 4.000")).toBeVisible(); // express 20%
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

  it("valida los datos (sin dirección si retira)", () => {
    const vacio = {
      nombre: " ",
      telefono: "264",
      email: "x@",
      direccion: "a",
      departamento: "",
      notas: "",
    };
    expect(Object.keys(validateCliente(vacio))).toEqual([
      "nombre",
      "telefono",
      "email",
      "direccion",
      "departamento",
    ]);
    expect(Object.keys(validateCliente(vacio, false))).toEqual([
      "nombre",
      "telefono",
      "email",
    ]);
  });

  it("manda el pedido y va a pagar a Mercado Pago", async () => {
    const user = userEvent.setup();
    const assign = jest.fn();
    Object.defineProperty(window, "location", {
      value: { ...window.location, assign },
      writable: true,
    });
    const calls = mockApi({
      "POST /tiendas/uniformes/pedidos": () => ({
        status: 201,
        json: {
          pedido: pedido({ estado: "pendiente_pago" }),
          init_point: "https://mp.test/pagar",
        },
      }),
    });
    withCart(<Checkout tienda={uniformes} />, [remera]);
    const pagar = await screen.findByRole("button", { name: /Pagar \$ 7.000/ });
    await user.click(pagar);
    expect(screen.getByLabelText("Nombre y apellido")).toHaveFocus();
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
        { grupo: "santa-rosa", producto: "remera", opcion: "10", cantidad: 2 },
      ],
      entrega: "estandar",
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

  it("retiro en el local, solo pago total y sin Mercado Pago", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "POST /tiendas/libreria/pedidos": () => ({
        status: 201,
        json: { pedido: pedido({ estado: "a_coordinar" }), init_point: null },
      }),
    });
    withCart(
      <Checkout tienda={libreria} />,
      [{ ...remera, opcion: null }],
      "libreria",
    );
    await user.click(
      await screen.findByRole("radio", { name: /Retiro en el local/ }),
    );
    expect(
      screen.queryByLabelText("Dirección de entrega"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("radio", { name: /Seña/ }),
    ).not.toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Nombre y apellido"),
      "María González",
    );
    await user.type(screen.getByLabelText(/Celular/), "2644123456");
    await user.click(
      screen.getByRole("button", { name: "Enviar pedido a Laura" }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(`/tiendas/pedido/${PEDIDO_ID}`),
    );
    expect(calls[0].body).toMatchObject({
      entrega: "retiro",
      modalidad_pago: "total",
      cliente: { direccion: null, departamento: null },
    });
  });

  it("muestra el error del servidor", async () => {
    const user = userEvent.setup();
    mockApi({
      "POST /tiendas/uniformes/pedidos": () => ({
        status: 503,
        json: { detail: "No pudimos conectar con Mercado Pago." },
      }),
    });
    withCart(<Checkout tienda={uniformes} />, [remera]);
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
  });
});

describe("estado del pedido", () => {
  const url = `GET /tiendas/pedidos/${PEDIDO_ID}`;

  it("pagado: confirma y vacía el carrito de esa tienda", async () => {
    search = new URLSearchParams({ payment_id: "987", status: "approved" });
    window.localStorage.setItem(
      cartStorageKey("uniformes"),
      JSON.stringify([remera]),
    );
    const calls = mockApi({ [url]: () => ({ status: 200, json: pedido() }) });
    render(<PedidoEstado id={PEDIDO_ID} />);
    expect(
      await screen.findByRole("heading", { name: "¡Listo! Recibimos tu pago" }),
    ).toBeVisible();
    expect(screen.getByText(/Pagaste la seña de \$ 7.000/)).toBeVisible();
    expect(screen.getByText(/2 × Remera \/ chomba talle 10/)).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Volver a la tienda" }),
    ).toHaveAttribute("href", "/tiendas/uniformes");
    await waitFor(() =>
      expect(window.localStorage.getItem(cartStorageKey("uniformes"))).toBe(
        "[]",
      ),
    );
    expect(calls[0].key).toBe(url);
  });

  it("un id que no es de pedido ni llega a la API", async () => {
    const calls = mockApi({});
    render(<PedidoEstado id="../../users/me" />);
    expect(await screen.findByText(/No encontramos ese pedido/)).toBeVisible();
    expect(calls).toHaveLength(0);
  });

  it("pendiente: vuelve a consultar hasta que se confirma", async () => {
    jest.useFakeTimers();
    search = new URLSearchParams({ payment_id: "987" });
    let estado: Pedido["estado"] = "pendiente_pago";
    mockApi({
      [url]: () => ({
        status: 200,
        json: pedido({
          estado,
          pago_url: estado === "pagado" ? null : "https://mp.test/p",
        }),
      }),
    });
    render(<PedidoEstado id={PEDIDO_ID} />);
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

  it("rechazado ofrece reintentar; a coordinar avisa; 404", async () => {
    let json: Pedido | null = pedido({
      estado: "rechazado",
      pago_url: "https://mp.test/p",
    });
    mockApi({
      [url]: () =>
        json ? { status: 200, json } : { status: 404, json: { detail: "x" } },
    });
    const a = render(<PedidoEstado id={PEDIDO_ID} />);
    expect(
      await screen.findByRole("heading", { name: "El pago no se aprobó" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Probar de nuevo" }),
    ).toHaveAttribute("href", "https://mp.test/p");
    a.unmount();
    json = pedido({ estado: "a_coordinar", modalidad_pago: "total" });
    const b = render(<PedidoEstado id={PEDIDO_ID} />);
    expect(
      await screen.findByRole("heading", { name: "Recibimos tu pedido" }),
    ).toBeVisible();
    b.unmount();
    json = pedido({ estado: "entregado" });
    const c = render(<PedidoEstado id={PEDIDO_ID} />);
    expect(
      await screen.findByRole("heading", { name: "Entregado" }),
    ).toBeVisible();
    c.unmount();
    json = null;
    render(<PedidoEstado id={PEDIDO_ID} />);
    expect(await screen.findByText(/No encontramos ese pedido/)).toBeVisible();
  });
});

describe("administración de tiendas", () => {
  const tiendaAdmin: TiendaAdmin = {
    slug: "uniformes",
    nombre: "Uniformes escolares",
    descripcion: null,
    grupo_label: "Colegio",
    opcion_label: "Talle",
    categorias: ["Parroquiales y confesionales"],
    productos_en_todos: true,
    activo: true,
    vendedor_nombre: "Virginia Tello",
    vendedor_email: "virginialauratello@gmail.com",
    vendedor_whatsapp: "+5492645408193",
    envio_habilitado: true,
    envio_monto: "5000.00",
    envio_gratis_desde: null,
    envio_demora: "48 hs",
    departamentos_envio: ["Capital"],
    express_habilitado: true,
    express_recargo_pct: 20,
    express_monto: "0.00",
    express_demora: "24 hs",
    retiro_habilitado: false,
    retiro_direccion: null,
    sena_habilitada: true,
    sena_pct: 10,
    total_habilitado: true,
  };
  const catalogo: CatalogoAdmin = {
    tienda: tiendaAdmin,
    grupos: [{ ...santaRosa, activo: true, fotos: [] }],
    productos: [
      {
        slug: "remera",
        nombre: "Remera / chomba",
        descripcion: null,
        tipo: "remera",
        precio_base: "10000.00",
        opciones: ["10"],
        foto_url: null,
        orden: 0,
        activo: true,
      },
    ],
    precios: [],
  };
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
  const me = (role: string): Me =>
    ({
      id: "u1",
      username: "jorge",
      display_name: "Jorge",
      avatar_url: null,
      created_at: "2026-01-01T00:00:00Z",
      phone_masked: "+54 9 264 ***-0000",
      phone_verified: false,
      email: "illanezjorgea@gmail.com",
      email_verified: true,
      full_name: "Jorge",
      role,
      whatsapp_optin: true,
      profile_pending: false,
      has_password: false,
    }) as Me;

  function renderPanel() {
    return render(
      <AuthProvider>
        <TiendaAdminPanel slug="uniformes" />
      </AuthProvider>,
    );
  }

  it("helpers", () => {
    expect(parseOpciones(" S, M ,, L ")).toEqual(["S", "M", "L"]);
    expect(
      ejemploExpress({
        ...tiendaAdmin,
        envio_monto: "5000",
        express_monto: "0",
      }),
    ).toBe(
      "Con $ 30.000 en productos, el express cuesta $ 11.000 (envío $ 5.000 + $ 6.000).",
    );
  });

  it("si no administra la tienda lo dice", async () => {
    mockApi({
      "GET /auth/me": () => ({ status: 200, json: me("user") }),
      "GET /admin/tiendas/uniformes/catalogo": () => ({
        status: 404,
        json: { detail: "x" },
      }),
    });
    renderPanel();
    expect(
      await screen.findByText("No administrás esta tienda."),
    ).toBeVisible();
  });

  it("edita un colegio en una ventana con pestañas", async () => {
    const user = userEvent.setup();
    const base = "/admin/tiendas/uniformes/grupos/santa-rosa";
    const calls = mockApi({
      "GET /auth/me": () => ({ status: 200, json: me("user") }),
      "GET /admin/tiendas/uniformes/catalogo": () => ({
        status: 200,
        json: {
          ...catalogo,
          grupos: [
            ...catalogo.grupos,
            {
              ...santaRosa,
              slug: "san-pablo",
              nombre: "Colegio San Pablo",
              subtitulo: "Rivadavia",
              activo: true,
              fotos: [],
            },
          ],
        },
      }),
      "GET /admin/tiendas/uniformes/pedidos": () => ({ status: 200, json: [] }),
      [`POST ${base}/fotos`]: () => ({
        status: 200,
        json: {
          ...catalogo.grupos[0],
          fotos: ["https://cdn.test/uniforme.webp"],
        },
      }),
      [`DELETE ${base}/fotos/0`]: () => ({
        status: 200,
        json: { ...catalogo.grupos[0], fotos: [] },
      }),
      [`POST ${base}/productos/remera/foto`]: () => ({
        status: 200,
        json: {
          grupo: "santa-rosa",
          producto: "remera",
          precio: null,
          disponible: true,
          foto_url: "https://cdn.test/remera-sr.webp",
        },
      }),
      "PUT /admin/tiendas/uniformes/precios": (body) => ({
        status: 200,
        json: { ...(body as object), foto_url: null },
      }),
    });
    renderPanel();
    await user.click(await screen.findByRole("button", { name: "Colegios" }));

    // El buscador achica la lista.
    const buscar = screen.getByLabelText("Buscar colegio");
    await user.type(buscar, "rivadavia");
    expect(screen.getByRole("status")).toHaveTextContent("1 de 2");
    expect(
      screen.queryByText("Colegio Santa Rosa de Lima"),
    ).not.toBeInTheDocument();
    await user.clear(buscar);
    await user.type(buscar, "zzz");
    expect(screen.getByRole("status")).toHaveTextContent(
      'Ningún colegio coincide con "zzz".',
    );
    await user.clear(buscar);

    await user.click(
      screen.getByRole("button", { name: /Colegio Santa Rosa de Lima/ }),
    );
    const ventana = screen.getByRole("dialog", {
      name: "Colegio Santa Rosa de Lima",
    });
    expect(
      within(ventana).getByRole("tab", { name: "Datos y fotos" }),
    ).toHaveAttribute("aria-selected", "true");

    const archivo = new File(["x"], "uniforme.png", { type: "image/png" });
    await user.upload(within(ventana).getByLabelText("Agregar foto"), archivo);
    expect(
      await within(ventana).findByRole("img", {
        name: "Foto 1 de Colegio Santa Rosa de Lima",
      }),
    ).toHaveAttribute("src", "https://cdn.test/uniforme.webp");
    expect(
      calls.find((c) => c.key === `POST ${base}/fotos`)?.body,
    ).toBeInstanceOf(FormData);
    await user.click(
      within(ventana).getByRole("button", {
        name: "Quitar foto 1 de Colegio Santa Rosa de Lima",
      }),
    );
    await waitFor(() =>
      expect(
        within(ventana).queryByRole("img", {
          name: "Foto 1 de Colegio Santa Rosa de Lima",
        }),
      ).not.toBeInTheDocument(),
    );

    await user.click(
      within(ventana).getByRole("tab", { name: "Productos y precios" }),
    );
    await user.upload(
      within(ventana).getByLabelText(
        "Foto de Remera / chomba en Colegio Santa Rosa de Lima",
      ),
      archivo,
    );
    expect(
      await within(ventana).findByText("Foto de este colegio"),
    ).toBeInTheDocument();

    const guardar = within(ventana).getByRole("button", {
      name: /Guardar cambios/,
    });
    expect(guardar).toBeDisabled();
    await user.type(
      within(ventana).getByLabelText("Precio de Remera / chomba"),
      "12000",
    );
    await user.click(
      within(ventana).getByLabelText("Suspender Remera / chomba"),
    );
    await user.click(
      within(ventana).getByRole("button", { name: "Guardar cambios (1)" }),
    );
    expect(
      await within(ventana).findByText("Guardamos los cambios."),
    ).toBeVisible();
    expect(
      calls.filter((c) => c.key === "PUT /admin/tiendas/uniformes/precios"),
    ).toHaveLength(1);
    expect(
      calls.find((c) => c.key === "PUT /admin/tiendas/uniformes/precios")?.body,
    ).toEqual({
      grupo: "santa-rosa",
      producto: "remera",
      precio: "12000",
      disponible: false,
    });
    expect(
      within(ventana).getByRole("button", { name: "Guardar cambios" }),
    ).toBeDisabled();
  });

  it("edita nombre y descripción de un producto", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /auth/me": () => ({ status: 200, json: me("user") }),
      "GET /admin/tiendas/uniformes/catalogo": () => ({
        status: 200,
        json: catalogo,
      }),
      "GET /admin/tiendas/uniformes/pedidos": () => ({ status: 200, json: [] }),
      "PUT /admin/tiendas/uniformes/productos/remera": (body) => ({
        status: 200,
        json: { ...catalogo.productos[0], ...(body as object) },
      }),
    });
    renderPanel();
    await user.click(
      await screen.findByRole("button", { name: "Productos y precios" }),
    );
    const nombre = screen.getByLabelText("Nombre", {
      selector: "#base-remera-nombre",
    });
    await user.clear(nombre);
    await user.type(nombre, "Chomba piqué");
    await user.type(
      screen.getByLabelText(/Descripción/, {
        selector: "#base-remera-descripcion",
      }),
      "Algodón, con escudo bordado",
    );
    const fila = nombre.closest("li") as HTMLElement;
    await user.click(within(fila).getByRole("button", { name: "Guardar" }));
    expect(await within(fila).findByText("Guardado.")).toBeVisible();
    expect(
      calls.find(
        (c) => c.key === "PUT /admin/tiendas/uniformes/productos/remera",
      )?.body,
    ).toMatchObject({
      nombre: "Chomba piqué",
      descripcion: "Algodón, con escudo bordado",
    });
  });

  it("el dueño gestiona pedidos, grupos, productos y la config de envío y pagos", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /auth/me": () => ({ status: 200, json: me("user") }),
      "GET /admin/tiendas/uniformes/catalogo": () => ({
        status: 200,
        json: catalogo,
      }),
      "GET /admin/tiendas/uniformes/pedidos": () => ({
        status: 200,
        json: [adminPedido],
      }),
      [`PUT /admin/tiendas/uniformes/pedidos/${PEDIDO_ID}`]: (body) => ({
        status: 200,
        json: { ...adminPedido, ...(body as object) },
      }),
      "POST /admin/tiendas/uniformes/grupos": (body) => ({
        status: 201,
        json: { ...(body as object), slug: "nuevo", logo_url: null },
      }),
      "POST /admin/tiendas/uniformes/productos": (body) => ({
        status: 201,
        json: {
          ...catalogo.productos[0],
          ...(body as object),
          slug: "medias",
          precio_base: "3000",
        },
      }),
      "PUT /admin/tiendas/uniformes/precios": (body) => ({
        status: 200,
        json: body,
      }),
      "PUT /admin/tiendas/uniformes": (body) => ({
        status: 200,
        json: { ...tiendaAdmin, ...(body as object) },
      }),
    });
    renderPanel();
    expect(
      await screen.findByRole("heading", { name: /P-ABC234 · María González/ }),
    ).toBeVisible();
    // Sin rol de admin del sitio no ve "Encargados".
    expect(
      screen.queryByRole("button", { name: "Encargados" }),
    ).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByLabelText("Cambiar estado"),
      "entregado",
    );
    await user.click(screen.getByRole("button", { name: "Guardar estado" }));
    await waitFor(() =>
      expect(
        calls.find((c) =>
          c.key.startsWith("PUT /admin/tiendas/uniformes/pedidos"),
        )?.body,
      ).toEqual({ estado: "entregado" }),
    );

    await user.click(screen.getByRole("button", { name: "Colegios" }));
    const nuevo = screen.getByRole("region", { name: "Agregar colegio" });
    await user.type(within(nuevo).getByLabelText("Nombre"), "Colegio Nuevo");
    await user.selectOptions(
      within(nuevo).getByLabelText("Categoría"),
      "Parroquiales y confesionales",
    );
    await user.click(
      within(nuevo).getByRole("button", { name: "Agregar colegio" }),
    );
    expect(await screen.findByText("2 colegios")).toBeVisible();
    expect(
      calls.find((c) => c.key === "POST /admin/tiendas/uniformes/grupos")?.body,
    ).toMatchObject({
      nombre: "Colegio Nuevo",
      subtitulo: null,
      categoria: "Parroquiales y confesionales",
    });

    await user.click(
      screen.getByRole("button", { name: "Productos y precios" }),
    );
    await user.type(screen.getByLabelText("Nombre del producto"), "Medias");
    await user.type(screen.getByLabelText("Precio ($)"), "3000");
    await user.type(
      screen.getByLabelText(/Talle \(separados por coma\)/, {
        selector: "#nuevo-producto-opciones",
      }),
      "1, 2",
    );
    await user.click(screen.getByRole("button", { name: "Agregar producto" }));
    await waitFor(() =>
      expect(
        calls.find((c) => c.key === "POST /admin/tiendas/uniformes/productos")
          ?.body,
      ).toEqual({
        nombre: "Medias",
        precio_base: "3000",
        opciones: ["1", "2"],
        tipo: "generico",
        descripcion: null,
      }),
    );
    await user.type(
      screen.getByLabelText("Precio de Remera / chomba"),
      "15000",
    );
    await user.click(
      within(screen.getByRole("row", { name: /Remera \/ chomba/ })).getByRole(
        "button",
        {
          name: "Guardar",
        },
      ),
    );
    await waitFor(() =>
      expect(
        calls.find((c) => c.key === "PUT /admin/tiendas/uniformes/precios")
          ?.body,
      ).toEqual({
        grupo: "santa-rosa",
        producto: "remera",
        precio: "15000",
        disponible: true,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Envío y pagos" }));
    const costo = screen.getByLabelText("Costo del envío ($)");
    await user.clear(costo);
    await user.type(costo, "0");
    const fijo = screen.getByLabelText(/Recargo fijo/);
    await user.clear(fijo);
    await user.type(fijo, "1000");
    expect(screen.getByText(/el express cuesta \$ 7.000/)).toBeVisible();
    await user.click(screen.getByLabelText("Se puede retirar sin costo"));
    await user.type(
      screen.getByLabelText("Dirección de retiro"),
      "Santiago del Estero Sur 1131",
    );
    await user.click(screen.getByLabelText("Pago total por adelantado"));
    await user.click(
      screen.getByRole("button", { name: "Guardar configuración" }),
    );
    expect(
      await screen.findByText("Guardamos la configuración."),
    ).toBeVisible();
    expect(
      calls.find((c) => c.key === "PUT /admin/tiendas/uniformes")?.body,
    ).toMatchObject({
      envio_monto: "0",
      express_monto: "1000",
      retiro_habilitado: true,
      retiro_direccion: "Santiago del Estero Sur 1131",
      total_habilitado: false,
      envio_gratis_desde: null,
      categorias: ["Parroquiales y confesionales"],
    });
  });

  it("el admin del sitio maneja encargados y abre tiendas", async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      "GET /auth/me": () => ({ status: 200, json: me("admin") }),
      "GET /admin/tiendas/uniformes/catalogo": () => ({
        status: 200,
        json: catalogo,
      }),
      "GET /admin/tiendas/uniformes/pedidos": () => ({ status: 200, json: [] }),
      "GET /admin/tiendas/uniformes/encargados": () => ({
        status: 200,
        json: [{ id: "u9", email: "virginia@gmail.com", nombre: "Virginia" }],
      }),
      "POST /admin/tiendas/uniformes/encargados": () => ({
        status: 201,
        json: { id: "u8", email: "otra@gmail.com", nombre: "Otra" },
      }),
      "DELETE /admin/tiendas/uniformes/encargados/u9": () => ({ status: 204 }),
      "GET /admin/tiendas": () => ({ status: 200, json: [uniformes] }),
      "POST /admin/tiendas": () => ({
        status: 201,
        json: { ...tiendaAdmin, slug: "libreria" },
      }),
    });
    const panel = renderPanel();
    await user.click(await screen.findByRole("button", { name: "Encargados" }));
    expect(await screen.findByText("virginia@gmail.com")).toBeVisible();
    await user.type(
      screen.getByLabelText("Email del encargado"),
      "otra@gmail.com",
    );
    await user.click(screen.getByRole("button", { name: "Agregar encargado" }));
    expect(await screen.findByText("otra@gmail.com")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Quitar a Virginia" }));
    await waitFor(() =>
      expect(screen.queryByText("virginia@gmail.com")).not.toBeInTheDocument(),
    );
    panel.unmount();

    render(
      <AuthProvider>
        <MisTiendas />
      </AuthProvider>,
    );
    expect(
      await screen.findByRole("link", { name: /Uniformes escolares/ }),
    ).toHaveAttribute("href", "/tiendas/uniformes/admin");
    await user.type(screen.getByLabelText("Nombre de la tienda"), "Librería");
    await user.type(screen.getByLabelText("Quién atiende"), "Laura");
    await user.type(
      screen.getByLabelText("Email para los pedidos"),
      "laura@mail.com",
    );
    await user.type(screen.getByLabelText("WhatsApp"), "2644001122");
    await user.click(screen.getByRole("button", { name: "Crear tienda" }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/tiendas/libreria/admin"),
    );
    expect(
      calls.find((c) => c.key === "POST /admin/tiendas")?.body,
    ).toMatchObject({
      nombre: "Librería",
      vendedor_email: "laura@mail.com",
      total_habilitado: true,
    });
  });

  it("sin tiendas a cargo lo explica", async () => {
    mockApi({
      "GET /auth/me": () => ({ status: 200, json: me("user") }),
      "GET /admin/tiendas": () => ({ status: 200, json: [] }),
    });
    render(
      <AuthProvider>
        <MisTiendas />
      </AuthProvider>,
    );
    expect(
      await screen.findByText(/No administrás ninguna tienda/),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Abrir una tienda nueva" }),
    ).not.toBeInTheDocument();
  });
});

describe("DemoPago", () => {
  it("recorre carrito, pago simulado y resultado", async () => {
    const user = userEvent.setup();
    render(<DemoPago tienda={uniformes} />);
    expect(screen.getByRole("note")).toHaveTextContent(/no se\s+cobra nada/i);
    const t = cotizar(20000, "estandar", "sena", uniformes);
    const pagar = screen.getByRole("button", {
      name: `Pagar ${pesosLabel(t.pagadoAhora)} con Mercado Pago`,
    });
    await user.click(pagar);
    expect(
      screen.getByRole("heading", { name: "El cliente paga en Mercado Pago" }),
    ).toBeInTheDocument();
    await user.click(screen.getByLabelText(/queda pendiente/i));
    await user.click(
      screen.getByRole("button", { name: "Ver qué pasa después" }),
    );
    expect(
      screen.getByRole("heading", { name: "Pago pendiente" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Empezar de nuevo" }));
    await user.click(screen.getByLabelText("Todo ahora"));
    const total = cotizar(20000, "estandar", "total", uniformes);
    await user.click(
      screen.getByRole("button", {
        name: `Pagar ${pesosLabel(total.pagadoAhora)} con Mercado Pago`,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Ver qué pasa después" }),
    );
    expect(
      screen.getByRole("heading", { name: "Pago aprobado" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Lo que recibe Virginia Tello/),
    ).toBeInTheDocument();
  });
});
