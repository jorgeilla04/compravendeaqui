"use client";

import { House, ListChecks, PlusCircle, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

/** Bottom nav de mobile (DESIGN.md): pulgar-friendly, 44px+ de alto. */
export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const items = [
    { href: "/", label: "Inicio", icon: House },
    { href: "/buscar", label: "Buscar", icon: Search },
    { href: "/publicar", label: "Publicar", icon: PlusCircle },
    { href: "/mis-avisos", label: "Mis avisos", icon: ListChecks },
    {
      href: user ? "/perfil" : "/ingresar",
      label: user ? "Cuenta" : "Ingresar",
      icon: User,
    },
  ];
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ href, label, icon: Icon }) => {
          const current =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.75rem] font-semibold",
                  current ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
