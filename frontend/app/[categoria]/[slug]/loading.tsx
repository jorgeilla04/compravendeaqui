import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]"
      aria-busy="true"
    >
      <span className="sr-only" role="status">
        Cargando aviso…
      </span>
      <Skeleton className="aspect-[4/3] w-full rounded-card" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-12 w-full rounded-pill" />
      </div>
    </div>
  );
}
