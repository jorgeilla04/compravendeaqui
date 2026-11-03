import { ListingCard } from "@/components/listings/listing-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ListingCard as ListingCardData } from "@/lib/types";

export function ListingGrid({ items }: { items: ListingCardData[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item, index) => (
        <li key={item.id} className="flex">
          <div className="flex-1">
            <ListingCard listing={item} priority={index < 2} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ListingGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className="flex flex-col overflow-hidden rounded-card border border-border bg-card"
        >
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-20" />
          </div>
        </li>
      ))}
    </ul>
  );
}
