/** Reglas de fotos del lado del cliente (espejo de settings del backend). */

export const MAX_PHOTOS = 10;
export const MAX_PHOTO_MB = 10;
export const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ACCEPT_ATTR = ACCEPTED_TYPES.join(",");

export interface FileCheck {
  accepted: File[];
  errors: string[];
}

/**
 * Filtra las fotos elegidas: tipo, peso y cupo. Devuelve las aceptadas en el
 * orden elegido y un mensaje claro por cada rechazo.
 */
export function checkPhotoFiles(
  files: File[],
  currentCount: number,
): FileCheck {
  const accepted: File[] = [];
  const errors: string[] = [];
  let skippedForLimit = 0;

  for (const file of files) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      errors.push(`«${file.name}» no es una foto JPG, PNG o WEBP.`);
    } else if (file.size > MAX_PHOTO_BYTES) {
      errors.push(
        `«${file.name}» pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. Cada foto puede pesar hasta ${MAX_PHOTO_MB} MB.`,
      );
    } else if (currentCount + accepted.length >= MAX_PHOTOS) {
      skippedForLimit += 1;
    } else {
      accepted.push(file);
    }
  }

  if (skippedForLimit > 0) {
    errors.push(
      `Podés subir hasta ${MAX_PHOTOS} fotos por aviso. ${
        skippedForLimit === 1
          ? "Quedó 1 foto afuera."
          : `Quedaron ${skippedForLimit} fotos afuera.`
      }`,
    );
  }
  return { accepted, errors };
}

/** Mueve el elemento `index` al principio (portada). */
export function moveToFront<T>(items: T[], index: number): T[] {
  if (index <= 0 || index >= items.length) return items;
  return [items[index], ...items.slice(0, index), ...items.slice(index + 1)];
}
