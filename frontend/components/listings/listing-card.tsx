import { ImageOff, MapPin } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { conditionLabel, formatPrice } from "@/lib/format";
import type { ListingCard as ListingCardData } from "@/lib/types";

/**
 * Card de aviso (DESIGN.md): foto + precio + título + departamento.
 * Toda la card es un link; el contacto por WhatsApp vive en el detalle.
 */
export function ListingCard({
  listing,
  priority = false,
}: {
  listing: ListingCardData;
  priority?: boolean;
}) {
  const condition = conditionLabel(listing.condition);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-sm transition-colors duration-200 hover:border-primary">
      <div className="relative aspect-[4/3] w-full bg-muted">
        {listing.thumb_url ? (
          <Image
            src={listing.thumb_url}
            alt=""
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
            priority={priority}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff aria-hidden="true" className="size-8" />
            <span className="sr-only">Sin foto</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="font-heading text-h3 font-semibold text-foreground">
          {formatPrice(listing.price, listing.price_currency)}
        </p>
        <h3 className="line-clamp-2 text-base text-foreground">
          <Link
            href={listing.url_path}
            className="after:absolute after:inset-0 focus-visible:outline-none group-focus-within:underline"
          >
            {listing.title}
          </Link>
        </h3>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-meta text-muted-foreground">
          {listing.department ? (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden="true" className="size-4" />
              {listing.department}
            </span>
          ) : null}
          {condition ? <Badge>{condition}</Badge> : null}
        </div>
      </div>
    </article>
  );
}
