"use client";

import { ArrowLeft, Check } from "lucide-react";

import { CategoryIcon } from "@/components/listings/category-icon";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { CategoryNode } from "@/lib/types";

const tile =
  "flex min-h-14 w-full items-center gap-3 rounded-input border border-border bg-card px-3 py-3 text-left text-base text-foreground transition-colors duration-200 hover:border-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:font-semibold";

/**
 * Paso 1: primero la categoría padre (grilla con íconos) y, si tiene hijas,
 * la subcategoría. Elegir la categoría final avanza solo.
 */
export function CategoryStep({
  tree,
  loading,
  loadError,
  onRetry,
  parentId,
  categoryId,
  error,
  onPickParent,
  onPickCategory,
  onClearParent,
}: {
  tree: CategoryNode[];
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  parentId: string | null;
  categoryId: string | null;
  error?: string;
  onPickParent: (parent: CategoryNode) => void;
  onPickCategory: (category: CategoryNode, parent: CategoryNode | null) => void;
  onClearParent: () => void;
}) {
  if (loading) {
    return (
      <div aria-busy="true" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <span className="sr-only">Cargando categorías…</span>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <FormMessage>{loadError}</FormMessage>
        <Button type="button" variant="outline" onClick={onRetry}>
          Cargar categorías de nuevo
        </Button>
      </div>
    );
  }

  const parent = tree.find((c) => c.id === parentId);
  const showChildren = parent && parent.children.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {showChildren ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-base font-semibold text-foreground">
              <CategoryIcon name={parent.icon} className="size-5" />
              {parent.name}
            </p>
            <Button type="button" variant="ghost" onClick={onClearParent}>
              <ArrowLeft aria-hidden="true" />
              Cambiar categoría
            </Button>
          </div>
          <ul
            aria-label={`Subcategorías de ${parent.name}`}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
          >
            {parent.children.map((child) => {
              const selected = child.id === categoryId;
              return (
                <li key={child.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    className={tile}
                    onClick={() => onPickCategory(child, parent)}
                  >
                    <span className="flex-1">{child.name}</span>
                    {selected ? (
                      <Check
                        aria-hidden="true"
                        className="size-5 text-primary"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <ul
          aria-label="Categorías"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
        >
          {tree.map((category) => {
            const selected =
              category.id === parentId || category.id === categoryId;
            return (
              <li key={category.id}>
                <button
                  type="button"
                  aria-pressed={selected}
                  className={cn(tile, "h-full")}
                  onClick={() =>
                    category.children.length > 0
                      ? onPickParent(category)
                      : onPickCategory(category, null)
                  }
                >
                  <CategoryIcon
                    name={category.icon}
                    className="size-6 shrink-0 text-primary"
                  />
                  <span className="flex-1">{category.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error ? (
        <p role="alert" className="text-meta font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
