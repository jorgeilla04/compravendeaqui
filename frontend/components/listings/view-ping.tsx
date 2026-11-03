"use client";

import * as React from "react";

import { api } from "@/lib/api";

/** Cuenta la vista desde el navegador (las páginas ISR no pasan por el backend). */
export function ViewPing({ listingId }: { listingId: string }) {
  React.useEffect(() => {
    api(`/listings/${listingId}/view`, { method: "POST" }).catch(
      () => undefined,
    );
  }, [listingId]);
  return null;
}
