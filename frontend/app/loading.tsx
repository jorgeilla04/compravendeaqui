import { ListingGridSkeleton } from "@/components/listings/listing-grid";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <span className="sr-only" role="status">
        Cargando…
      </span>
      <Skeleton className="h-9 w-64" />
      <ListingGridSkeleton />
    </div>
  );
}
