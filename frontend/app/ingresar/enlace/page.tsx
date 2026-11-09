import type { Metadata } from "next";
import { Suspense } from "react";

import { LinkSignIn } from "@/components/auth/login/link-sign-in";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false },
  // El token va en la URL: que no viaje como Referer a otros sitios.
  referrer: "no-referrer",
};

export default function EnlacePage() {
  return (
    <div className="mx-auto w-full max-w-md py-4 sm:py-10">
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-busy="true">
            <span className="sr-only">Cargando…</span>
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-12 w-full" />
          </div>
        }
      >
        <LinkSignIn />
      </Suspense>
    </div>
  );
}
