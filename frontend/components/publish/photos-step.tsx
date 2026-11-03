"use client";

import { FormMessage } from "@/components/ui/form";

import { PhotoPicker, PhotoTile } from "./photo-picker";

export interface LocalPhoto {
  id: string;
  file: File;
  /** Object URL para la vista previa; se revoca al quitarla. */
  url: string;
}

/** Paso 4: fotos locales con vista previa. Opcionales, pero recomendadas. */
export function PhotosStep({
  photos,
  errors,
  onAdd,
  onRemove,
  onMakeCover,
}: {
  photos: LocalPhoto[];
  errors: string[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onMakeCover: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PhotoPicker
        id="wizard-photos"
        count={photos.length}
        label={photos.length === 0 ? "Subí fotos" : "Sumá más fotos"}
        onFiles={onAdd}
      />
      {errors.length > 0 ? (
        <FormMessage>
          <ul className="flex flex-col gap-1">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </FormMessage>
      ) : null}
      {photos.length === 0 ? (
        <FormMessage tone="info">
          Te recomendamos subir al menos una foto: los avisos con fotos reciben
          más consultas. Si no tenés ahora, podés seguir y sumarlas después.
        </FormMessage>
      ) : (
        <ul
          aria-label="Fotos elegidas"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {photos.map((photo, index) => (
            <PhotoTile
              key={photo.id}
              index={index}
              isCover={index === 0}
              onMakeCover={() => onMakeCover(photo.id)}
              onRemove={() => onRemove(photo.id)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Foto ${index + 1}: ${photo.file.name}`}
                className="size-full object-cover"
              />
            </PhotoTile>
          ))}
        </ul>
      )}
    </div>
  );
}
