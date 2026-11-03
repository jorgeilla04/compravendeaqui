/**
 * Secuencia de publicación: borrador → fotos (una por pedido, en el orden
 * elegido) → activar. Si algo falla después de crear el borrador, devolvemos
 * el aviso para mandar a la persona a editarlo sin perder lo cargado.
 */

import { api, errorMessage } from "@/lib/api";
import type { ListingInput, OwnerListing } from "@/lib/types";

export type PublishProgress =
  | { phase: "creating" }
  | { phase: "uploading"; done: number; total: number }
  | { phase: "activating" };

export type PublishResult =
  | { kind: "published"; listing: OwnerListing }
  | { kind: "photos-failed"; listing: OwnerListing; error: string }
  | { kind: "activate-failed"; listing: OwnerListing; error: string };

export function progressText(progress: PublishProgress): string {
  switch (progress.phase) {
    case "creating":
      return "Guardando tu aviso…";
    case "uploading":
      return progress.total === 1
        ? "Subiendo fotos…"
        : `Subiendo fotos… (${Math.min(progress.done + 1, progress.total)} de ${progress.total})`;
    case "activating":
      return "Publicando…";
  }
}

/** Lanza ApiError solo si falla la creación (no hay nada guardado todavía). */
export async function publishListing(
  input: ListingInput,
  files: File[],
  onProgress: (progress: PublishProgress) => void = () => {},
): Promise<PublishResult> {
  onProgress({ phase: "creating" });
  let listing = await api<OwnerListing>("/listings", {
    method: "POST",
    body: { ...input, status: "draft" },
  });

  for (let i = 0; i < files.length; i += 1) {
    onProgress({ phase: "uploading", done: i, total: files.length });
    const form = new FormData();
    form.append("files", files[i], files[i].name);
    try {
      listing = await api<OwnerListing>(`/listings/${listing.id}/images`, {
        method: "POST",
        body: form,
      });
    } catch (error) {
      return { kind: "photos-failed", listing, error: errorMessage(error) };
    }
  }

  onProgress({ phase: "activating" });
  try {
    listing = await api<OwnerListing>(`/listings/${listing.id}`, {
      method: "PUT",
      body: { status: "active" },
    });
  } catch (error) {
    return { kind: "activate-failed", listing, error: errorMessage(error) };
  }
  return { kind: "published", listing };
}

/** Mensajes que muestra /avisos/[id]/editar según ?aviso=… */
export const EDIT_NOTICES: Record<string, string> = {
  "fotos-pendientes":
    "Guardamos tu aviso como borrador, pero no pudimos subir todas las fotos. Sumalas en la sección Fotos y después tocá «Publicar aviso».",
  "sin-publicar":
    "Guardamos tu aviso como borrador, pero no pudimos publicarlo. Revisá los datos y tocá «Publicar aviso».",
};
