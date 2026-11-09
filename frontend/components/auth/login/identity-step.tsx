"use client";

import * as React from "react";

import { StepHeader } from "@/components/auth/login/step-header";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import type { LoginMethod, OtpRequestResponse } from "@/lib/types";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Cuerpo de los pedidos de OTP/contraseña según el método de ingreso. */
export function identityBody(method: LoginMethod, value: string) {
  return method === "email"
    ? { email: value.trim().toLowerCase() }
    : { phone: value.trim() };
}

/**
 * Pedido de código. Por email va también adónde lleva el link del mail: si no
 * venía de ninguna página, la API lo manda a publicar.
 */
export function otpRequestBody(
  method: LoginMethod,
  value: string,
  next: string,
) {
  const body = identityBody(method, value);
  return method === "email" && next !== "/" ? { ...body, next } : body;
}

/** Error del lado del cliente, o null si el dato parece válido. */
export function validateIdentity(
  method: LoginMethod,
  value: string,
): string | null {
  if (method === "email") {
    return EMAIL_RE.test(value.trim())
      ? null
      : "Escribí tu email completo, por ejemplo juan@gmail.com.";
  }
  return value.replace(/\D/g, "").length < 6
    ? "Ingresá tu número de celular con característica, por ejemplo 264 412-3456."
    : null;
}

interface Props {
  method: LoginMethod;
  initialValue: string;
  /** Adónde lleva el link del mail después de entrar. */
  next: string;
  onSent: (value: string, otp: OtpRequestResponse) => void;
  onUsePassword: (value: string) => void;
}

export function IdentityStep({
  method,
  initialValue,
  next,
  onSent,
  onUsePassword,
}: Props) {
  const [value, setValue] = React.useState(initialValue);
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const isEmail = method === "email";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const invalid = validateIdentity(method, value);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSending(true);
    try {
      const otp = await api<OtpRequestResponse>("/auth/otp/request", {
        method: "POST",
        body: otpRequestBody(method, value, next),
        noRefresh: true,
      });
      onSent(value.trim(), otp);
    } catch (err) {
      setError(errorMessage(err));
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <StepHeader
        title={isEmail ? "Ingresá con tu email" : "Ingresá con tu celular"}
      >
        <p>Si es tu primera vez, creamos tu cuenta en el momento.</p>
      </StepHeader>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {isEmail ? (
          <TextField
            id="email"
            name="email"
            label="Tu email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="juan@gmail.com"
            hint="Te mandamos un código y un link para entrar directo a publicar."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            error={error}
            disabled={sending}
            required
          />
        ) : (
          <TextField
            id="phone"
            name="phone"
            label="Tu celular"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="264 412-3456"
            hint="Te mandamos un código por WhatsApp."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            error={error}
            disabled={sending}
            required
          />
        )}
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
          onClick={() => onUsePassword(value)}
          className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4 hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ingresar con contraseña
        </button>
      </p>
    </div>
  );
}
