"use client";

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Protege una pantalla: sin sesión manda a /ingresar?next=<ruta actual>;
 * con el perfil sin completar, al paso de completar perfil.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (loading) return;
    if (!user || user.profile_pending) {
      router.replace(`/ingresar?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

  if (loading || !user || user.profile_pending) {
    return (
      <div
        className="flex flex-col gap-4 py-8"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Cargando…</span>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  return <>{children}</>;
}
