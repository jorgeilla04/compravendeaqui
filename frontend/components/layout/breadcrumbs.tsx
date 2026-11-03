import { ChevronRight } from "lucide-react";
import Link from "next/link";

export interface Crumb {
  name: string;
  href?: string;
}

/** Breadcrumbs accesibles; el último elemento es la página actual. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Ruta de navegación"
      className="text-meta text-muted-foreground"
    >
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li
              key={`${item.name}-${index}`}
              className="inline-flex items-center gap-1"
            >
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="rounded-sm hover:text-foreground hover:underline"
                >
                  {item.name}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "text-foreground" : undefined}
                >
                  {item.name}
                </span>
              )}
              {!last ? (
                <ChevronRight aria-hidden="true" className="size-4" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
