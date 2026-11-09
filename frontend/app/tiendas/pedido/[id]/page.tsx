import type { Metadata } from "next";
import { Suspense } from "react";

import { PedidoEstado } from "@/components/tiendas/pedido-estado";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Tu pedido",
  robots: { index: false },
  referrer: "no-referrer",
};

export default function PedidoPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<Skeleton className="h-40 w-full" />}>
      <PedidoEstado id={params.id} />
    </Suspense>
  );
}
