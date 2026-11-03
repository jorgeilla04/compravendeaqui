import { cn } from "@/lib/utils";

/** Placeholder de carga (grids y detalle). Respeta prefers-reduced-motion. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-input bg-muted motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}
