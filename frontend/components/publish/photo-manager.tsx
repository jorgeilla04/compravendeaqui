"use client";

import Image from "next/image";
import * as React from "react";

import { FormMessage } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import type { OwnerListing } from "@/lib/types";

import { checkPhotoFiles, moveToFront } from "./photo-files";
import { PhotoPicker, PhotoTile } from "./photo-picker";

/**
 * Fotos de un aviso ya creado: cada acción va directo a la API y devuelve el
 * aviso actualizado (borrar, elegir portada, sumar fotos).
 */
export function PhotoManager({
  listing,
  onChange,
}: {
  listing: OwnerListing;
  onChange: (listing: OwnerListing) => void;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [done, setDone] = React.useState<string | null>(null);

  const images = [...listing.images].sort(
    (a, b) => a.display_order - b.display_order,
  );

  const run = async (label: string, action: () => Promise<OwnerListing>) => {
    setBusy(label);
    setErrors([]);
    setDone(null);
    try {
      onChange(await action());
      return true;
    } catch (error) {
      setErrors([errorMessage(error)]);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const upload = async (files: File[]) => {
    const { accepted, errors: rejected } = checkPhotoFiles(
      files,
      images.length,
    );
    if (accepted.length === 0) {
      setErrors(rejected);
      return;
    }
    setBusy("Subiendo fotos…");
    setErrors([]);
    setDone(null);
    let current = listing;
    try {
      for (let i = 0; i < accepted.length; i += 1) {
        setBusy(
          accepted.length === 1
            ? "Subiendo fotos…"
            : `Subiendo fotos… (${i + 1} de ${accepted.length})`,
        );
        const form = new FormData();
        form.append("files", accepted[i], accepted[i].name);
        current = await api<OwnerListing>(`/listings/${listing.id}/images`, {
          method: "POST",
          body: form,
        });
        onChange(current);
      }
      setErrors(rejected);
      setDone(
        accepted.length === 1
          ? "Subimos la foto."
          : `Subimos ${accepted.length} fotos.`,
      );
    } catch (error) {
      setErrors([errorMessage(error), ...rejected]);
    } finally {
      setBusy(null);
    }
  };

  const makeCover = (index: number) =>
    run("Cambiando la portada…", () =>
      api<OwnerListing>(`/listings/${listing.id}/images/order`, {
        method: "PUT",
        body: { image_ids: moveToFront(images, index).map((i) => i.id) },
      }),
    ).then((ok) => ok && setDone("Cambiamos la portada."));

  const remove = (imageId: string) =>
    run("Eliminando la foto…", () =>
      api<OwnerListing>(`/listings/${listing.id}/images/${imageId}`, {
        method: "DELETE",
      }),
    ).then((ok) => ok && setDone("Eliminamos la foto."));

  return (
    <section aria-labelledby="photos-title" className="flex flex-col gap-4">
      <h2
        id="photos-title"
        className="font-heading text-h2 font-semibold text-foreground"
      >
        Fotos
      </h2>
      <PhotoPicker
        id="edit-photos"
        count={images.length}
        disabled={busy !== null}
        label={images.length === 0 ? "Subí fotos" : "Sumá más fotos"}
        onFiles={(files) => void upload(files)}
      />
      <div aria-live="polite" className="flex flex-col gap-2">
        {busy ? (
          <p className="text-base font-semibold text-foreground">{busy}</p>
        ) : null}
        {done && !busy ? (
          <FormMessage tone="success">{done}</FormMessage>
        ) : null}
      </div>
      {errors.length > 0 ? (
        <FormMessage>
          <ul className="flex flex-col gap-1">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </FormMessage>
      ) : null}
      {images.length === 0 ? (
        <FormMessage tone="info">
          Tu aviso no tiene fotos. Sumá al menos una: los avisos con fotos
          reciben más consultas.
        </FormMessage>
      ) : (
        <ul
          aria-label="Fotos del aviso"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {images.map((image, index) => (
            <PhotoTile
              key={image.id}
              index={index}
              isCover={index === 0}
              disabled={busy !== null}
              removeLabel="Eliminar"
              onMakeCover={() => void makeCover(index)}
              onRemove={() => void remove(image.id)}
            >
              <Image
                src={image.thumb_url ?? image.url}
                alt={index === 0 ? "Portada del aviso" : `Foto ${index + 1}`}
                fill
                sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover"
              />
            </PhotoTile>
          ))}
        </ul>
      )}
    </section>
  );
}
