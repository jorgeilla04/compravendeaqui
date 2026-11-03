"use client";

import * as React from "react";

import { StepHeader } from "@/components/auth/login/step-header";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import type { OtpRequestResponse } from "@/lib/types";

interface Props {
  initialPhone: string;
  onSent: (phone: string, otp: OtpRequestResponse) => void;
  onUsePassword: (phone: string) => void;
}

export function PhoneStep({ initialPhone, onSent, onUsePassword }: Props) {
  const [phone, setPhone] = React.useState(initialPhone);
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = phone.trim();
    if (value.replace(/\D/g, "").length < 6) {
      setError(
        "Ingresá tu número de celular con característica, por ejemplo 264 412-3456.",
      );
      return;
    }
    setError(null);
    setSending(true);
    try {
      const otp = await api<OtpRequestResponse>("/auth/otp/request", {
        method: "POST",
        body: { phone: value },
        noRefresh: true,
      });
      onSent(value, otp);
    } catch (err) {
      setError(errorMessage(err));
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <StepHeader title="Ingresá con tu celular">
        <p>Si es tu primera vez, creamos tu cuenta en el momento.</p>
      </StepHeader>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          id="phone"
          name="phone"
          label="Tu celular"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="264 412-3456"
          hint="Te mandamos un código por WhatsApp."
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={error}
          disabled={sending}
          required
        />
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={sending}
          className="w-full"
        >
          {sending ? "Enviando…" : "Enviar código"}
        </Button>
      </form>
      <p className="text-meta text-muted-foreground">
        ¿Ya tenés contraseña?{" "}
        <button
          type="button"
          onClick={() => onUsePassword(phone)}
          className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4 hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ingresar con contraseña
        </button>
      </p>
    </div>
  );
}
