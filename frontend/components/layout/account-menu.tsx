"use client";

import { LogOut, Settings, Store, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

/** Acceso a la cuenta en el header (desktop). En mobile está en la bottom nav. */
export function AccountMenu() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  if (loading) return <span className="h-9 w-20" aria-hidden="true" />;
  if (!user) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link href="/ingresar">Ingresar</Link>
      </Button>
    );
  }
  return (
    <details className="relative">
      <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-input px-3 text-meta font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <User aria-hidden="true" className="size-5" />
        <span className="max-w-32 truncate">{user.display_name}</span>
      </summary>
      <div className="absolute right-0 z-40 mt-1 flex w-52 flex-col rounded-input border border-border bg-card py-1 shadow-md">
        <Link
          href="/mis-avisos"
          className="px-3 py-2.5 text-base hover:bg-muted"
        >
          Mis avisos
        </Link>
        <Link href="/perfil" className="px-3 py-2.5 text-base hover:bg-muted">
          Mi perfil
        </Link>
        {user.gestiona_tiendas ? (
          <Link
            href="/tiendas/admin"
            className="inline-flex items-center gap-2 px-3 py-2.5 text-base hover:bg-muted"
          >
            <Store aria-hidden="true" className="size-4" />
            Mis tiendas
          </Link>
        ) : null}
        <Link
          href="/ajustes"
          className="inline-flex items-center gap-2 px-3 py-2.5 text-base hover:bg-muted"
        >
          <Settings aria-hidden="true" className="size-4" />
          Ajustes
        </Link>
        <button
          type="button"
          onClick={async () => {
            await logout();
            router.push("/");
            router.refresh();
          }}
          className="inline-flex items-center gap-2 px-3 py-2.5 text-left text-base hover:bg-muted"
        >
          <LogOut aria-hidden="true" className="size-4" />
          Salir
        </button>
      </div>
    </details>
  );
}
