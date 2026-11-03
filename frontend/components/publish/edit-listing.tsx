"use client";

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { CategoryNode, OwnerListing } from "@/lib/types";

import {
  draftFromListing,
  hasErrors,
  toListingInput,
  validateDraft,
  type DraftErrors,
  type DraftField,
  type ListingDraft,
} from "./listing-draft";
import {
  CategorySelect,
  DetailsFields,
  PriceLocationFields,
} from "./listing-fields";
import { StatusBadge } from "./listing-status";
import { PhotoManager } from "./photo-manager";
import { EDIT_NOTICES } from "./publish-flow";

function EditSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Cargando tu aviso…</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function EditListing({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const notice = EDIT_NOTICES[searchParams.get("aviso") ?? ""];

  const [listing, setListing] = React.useState<OwnerListing | null>(null);
  const [tree, setTree] = React.useState<CategoryNode[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  const [draft, setDraft] = React.useState<ListingDraft | null>(null);
  const [errors, setErrors] = React.useState<DraftErrors>({});
  const [saving, setSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<string | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  const load = React.useCallback(async () => {
    setLoadError(null);
    try {
      const [owned, categories] = await Promise.all([
        api<OwnerListing>(`/listings/${id}/manage`),
        api<CategoryNode[]>("/categories"),
      ]);
      setListing(owned);
      setDraft(draftFromListing(owned));
      setTree(categories);
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 404 || error.status === 422)
      ) {
        setNotFound(true);
      } else {
        setLoadError(errorMessage(error));
      }
    }
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const patch = (changes: Partial<ListingDraft>) => {
    setDraft((d) => (d ? { ...d, ...changes } : d));
    setSaved(null);
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(changes)) {
        delete next[key as DraftField];
        if (key === "categoryId") delete next.category;
      }
      return next;
    });
  };

  /** Valida todo el formulario; si hay errores, enfoca el primero. */
  const checkDraft = (current: ListingDraft): boolean => {
    const found = validateDraft(current, tree);
    if (!hasErrors(found)) return true;
    setErrors(found);
    setTimeout(() => {
      formRef.current
        ?.querySelector<HTMLElement>("[aria-invalid='true']")
        ?.focus();
    }, 0);
    return false;
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft || saving || !checkDraft(draft)) return;
    setSaving(true);
    setSaveError(null);
    setSaved(null);
    try {
      const updated = await api<OwnerListing>(`/listings/${id}`, {
        method: "PUT",
        body: toListingInput(draft),
      });
      setListing(updated);
      setSaved("Guardamos los cambios.");
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  /** Publica guardando también lo que esté editado en el formulario. */
  const activate = async () => {
    if (!draft || publishing || saving || !checkDraft(draft)) return;
    setPublishing(true);
    setSaveError(null);
    setSaved(null);
    try {
      const updated = await api<OwnerListing>(`/listings/${id}`, {
        method: "PUT",
        body: { ...toListingInput(draft), status: "active" },
      });
      setListing(updated);
      setSaved("Tu aviso ya está publicado.");
    } catch (error) {
      setSaveError(errorMessage(error));
    } finally {
      setPublishing(false);
    }
  };

  if (notFound) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-start gap-4">
        <h1 className="font-heading text-h1 font-semibold text-foreground">
          No encontramos este aviso
        </h1>
        <p className="text-base text-foreground">
          Puede que lo hayas eliminado o que no sea tuyo.
        </p>
        <Button asChild variant="outline">
          <Link href="/mis-avisos">Ir a mis avisos</Link>
        </Button>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-start gap-4">
        <h1 className="font-heading text-h1 font-semibold text-foreground">
          Editar aviso
        </h1>
        <FormMessage>{loadError}</FormMessage>
        <Button variant="outline" onClick={() => void load()}>
          Cargar el aviso de nuevo
        </Button>
      </div>
    );
  }

  if (!listing || !draft) return <EditSkeleton />;

  const canActivate =
    listing.status === "draft" || listing.status === "expired";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link
          href="/mis-avisos"
          className="inline-flex min-h-11 items-center gap-1 self-start text-base font-semibold text-primary hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Mis avisos
        </Link>
        <h1 className="font-heading text-h1 font-semibold text-foreground">
          Editar aviso
        </h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <StatusBadge status={listing.status} />
          {listing.status === "active" && listing.expires_at ? (
            <span className="text-meta text-muted-foreground">
              Vence el {formatDate(listing.expires_at)}
            </span>
          ) : null}
          {listing.status === "active" ? (
            <Link
              href={listing.url_path}
              className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-primary hover:underline"
            >
              Ver aviso
              <ExternalLink aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </div>
        {notice && canActivate ? (
          <FormMessage tone="info">{notice}</FormMessage>
        ) : null}
        {canActivate ? (
          <div className="flex flex-col gap-2 rounded-card border border-border bg-muted p-4">
            <p className="text-base text-foreground">
              {listing.status === "expired"
                ? "Tu aviso venció y no aparece en las búsquedas."
                : "Tu aviso es un borrador: nadie lo ve todavía."}
            </p>
            <Button
              type="button"
              variant="accent"
              className="self-start"
              disabled={publishing}
              onClick={() => void activate()}
            >
              {publishing
                ? "Publicando…"
                : listing.status === "expired"
                  ? "Volver a publicar"
                  : "Publicar aviso"}
            </Button>
          </div>
        ) : null}
        {listing.status === "suspended" ? (
          <FormMessage>
            Este aviso fue suspendido por moderación y no se muestra en el
            sitio.
          </FormMessage>
        ) : null}
      </div>

      <form
        ref={formRef}
        noValidate
        onSubmit={save}
        aria-labelledby="edit-data-title"
        className="flex flex-col gap-5"
      >
        <h2
          id="edit-data-title"
          className="font-heading text-h2 font-semibold text-foreground"
        >
          Datos del aviso
        </h2>
        <CategorySelect
          tree={tree}
          value={draft.categoryId}
          fallback={listing.category}
          error={errors.category}
          disabled={saving}
          onChange={(categoryId, parentId) => patch({ categoryId, parentId })}
        />
        <DetailsFields
          draft={draft}
          errors={errors}
          onChange={patch}
          disabled={saving}
        />
        <PriceLocationFields
          draft={draft}
          errors={errors}
          onChange={patch}
          disabled={saving}
        />
        {saveError ? <FormMessage>{saveError}</FormMessage> : null}
        {saved ? <FormMessage tone="success">{saved}</FormMessage> : null}
        <Button type="submit" disabled={saving} className="sm:self-start">
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </form>

      <PhotoManager listing={listing} onChange={setListing} />
    </div>
  );
}
