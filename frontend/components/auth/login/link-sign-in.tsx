"use client";

import { Camera } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { StepHeader } from "@/components/auth/login/step-header";
import { safeNext } from "@/components/auth/login/safe-next";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import type { AuthResponse } from "@/lib/types";

/**
 * Destino del botón del mail. No entra solo al abrir la página: los antivirus
 * de mail abren los links para revisarlos y gastarían el link de un solo uso.
 * Entra cuando la persona toca el botón.
 */
export function LinkSignIn() {
  const { setUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("t") ?? "";
  const raw = safeNext(searchParams.get("next"));
  const next = raw === "/" ? "/publicar" : raw;
  const publishing = next.startsWith("/publicar");

  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);

  async function handleEnter() {
    setError(null);
    setSending(true);
    try {
      const res = await api<AuthResponse>("/auth/otp/link", {
        method: "POST",
        body: { token },
        noRefresh: true,
      });
      setUser(res.user);
      // Con perfil pendiente, /ingresar lo completa y después sigue a `next`.
      router.replace(
        res.user.profile_pending
          ? `/ingresar?next=${encodeURIComponent(next)}`
          : next,
      );
    } catch (err) {
      setError(errorMessage(err));
      setSending(false);
    }
  }

  if (token.length < 20) {
    return (
      <div className="flex flex-col gap-6">
        <StepHeader title="El link está incompleto">
          <p>
            Puede que se haya cortado al copiarlo. Pedí un código nuevo y tocá
            el botón del mail.
          </p>
        </StepHeader>
        <Button asChild variant="primary" size="lg" className="w-full">
          <Link href="/ingresar">Pedir un código nuevo</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title={publishing ? "Entrá y publicá tu aviso" : "Entrá a tu cuenta"}
      >
        <p>
          {publishing
            ? "Si estás en el celular, en el paso de fotos podés sacarlas en el momento con la cámara."
            : "Tocá el botón para entrar con tu email."}
        </p>
      </StepHeader>
      {error ? (
        <div className="flex flex-col gap-4">
          <FormMessage>{error}</FormMessage>
          <Button asChild variant="primary" size="lg" className="w-full">
            <Link href={`/ingresar?next=${encodeURIComponent(next)}`}>
              Pedir un código nuevo
            </Link>
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant={publishing ? "accent" : "primary"}
          size="lg"
          className="w-full"
          disabled={sending}
          onClick={handleEnter}
        >
          {publishing ? <Camera aria-hidden="true" /> : null}
          {sending ? "Entrando…" : publishing ? "Entrar y publicar" : "Entrar"}
        </Button>
      )}
    </div>
  );
}
