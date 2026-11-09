import Link from "next/link";
import { notFound } from "next/navigation";

import { CartLink } from "@/components/tiendas/cart-link";
import { CartProvider } from "@/lib/tiendas/cart";
import { getTienda } from "@/lib/tiendas/server";

export default async function TiendaLayout({
  params,
  children,
}: {
  params: { tienda: string };
  children: React.ReactNode;
}) {
  const tienda = await getTienda(params.tienda);
  if (!tienda) notFound();
  return (
    <CartProvider tienda={tienda.slug}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
          <Link
            href={`/tiendas/${tienda.slug}`}
            className="font-heading text-h3 font-semibold text-foreground hover:text-primary"
          >
            {tienda.nombre}
          </Link>
          <CartLink />
        </div>
        {children}
      </div>
    </CartProvider>
  );
}
