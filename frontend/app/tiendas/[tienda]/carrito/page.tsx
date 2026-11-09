import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Checkout } from "@/components/tiendas/checkout";
import { getTienda } from "@/lib/tiendas/server";

export const metadata: Metadata = {
  title: "Carrito",
  robots: { index: false },
};

export default async function CarritoPage({
  params,
}: {
  params: { tienda: string };
}) {
  const tienda = await getTienda(params.tienda);
  if (!tienda) notFound();
  return <Checkout tienda={tienda} />;
}
