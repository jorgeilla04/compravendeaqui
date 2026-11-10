import Link from "next/link";
import { Suspense } from "react";

import { AccountMenu } from "@/components/layout/account-menu";
import { SearchBar } from "@/components/layout/search-bar";
import { Button } from "@/components/ui/button";

/** Accesos directos de la segunda fila del header (desktop). */
const ACCESOS = [
  { href: "/tecnologia", label: "Tecnología" },
  { href: "/electrodomesticos", label: "Electrodomésticos" },
  { href: "/hogar-y-muebles", label: "Hogar y muebles" },
  { href: "/vehiculos", label: "Vehículos" },
  { href: "/inmuebles", label: "Inmuebles" },
  { href: "/herramientas-y-construccion", label: "Herramientas" },
  { href: "/tiendas/uniformes", label: "Uniformes escolares" },
];

/**
 * Header sticky sobre la franja del cielo nocturno de Ischigualasto, con la
 * búsqueda siempre a mano (DESIGN.md). Dentro de la franja el foco es claro
 * para que se vea sobre el azul; los menús desplegables vuelven al de siempre.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 bg-header text-header-foreground shadow-md [--color-ring:var(--color-on-header)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-3 pt-3 md:flex-nowrap md:pb-2">
        <Link
          href="/"
          className="shrink-0 rounded-input font-heading text-h3 font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          CompraVende<span className="text-accent">Aqui</span>
        </Link>
        <Suspense
          fallback={
            <div className="order-last h-11 w-full md:order-none md:flex-1" />
          }
        >
          <SearchBar className="order-last w-full md:order-none md:flex-1" />
        </Suspense>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <div className="hidden md:block">
            <AccountMenu />
          </div>
          <Button asChild variant="accent" size="sm">
            <Link href="/publicar">Publicar aviso</Link>
          </Button>
        </div>
      </div>
      <nav aria-label="Rubros principales" className="hidden md:block">
        <ul className="mx-auto flex max-w-6xl items-center gap-1 px-2 pb-2">
          {ACCESOS.map((acceso) => (
            <li key={acceso.href}>
              <Link
                href={acceso.href}
                className="inline-flex h-8 items-center rounded-input px-2 text-meta text-header-muted transition-colors duration-150 hover:bg-white/10 hover:text-header-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {acceso.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
