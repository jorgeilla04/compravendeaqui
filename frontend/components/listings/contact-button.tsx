"use client";

import { MessageCircle } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import type { ContactResponse } from "@/lib/types";

/**
 * CTA principal del aviso. El teléfono no está en el HTML: se pide al backend
 * recién con el clic (que además cuenta el contacto) y se abre WhatsApp.
 */
export function ContactButton({ listingId }: { listingId: string }) {
  const [state, setState] = React.useState<"idle" | "loading" | "done">("idle");
  const [contact, setContact] = React.useState<ContactResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onClick() {
    // La ventana se abre en el gesto del usuario (si no, Safari la bloquea).
    // Sin "noopener" en window.open (devolvería null); se corta el opener a mano.
    const popup = window.open("", "_blank");
    if (popup) popup.opener = null;
    setState("loading");
    setError(null);
    try {
      const data = await api<ContactResponse>(
        `/listings/${listingId}/contact`,
        { method: "POST" },
      );
      setContact(data);
      setState("done");
      if (popup) popup.location.href = data.whatsapp_url;
      else window.location.href = data.whatsapp_url;
    } catch (e) {
      popup?.close();
      setError(errorMessage(e));
      setState("idle");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="whatsapp"
        size="lg"
        className="w-full"
        onClick={onClick}
        disabled={state === "loading"}
      >
        <MessageCircle aria-hidden="true" />
        {state === "loading" ? "Abriendo WhatsApp…" : "Contactar por WhatsApp"}
      </Button>
      {contact ? (
        <p className="text-meta text-muted-foreground" role="status">
          Si WhatsApp no se abrió,{" "}
          <a
            href={contact.whatsapp_url}
            className="font-semibold text-primary underline"
            rel="noopener noreferrer"
          >
            tocá acá
          </a>{" "}
          o escribí al{" "}
          <span className="font-semibold text-foreground">
            {contact.phone_display}
          </span>
          .
        </p>
      ) : (
        <p className="text-meta text-muted-foreground">
          Se abre WhatsApp con un mensaje listo sobre este aviso.
        </p>
      )}
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}
