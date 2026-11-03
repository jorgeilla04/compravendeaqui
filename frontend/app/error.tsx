"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div
      className="mx-auto flex max-w-md flex-col items-start gap-4 py-12"
      role="alert"
    >
      <h1 className="font-heading text-h1 font-semibold">Algo salió mal</h1>
      <p className="text-base text-muted-foreground">
        No pudimos cargar esta página. Revisá tu conexión y probá de nuevo.
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  );
}
