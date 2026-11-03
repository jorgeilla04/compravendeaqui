import { CalendarDays, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ContactButton } from "@/components/listings/contact-button";
import { Gallery } from "@/components/listings/gallery";
import { ViewPing } from "@/components/listings/view-ping";
import { Badge } from "@/components/ui/badge";
import { serverGet } from "@/lib/api";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import {
  conditionLabel,
  formatPrice,
  memberSince,
  relativeDays,
} from "@/lib/format";
import { jsonLd } from "@/lib/seo";
import type { CategoryDetail, Listing } from "@/lib/types";

type Props = { params: { categoria: string; slug: string } };

// ISR: se regenera a lo sumo cada 60 s.
export const revalidate = 60;

async function getListing(slug: string) {
  if (!/^[a-z0-9-]{1,255}$/.test(slug)) return null;
  return serverGet<Listing>(`/listings/${slug}`, undefined, 60);
}

function summary(listing: Listing, max = 155): string {
  const text = listing.description.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await getListing(params.slug);
  if (!listing) return { title: "Aviso no disponible" };
  const price = formatPrice(listing.price, listing.price_currency);
  const title = `${listing.title} — ${price}`;
  const description = `${price} · ${listing.department ?? "San Juan"}. ${summary(listing, 120)}`;
  const image = listing.images[0];
  return {
    title,
    description,
    alternates: { canonical: listing.url_path },
    openGraph: {
      type: "website",
      title,
      description,
      url: `${SITE_URL}${listing.url_path}`,
      images: image
        ? [
            {
              url: image.url,
              width: image.width ?? undefined,
              height: image.height ?? undefined,
            },
          ]
        : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
    },
  };
}

export default async function ListingPage({ params }: Props) {
  const listing = await getListing(params.slug);
  if (!listing) notFound();
  // URL canónica: si cambió la categoría, el link viejo redirige (301).
  if (listing.category.slug !== params.categoria)
    permanentRedirect(listing.url_path);

  const category = await serverGet<CategoryDetail>(
    `/categories/${listing.category.slug}`,
    undefined,
    3600,
  ).catch(() => null);
  const crumbs = [
    { name: "Inicio", href: "/" },
    ...(category?.path ?? [listing.category]).map((c) => ({
      name: c.name,
      href: `/${c.slug}`,
    })),
    { name: listing.title },
  ];
  const condition = conditionLabel(listing.condition);
  const price = formatPrice(listing.price, listing.price_currency);
  const url = `${SITE_URL}${listing.url_path}`;

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: summary(listing, 500),
    image: listing.images.map((i) => i.url),
    category: listing.category.name,
    url,
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: listing.price_currency,
      ...(listing.price ? { price: listing.price } : {}),
      availability: "https://schema.org/InStock",
      itemCondition:
        listing.condition === "nuevo"
          ? "https://schema.org/NewCondition"
          : listing.condition === "reacondicionado"
            ? "https://schema.org/RefurbishedCondition"
            : "https://schema.org/UsedCondition",
      areaServed: {
        "@type": "AdministrativeArea",
        name: `${listing.department ?? "San Juan"}, San Juan, Argentina`,
      },
      seller: { "@type": "Person", name: listing.seller.display_name },
    },
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      ...(crumb.href ? { item: `${SITE_URL}${crumb.href}` } : {}),
    })),
  };

  return (
    <article className="flex flex-col gap-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd([productLd, breadcrumbLd]) }}
      />
      <ViewPing listingId={listing.id} />
      <Breadcrumbs items={crumbs} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Gallery images={listing.images} title={listing.title} />

        <div className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {condition ? <Badge>{condition}</Badge> : null}
              <Badge tone="info">{listing.category.name}</Badge>
            </div>
            <h1 className="font-heading text-h1 font-semibold leading-tight">
              {listing.title}
            </h1>
            <p className="font-heading text-display font-bold text-foreground">
              {price}
              <span className="sr-only">
                {listing.price_currency === "USD" ? " (dólares)" : " (pesos)"}
              </span>
            </p>
            <ul className="flex flex-col gap-1 text-meta text-muted-foreground">
              <li className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden="true" className="size-4" />
                {[listing.location, listing.department, "San Juan"]
                  .filter(Boolean)
                  .join(", ")}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <CalendarDays aria-hidden="true" className="size-4" />
                Publicado {relativeDays(listing.created_at)}
              </li>
            </ul>
          </div>

          <ContactButton listingId={listing.id} />

          <section
            aria-labelledby="vendedor"
            className="flex items-center gap-3 rounded-card border border-border bg-card p-4"
          >
            <div
              aria-hidden="true"
              className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-muted font-heading text-h3 font-semibold text-foreground"
            >
              {listing.seller.display_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex min-w-0 flex-col">
              <h2 id="vendedor" className="truncate text-base font-semibold">
                {listing.seller.display_name}
              </h2>
              <p className="text-meta text-muted-foreground">
                En {SITE_NAME} desde {memberSince(listing.seller.created_at)}
              </p>
              <Link
                href={`/u/${listing.seller.id}`}
                className="text-meta font-semibold text-primary hover:underline"
              >
                Ver sus otros avisos
              </Link>
            </div>
          </section>
        </div>
      </div>

      <section
        aria-labelledby="descripcion"
        className="flex max-w-prose flex-col gap-3"
      >
        <h2 id="descripcion" className="font-heading text-h2 font-semibold">
          Descripción
        </h2>
        <p className="whitespace-pre-line text-base leading-relaxed">
          {listing.description}
        </p>
      </section>

      <aside className="max-w-prose rounded-card border border-border bg-card p-4 text-meta text-muted-foreground">
        <h2 className="mb-1 text-base font-semibold text-foreground">
          Comprá con cuidado
        </h2>
        <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
          <li>
            Si lo ves en persona, encontrate en un lugar público y revisalo
            antes de pagar.
          </li>
          <li>
            Si te lo envían, pagá con un medio que te proteja (por ejemplo,
            Mercado Pago) y pedí el número de seguimiento.
          </li>
          <li>
            Desconfiá de precios muy por debajo del mercado, de apuros y de
            pedidos de pago por adelantado a cuentas de terceros.
          </li>
        </ul>
      </aside>
    </article>
  );
}
