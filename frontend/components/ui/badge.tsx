import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Badge de DESIGN.md: condición, estado del aviso, verificado. */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-meta font-semibold",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-foreground",
        info: "border-primary/30 bg-primary/10 text-foreground",
        success: "border-accent/40 bg-accent/10 text-foreground",
        warning: "border-amber-500/40 bg-amber-500/10 text-foreground",
        danger: "border-destructive/40 bg-destructive/10 text-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
