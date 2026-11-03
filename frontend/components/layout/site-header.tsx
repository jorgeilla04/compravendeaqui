import Link from "next/link";
import { Suspense } from "react";

import { AccountMenu } from "@/components/layout/account-menu";
import { SearchBar } from "@/components/layout/search-bar";
import { Button } from "@/components/ui/button";

/** Header sticky con la búsqueda siempre a mano (DESIGN.md). */
export function SiteHeader() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-30 border-b border-border backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:flex-nowrap">
        <Link
          href="/"
          className="font-heading text-h3 font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          CompraVendeAqui
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
    </header>
  );
}
