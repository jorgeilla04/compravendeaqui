import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DemoPago } from "@/components/tiendas/demo-pago";
import { getTienda } from "@/lib/tiendas/server";

export const metadata: Metadata = {
  title: "Demo: cómo se paga un pedido",
  robots: { index: false },
};

export default async function DemoPagoPage({
  params,
}: {
  params: { tienda: string };
}) {
  const tienda = await getTienda(params.tienda);
  if (!tienda) notFound();
  return <DemoPago tienda={tienda} />;
}
