"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { api } from "@/lib/api";
import type { Suggestions } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Búsqueda con autocomplete (debounce 300ms). Patrón combobox de ARIA:
 * flechas para moverse, Enter para elegir, Escape para cerrar.
 */
export function SearchBar({
  className,
  autoFocus,
}: {
  className?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const urlQuery = useSearchParams().get("q") ?? "";
  const [query, setQuery] = React.useState(urlQuery);
  const [data, setData] = React.useState<Suggestions>({
    queries: [],
    categories: [],
  });
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const listId = React.useId();

  // Se sincroniza con el valor de ?q= (no con el objeto, que puede cambiar
  // de identidad sin que cambie la URL y borraría lo que se está escribiendo).
  React.useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  React.useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setData({ queries: [], categories: [] });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      api<Suggestions>("/search/suggestions", { query: { q: term } })
        .then((result) => {
          if (!controller.signal.aborted) setData(result);
        })
        .catch(() => undefined);
    }, 300);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const options = [
    ...data.categories.map((c) => ({
      key: `c-${c.slug}`,
      label: c.name,
      hint: "Categoría",
      href: `/${c.slug}`,
    })),
    ...data.queries.map((s) => ({
      key: `q-${s.text}`,
      label: s.text,
      hint: undefined,
      href: `/buscar?q=${encodeURIComponent(s.text)}`,
    })),
  ];
  const showList = open && options.length > 0;

  function go(href: string) {
    setOpen(false);
    setActive(-1);
    router.push(href);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (active >= 0 && options[active]) return go(options[active].href);
    const term = query.trim();
    go(term ? `/buscar?q=${encodeURIComponent(term)}` : "/buscar");
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  }

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className={cn("relative", className)}
    >
      <label htmlFor={`${listId}-input`} className="sr-only">
        Buscar avisos
      </label>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
      />
      <input
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        enterKeyHint="search"
        autoFocus={autoFocus}
        placeholder="Buscar autos, celulares, casas…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        className="h-11 w-full rounded-input border border-border bg-card pl-10 pr-24 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button
        type="submit"
        className="absolute right-1 top-1 h-9 rounded-input bg-primary px-4 text-meta font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Buscar
      </button>
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Sugerencias"
          className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-input border border-border bg-card py-1 shadow-md"
        >
          {options.map((option, index) => (
            <li
              key={option.key}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(e) => {
                e.preventDefault();
                go(option.href);
              }}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-base",
                index === active ? "bg-muted" : "hover:bg-muted",
              )}
            >
              <span className="truncate">{option.label}</span>
              {option.hint ? (
                <span className="shrink-0 text-meta text-muted-foreground">
                  {option.hint}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
