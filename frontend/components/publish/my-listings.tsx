"use client";

import { ImageOff, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormMessage } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import type { OwnerListing } from "@/lib/types";

import { StatusBadge, actionsFor, metricsText } from "./listing-status";

type StatusChange = "active" | "draft" | "sold";

const CHANGE_DONE: Record<StatusChange, string> = {
  active: "está publicado de nuevo",
  draft: "quedó pausado: nadie lo ve hasta que lo reactives",
  sold: "quedó marcado como vendido",
};

/** Completa el nombre accesible de las acciones repetidas en la lista. */
function Hidden({ title }: { title: string }) {
  return <span className="sr-only"> «{title}»</span>;
}

function ListSkeleton() {
  return (
    <ul aria-busy="true" className="flex flex-col gap-3">
      <li className="sr-only">Cargando tus avisos…</li>
      {Array.from({ length: 3 }, (_, i) => (
        <li
          key={i}
          className="flex gap-3 rounded-card border border-border p-3"
        >
          <Skeleton className="size-20 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ListingRow({
  listing,
  busy,
  onStatus,
  onDelete,
}: {
  listing: OwnerListing;
  busy: boolean;
  onStatus: (status: StatusChange) => void;
  onDelete: () => void;
}) {
  const actions = actionsFor(listing.status);
  const titleId = `listing-${listing.id}-title`;
  return (
    <li>
      <article
        aria-labelledby={titleId}
        aria-busy={busy || undefined}
        className="flex flex-col gap-3 rounded-card border border-border bg-card p-3 shadow-sm sm:p-4"
      >
        <div className="flex gap-3">
          <div className="relative size-20 shrink-0 overflow-hidden rounded-input bg-muted sm:size-24">
            {listing.thumb_url ? (
              <Image
                src={listing.thumb_url}
                alt=""
                fill
                sizes="96px"
                className="object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <ImageOff aria-hidden="true" className="size-6" />
                <span className="sr-only">Sin foto</span>
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={listing.status} />
            </div>
            <h2
              id={titleId}
              className="line-clamp-2 font-heading text-h3 font-medium text-foreground"
            >
              {listing.title}
            </h2>
            <p className="font-heading text-base font-semibold text-foreground">
              {formatPrice(listing.price, listing.price_currency)}
            </p>
            <p className="text-meta text-muted-foreground">
              {metricsText(listing.views_count, listing.contacts_count)}
            </p>
            {listing.status === "active" && listing.expires_at ? (
              <p className="text-meta text-muted-foreground">
                Vence el {formatDate(listing.expires_at)}
              </p>
            ) : null}
            {listing.status === "suspended" ? (
              <p className="text-meta text-foreground">
                Suspendido por moderación: no se muestra en el sitio.
                {listing.moderation_reason
                  ? ` Motivo: ${listing.moderation_reason}`
                  : ""}
              </p>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {actions.includes("view") ? (
            <Button asChild variant="outline">
              <Link href={listing.url_path}>
                Ver
                <Hidden title={listing.title} />
              </Link>
            </Button>
          ) : null}
          {actions.includes("edit") ? (
            <Button asChild variant="outline">
              <Link href={`/avisos/${listing.id}/editar`}>
                Editar
                <Hidden title={listing.title} />
              </Link>
            </Button>
          ) : null}
          {actions.includes("sold") ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => onStatus("sold")}
            >
              Marcar como vendido
              <Hidden title={listing.title} />
            </Button>
          ) : null}
          {actions.includes("pause") ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => onStatus("draft")}
            >
              Pausar
              <Hidden title={listing.title} />
            </Button>
          ) : null}
          {actions.includes("reactivate") ? (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => onStatus("active")}
            >
              Reactivar
              <Hidden title={listing.title} />
            </Button>
          ) : null}
          {actions.includes("delete") ? (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={onDelete}
              className="text-destructive hover:text-destructive"
            >
              Eliminar
              <Hidden title={listing.title} />
            </Button>
          ) : null}
        </div>
      </article>
    </li>
  );
}

export function MyListings() {
  const [items, setItems] = React.useState<OwnerListing[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [toDelete, setToDelete] = React.useState<OwnerListing | null>(null);

  const load = React.useCallback(async () => {
    setLoadError(null);
    try {
      setItems(await api<OwnerListing[]>("/users/me/listings"));
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const changeStatus = async (listing: OwnerListing, status: StatusChange) => {
    setBusyId(listing.id);
    setActionError(null);
    setMessage(null);
    try {
      const updated = await api<OwnerListing>(`/listings/${listing.id}`, {
        method: "PUT",
        body: { status },
      });
      setItems((current) =>
        (current ?? []).map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );
      setMessage(`«${listing.title}» ${CHANGE_DONE[status]}.`);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    const listing = toDelete;
    if (!listing || busyId) return;
    setBusyId(listing.id);
    setActionError(null);
    setMessage(null);
    try {
      await api(`/listings/${listing.id}`, { method: "DELETE" });
      setItems((current) =>
        (current ?? []).filter((item) => item.id !== listing.id),
      );
      setMessage(`Eliminamos «${listing.title}».`);
      setToDelete(null);
    } catch (error) {
      setActionError(errorMessage(error));
      setToDelete(null);
    } finally {
      setBusyId(null);
    }
  };

  const hasItems = items !== null && items.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 font-semibold text-foreground">
          Mis avisos
        </h1>
        {hasItems ? (
          <Button asChild variant="accent">
            <Link href="/publicar">
              <Plus aria-hidden="true" />
              Publicar aviso
            </Link>
          </Button>
        ) : null}
      </div>

      <div aria-live="polite">
        {message ? <FormMessage tone="success">{message}</FormMessage> : null}
      </div>
      {actionError ? <FormMessage>{actionError}</FormMessage> : null}

      {loadError ? (
        <div className="flex flex-col items-start gap-3">
          <FormMessage>{loadError}</FormMessage>
          <Button variant="outline" onClick={() => void load()}>
            Cargar mis avisos de nuevo
          </Button>
        </div>
      ) : items === null ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-border p-6">
          <h2 className="font-heading text-h2 font-semibold text-foreground">
            Todavía no publicaste nada
          </h2>
          <p className="max-w-prose text-base text-foreground">
            Sacale fotos a lo que querés vender y publicalo en menos de 3
            minutos. Los interesados te escriben por WhatsApp.
          </p>
          <Button asChild variant="accent" size="lg">
            <Link href="/publicar">Publicar mi primer aviso</Link>
          </Button>
        </div>
      ) : (
        <ul aria-label="Tus avisos" className="flex flex-col gap-3">
          {items.map((listing) => (
            <ListingRow
              key={listing.id}
              listing={listing}
              busy={busyId === listing.id}
              onStatus={(status) => void changeStatus(listing, status)}
              onDelete={() => setToDelete(listing)}
            />
          ))}
        </ul>
      )}

      <Dialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open && !busyId) setToDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar este aviso?</DialogTitle>
            <DialogDescription>
              «{toDelete?.title}» se va a dejar de mostrar y no lo vas a poder
              recuperar. Si solo querés sacarlo por un tiempo, usá «Pausar».
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" disabled={busyId !== null}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={busyId !== null}
              onClick={() => void confirmDelete()}
            >
              {busyId !== null ? "Eliminando…" : "Eliminar aviso"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
