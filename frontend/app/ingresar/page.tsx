import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginFlow } from "@/components/auth/login/login-flow";
import { Skeleton } from "@/components/ui/skeleton";
import { loginMethod } from "@/lib/login-method";

export const metadata: Metadata = {
  title: "Ingresar",
  description:
    "Ingresá a CompraVendeAqui. Si es tu primera vez, creamos tu cuenta en el momento.",
  robots: { index: false },
};

export default async function IngresarPage() {
  const method = await loginMethod();
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
        <LoginFlow method={method} />
      </Suspense>
    </div>
  );
}
