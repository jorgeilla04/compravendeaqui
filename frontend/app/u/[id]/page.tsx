import { PackageOpen } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { ListingGrid } from "@/components/listings/listing-grid";
import { serverGet } from "@/lib/api";
import { memberSince } from "@/lib/format";
import type { ListingPage, PublicProfile } from "@/lib/types";

export const revalidate = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Props {
  params: { id: string };
}

async function getProfile(id: string): Promise<PublicProfile | null> {
  // El backend valida el UUID con 422; acá lo tratamos como "no existe".
  if (!UUID_RE.test(id)) return null;
  return serverGet<PublicProfile>(`/users/${id}`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getProfile(params.id);
  if (!profile) return { title: "Vendedor no encontrado" };
  return {
    title: `${profile.display_name} — avisos en San Juan`,
    description: `Avisos de ${profile.display_name} en CompraVendeAqui. ${profile.active_listings_count} publicados.`,
    alternates: { canonical: `/u/${profile.id}` },
  };
}

export default async function SellerProfilePage({ params }: Props) {
  const profile = await getProfile(params.id);
  if (!profile) notFound();
  const listings = await serverGet<ListingPage>(
    `/users/${profile.id}/listings`,
  );
  const items = listings?.items ?? [];
  const count = profile.active_listings_count;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center gap-4">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-pill border border-border bg-muted sm:size-20">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={`Foto de ${profile.display_name}`}
              fill
              sizes="80px"
              className="object-cover"
              priority
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-full items-center justify-center font-heading text-h1 font-semibold"
            >
              {profile.display_name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate font-heading text-h1 font-semibold">
            {profile.display_name}
          </h1>
          <p className="text-meta text-muted-foreground">
            En CompraVendeAqui desde {memberSince(profile.created_at)} ·{" "}
            {count === 1 ? "1 aviso publicado" : `${count} avisos publicados`}
          </p>
        </div>
      </header>

      <section aria-labelledby="avisos-title" className="flex flex-col gap-4">
        <h2 id="avisos-title" className="font-heading text-h2 font-semibold">
          Avisos publicados
        </h2>
        {items.length > 0 ? (
          <ListingGrid items={items} />
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border px-4 py-12 text-center">
            <PackageOpen
              aria-hidden="true"
              className="size-8 text-muted-foreground"
            />
            <p className="text-base font-semibold">
              Por ahora no tiene avisos publicados.
            </p>
            <p className="max-w-sm text-meta text-muted-foreground">
              Cuando publique algo nuevo lo vas a ver acá.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
