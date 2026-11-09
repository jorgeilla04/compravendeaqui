"use client";

import * as React from "react";

export interface CartItem {
  grupo: string;
  grupoNombre: string;
  color1: string;
  color2: string;
  producto: string;
  productoNombre: string;
  tipo: string;
  fotoUrl: string | null;
  opcion: string | null;
  cantidad: number;
  precio: number;
}

interface CartContextValue {
  /** Slug de la tienda de este carrito. */
  tienda: string;
  items: CartItem[];
  /** false hasta leer el carrito guardado (evita parpadeo de "vacío"). */
  ready: boolean;
  count: number;
  subtotal: number;
  add: (item: CartItem) => void;
  setCantidad: (key: string, cantidad: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

/** Un carrito por tienda (cada pedido es de un solo dueño). */
export function cartStorageKey(tienda: string): string {
  return `cva-carrito-${tienda}`;
}
export const MAX_CANTIDAD = 50;

export function itemKey(item: Pick<CartItem, "grupo" | "producto" | "opcion">) {
  return `${item.grupo}|${item.producto}|${item.opcion ?? ""}`;
}

const CartContext = React.createContext<CartContextValue | null>(null);

function load(key: string): CartItem[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

/** Carrito de una tienda, guardado en este navegador. */
export function CartProvider({
  tienda,
  children,
}: {
  tienda: string;
  children: React.ReactNode;
}) {
  const storageKey = cartStorageKey(tienda);
  const [items, setItems] = React.useState<CartItem[]>([]);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setItems(load(storageKey));
    setReady(true);
  }, [storageKey]);

  React.useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      /* modo privado sin storage: el carrito vive en memoria */
    }
  }, [items, ready, storageKey]);

  const value = React.useMemo<CartContextValue>(() => {
    const clamp = (n: number) => Math.max(1, Math.min(MAX_CANTIDAD, n));
    return {
      tienda,
      items,
      ready,
      count: items.reduce((n, i) => n + i.cantidad, 0),
      subtotal: items.reduce((n, i) => n + i.precio * i.cantidad, 0),
      add: (item) =>
        setItems((current) => {
          const key = itemKey(item);
          const existing = current.find((i) => itemKey(i) === key);
          if (!existing)
            return [...current, { ...item, cantidad: clamp(item.cantidad) }];
          return current.map((i) =>
            itemKey(i) === key
              ? {
                  ...i,
                  precio: item.precio,
                  cantidad: clamp(i.cantidad + item.cantidad),
                }
              : i,
          );
        }),
      setCantidad: (key, cantidad) =>
        setItems((current) =>
          current.map((i) =>
            itemKey(i) === key ? { ...i, cantidad: clamp(cantidad) } : i,
          ),
        ),
      remove: (key) =>
        setItems((current) => current.filter((i) => itemKey(i) !== key)),
      clear: () => setItems([]),
    };
  }, [items, ready, tienda]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart va dentro de <CartProvider>");
  return ctx;
}
