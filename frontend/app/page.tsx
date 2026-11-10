import { Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { HomeCarousel, type Slide } from "@/components/home/home-carousel";
import { ListingRow } from "@/components/home/listing-row";
import { CategoryIcon } from "@/components/listings/category-icon";
import { ListingGrid } from "@/components/listings/listing-grid";
import { Button } from "@/components/ui/button";
import { serverGet } from "@/lib/api";
import type { TiendaResumen } from "@/lib/tiendas/types";
import type { CategoryNode, ListingPage } from "@/lib/types";

export const revalidate = 60;

/** Fotos de Ischigualasto (Wikimedia Commons, licencias CC BY-SA). */
const SLIDES: Slide[] = [
  {
    id: "publicar",
    titulo: "Comprá y vendé en San Juan",
    texto:
      "Publicá desde el celular en minutos y recibí las consultas por WhatsApp.",
    cta: { href: "/publicar", label: "Publicar aviso" },
    imagen: "/home/hongo.webp",
    encuadre: "50% 40%",
    credito: {
      autor: "M. Bustos",
      licencia: "CC BY-SA 4.0",
      fuente:
        "https://commons.wikimedia.org/wiki/File:A_-_Valle_de_la_Luna,_el_hongo,_San_Juan,_Argentina.jpg",
    },
  },
  {
    id: "electro",
    titulo: "Electrodomésticos y tecnología nuevos",
    texto: "Heladeras, lavarropas, parlantes, freidoras y mucho más, nuevos.",
    cta: { href: "/electrodomesticos", label: "Ver electrodomésticos" },
    imagen: "/home/barrancas.webp",
    encuadre: "50% 55%",
    credito: {
      autor: "Paulakindsvater",
      licencia: "CC BY-SA 4.0",
      fuente:
        "https://commons.wikimedia.org/wiki/File:Vista_del_valle_de_la_luna.jpg",
    },
  },
  {
    id: "uniformes",
    titulo: "Uniformes escolares",
    texto:
      "El uniforme de tu colegio con envío a tu casa. Pagás una seña y el resto cuando lo recibís.",
    cta: { href: "/tiendas/uniformes", label: "Elegir colegio" },
    imagen: "/home/lomas.webp",
    encuadre: "60% 50%",
    credito: {
      autor: "littletroll",
      licencia: "CC BY-SA 3.0",
      fuente:
        "https://commons.wikimedia.org/wiki/File:Valle_de_la_luna_-_Ischigualasto_-_panoramio.jpg",
    },
  },
];

/** Filas de la portada, en orden: el rubro y cómo se titula. */
const FILAS = [
  { slug: "electrodomesticos", titulo: "Electrodomésticos" },
  { slug: "tv-audio-y-video", titulo: "TV, audio y video" },
  { slug: "tecnologia", titulo: "Tecnología" },
  { slug: "hogar-y-muebles", titulo: "Para tu casa" },
  {
    slug: "herramientas-y-construccion",
    titulo: "Herramientas y construcción",
  },
  { slug: "deportes", titulo: "Deportes y aire libre" },
];

/**
 * Portada tipo marketplace: carrusel, accesos a rubros, filas de avisos por
 * rubro, tiendas y lo último publicado. Cada bloque se oculta si no tiene datos.
 */
export default async function HomePage() {
  const [categories, recent, tiendas, ...filas] = await Promise.all([
    serverGet<CategoryNode[]>("/categories", undefined, 3600).catch(() => null),
    serverGet<ListingPage>(
      "/listings",
      { limit: 40, sort: "newest" },
      60,
    ).catch(() => null),
    serverGet<TiendaResumen[]>("/tiendas", undefined, 3600).catch(() => null),
    ...FILAS.map((fila) =>
      serverGet<ListingPage>(
        "/listings",
        { category: fila.slug, limit: 15, sort: "newest" },
        60,
      ).catch(() => null),
    ),
  ]);

  // Un aviso aparece en una sola fila: los rubros se pisan (TV y audio está
  // dentro de Tecnología) y lo reciente repetiría la primera fila.
  const mostrados = new Set<string>();
  const filasVisibles = FILAS.map((fila, i) => {
    const items = (filas[i]?.items ?? []).filter(
      (item) => !mostrados.has(item.id),
    );
    if (items.length < 4) return null;
    items.forEach((item) => mostrados.add(item.id));
    return { ...fila, items };
  });
  const recientes = recent
    ? recent.items.filter((item) => !mostrados.has(item.id)).slice(0, 8)
    : null;

  return (
    <div className="flex flex-col gap-10 md:gap-12">
      <h1 className="sr-only">CompraVendeAqui: clasificados de San Juan</h1>

      <div className="flex flex-col">
        <HomeCarousel slides={SLIDES} />

        {categories && categories.length > 0 ? (
          <nav
            aria-labelledby="rubros"
            className="relative z-10 mx-2 -mt-6 rounded-card border border-border bg-card p-3 shadow-md sm:mx-6 sm:-mt-8 sm:p-4"
          >
            <h2 id="rubros" className="sr-only">
              Rubros
            </h2>
            <ul className="-mx-3 flex snap-x snap-mandatory gap-1 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-8 [&::-webkit-scrollbar]:hidden">
              {categories.slice(0, 8).map((category) => (
                <li
                  key={category.id}
                  className="w-24 shrink-0 snap-start sm:w-auto"
                >
                  <Link
                    href={`/${category.slug}`}
                    className="group flex h-full flex-col items-center gap-2 rounded-input px-1 py-2 text-center text-meta font-semibold text-foreground transition-colors duration-200 hover:text-primary"
                  >
                    <span className="flex size-12 items-center justify-center rounded-pill bg-muted text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                      <CategoryIcon name={category.icon} className="size-6" />
                    </span>
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      {filasVisibles.map((fila) =>
        fila ? (
          <ListingRow
            key={fila.slug}
            id={`fila-${fila.slug}`}
            titulo={fila.titulo}
            href={`/${fila.slug}`}
            items={fila.items}
          />
        ) : null,
      )}

      {tiendas && tiendas.length > 0 ? (
        <section aria-labelledby="tiendas" className="flex flex-col gap-3">
          <h2 id="tiendas" className="font-heading text-h2 font-semibold">
            Tiendas
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {tiendas.map((tienda) => (
              <li
                key={tienda.slug}
                className={tiendas.length === 1 ? "sm:col-span-2" : undefined}
              >
                <Link
                  href={`/tiendas/${tienda.slug}`}
                  className="group relative flex min-h-36 items-end overflow-hidden rounded-card bg-header text-header-foreground shadow transition-shadow duration-200 hover:shadow-md sm:min-h-44"
                >
                  <Image
                    src="/home/barrancas.webp"
                    alt=""
                    fill
                    sizes="(min-width: 1152px) 1120px, 100vw"
                    className="object-cover object-[50%_60%] transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-r from-[rgb(14_22_42/0.9)] via-[rgb(14_22_42/0.6)] to-[rgb(14_22_42/0.15)]"
                  />
                  <span className="relative flex w-full flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                    <span className="flex min-w-0 items-center gap-4">
                      <span className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-primary text-primary-foreground">
                        <Store aria-hidden="true" className="size-6" />
                      </span>
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="font-heading text-h2 font-semibold">
                          {tienda.nombre}
                        </span>
                        {tienda.descripcion ? (
                          <span className="line-clamp-2 max-w-prose text-base text-header-foreground">
                            {tienda.descripcion}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="inline-flex h-11 shrink-0 items-center rounded-input bg-card px-5 text-base font-semibold text-card-foreground transition-colors group-hover:text-primary">
                      Entrar a la tienda
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="recientes" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="recientes" className="font-heading text-h2 font-semibold">
            Publicados recientemente
          </h2>
          <Link
            href="/buscar?sort=newest"
            className="shrink-0 text-meta font-semibold text-primary underline-offset-4 hover:underline"
          >
            Ver todos
          </Link>
        </div>
        {recientes && recientes.length > 0 ? (
          <ListingGrid
            items={recientes}
            className="grid-cols-2 gap-3 sm:gap-4"
          />
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-border bg-card p-6">
            <p className="text-base text-muted-foreground">
              {recientes
                ? "Todavía no hay avisos publicados."
                : "No pudimos cargar los avisos. Probá recargar la página."}
            </p>
            <Button asChild variant="accent">
              <Link href="/publicar">Publicar el primero</Link>
            </Button>
          </div>
        )}
      </section>

      <section
        aria-labelledby="vender"
        className="flex flex-col items-start gap-4 rounded-card bg-primary p-6 text-primary-foreground sm:flex-row sm:items-center sm:justify-between sm:p-8"
      >
        <div className="flex flex-col gap-1">
          <h2 id="vender" className="font-heading text-h1 font-bold">
            ¿Tenés algo para vender?
          </h2>
          <p className="max-w-prose text-base text-primary-foreground">
            Sacale fotos con el celular, publicalo en minutos y respondé las
            consultas por WhatsApp.
          </p>
        </div>
        <Button asChild variant="accent" size="lg" className="shrink-0">
          <Link href="/publicar">Publicar aviso</Link>
        </Button>
      </section>
    </div>
  );
}
