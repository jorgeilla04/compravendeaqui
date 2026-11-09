import type { Metadata } from "next";

import { Checkout } from "@/components/uniformes/checkout";
import { FormMessage } from "@/components/ui/form";
import { serverGet } from "@/lib/api";
import type { Catalogo } from "@/lib/uniformes/types";

export const metadata: Metadata = {
  title: "Carrito de uniformes",
  robots: { index: false },
};

export default async function CarritoPage() {
  const catalogo = await serverGet<Catalogo>(
    "/uniformes/catalogo",
    undefined,
    60,
  ).catch(() => null);
  if (!catalogo) {
    return (
      <FormMessage>
        No pudimos cargar la tienda. Probá de nuevo en unos minutos.
      </FormMessage>
    );
  }
  return <Checkout config={catalogo.config} />;
}
