import { MessageCircle, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

/**
 * Landing mínima de Fase 0: valida tokens, fuentes y componentes base.
 * El job de esta pantalla (DESIGN.md) es encontrar → la barra de búsqueda manda.
 * La funcionalidad real de búsqueda/avisos llega en Fase 1.
 */
export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4">
      <header className="flex items-center justify-between py-4">
        <span className="font-heading text-h3 font-bold text-primary">
          CompraVendeAqui
        </span>
        <Button variant="accent" size="sm">
          Publicar aviso
        </Button>
      </header>

      <main className="flex flex-1 flex-col gap-12 py-8">
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="font-heading text-display font-bold leading-tight text-foreground">
              Comprá y vendé en San Juan
            </h1>
            <p className="max-w-prose text-base text-muted-foreground">
              Encontrá lo que buscás cerca tuyo y contactá al vendedor por
              WhatsApp, sin vueltas.
            </p>
          </div>

          <form
            role="search"
            className="flex flex-col gap-2"
            aria-label="Buscar avisos"
          >
            <label
              htmlFor="q"
              className="text-meta font-semibold text-foreground"
            >
              ¿Qué estás buscando?
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  id="q"
                  name="q"
                  type="search"
                  placeholder="Ej. Toyota Corolla, heladera, notebook…"
                  className="h-12 w-full rounded-input border border-border bg-card pl-10 pr-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                />
              </div>
              <Button type="submit" size="lg" className="sm:w-auto">
                Buscar
              </Button>
            </div>
          </form>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-h2 font-semibold text-foreground">
            Avisos destacados
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DemoListingCard
              title="Toyota Corolla XEI 2018"
              price="US$ 15.900"
              department="Capital"
              condition="Usado"
            />
            <DemoListingCard
              title="Heladera Whirlpool No Frost"
              price="$ 480.000"
              department="Rivadavia"
              condition="Usado"
            />
            <DemoListingCard
              title={'Notebook Lenovo IdeaPad 15"'}
              price="$ 720.000"
              department="Rawson"
              condition="Nuevo"
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-meta text-muted-foreground">
        <p>
          CompraVendeAqui — clasificados locales de San Juan. Tus datos se tratan
          según la Ley 25.326.
        </p>
      </footer>
    </div>
  );
}

function DemoListingCard({
  title,
  price,
  department,
  condition,
}: {
  title: string;
  price: string;
  department: string;
  condition: string;
}) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <div
        aria-hidden="true"
        className="aspect-[4/3] w-full bg-muted"
        role="presentation"
      />
      <CardContent className="flex flex-1 flex-col gap-1 pt-4">
        <span className="font-heading text-h3 font-semibold text-foreground">
          {price}
        </span>
        <span className="line-clamp-2 text-base text-foreground">{title}</span>
        <span className="mt-1 text-meta text-muted-foreground">
          {department} · {condition}
        </span>
      </CardContent>
      <CardFooter>
        <Button variant="whatsapp" className="w-full">
          <MessageCircle aria-hidden="true" />
          Contactar por WhatsApp
        </Button>
      </CardFooter>
    </Card>
  );
}
