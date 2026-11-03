import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginFlow } from "@/components/auth/login/login-flow";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Ingresar",
  description:
    "Ingresá a CompraVendeAqui con tu celular. Te mandamos un código por WhatsApp.",
  robots: { index: false },
};

export default function IngresarPage() {
  return (
    <div className="mx-auto w-full max-w-md py-4 sm:py-10">
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-busy="true">
            <span className="sr-only">Cargando…</span>
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-11 w-full" />
          </div>
        }
      >
        <LoginFlow />
      </Suspense>
    </div>
  );
}
