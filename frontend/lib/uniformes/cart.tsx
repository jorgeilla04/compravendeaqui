"use client";

import * as React from "react";

export interface CartItem {
  colegio: string;
  colegioNombre: string;
  color1: string;
  color2: string;
  prenda: string;
  prendaNombre: string;
  tipo: string;
  talle: string;
  cantidad: number;
  precio: number;
}

interface CartContextValue {
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

export const CART_STORAGE_KEY = "cva-uniformes-carrito";
export const MAX_CANTIDAD = 20;

export function itemKey(item: Pick<CartItem, "colegio" | "prenda" | "talle">) {
  return `${item.colegio}|${item.prenda}|${item.talle}`;
}

const CartContext = React.createContext<CartContextValue | null>(null);

function load(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

/** Carrito de la tienda de uniformes, guardado en este navegador. */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>([]);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    setItems(load());
    setReady(true);
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* modo privado sin storage: el carrito vive en memoria */
    }
  }, [items, ready]);

  const value = React.useMemo<CartContextValue>(() => {
    const clamp = (n: number) => Math.max(1, Math.min(MAX_CANTIDAD, n));
    return {
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
  }, [items, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart va dentro de <CartProvider>");
  return ctx;
}
