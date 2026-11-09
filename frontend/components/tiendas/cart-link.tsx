"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";

import { useCart } from "@/lib/uniformes/cart";

/** Acceso al carrito con la cantidad de prendas. */
export function CartLink() {
  const { count, ready } = useCart();
  const label =
    ready && count > 0
      ? `Ver carrito, ${count} ${count === 1 ? "prenda" : "prendas"}`
      : "Ver carrito";
  return (
    <Link
      href="/uniformes/carrito"
      aria-label={label}
      className="inline-flex min-h-11 items-center gap-2 rounded-input border border-border bg-card px-4 text-base font-semibold text-foreground transition-colors duration-200 hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ShoppingBag aria-hidden="true" className="size-5" />
      Carrito
      {ready && count > 0 ? (
        <span className="inline-flex min-w-6 items-center justify-center rounded-pill bg-accent px-1.5 text-meta font-bold text-accent-foreground">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
