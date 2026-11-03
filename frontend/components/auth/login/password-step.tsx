"use client";

import * as React from "react";

import { StepHeader } from "@/components/auth/login/step-header";
import { Button } from "@/components/ui/button";
import { FormMessage, TextField } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import type { AuthResponse } from "@/lib/types";

interface Props {
  initialPhone: string;
  onLoggedIn: (res: AuthResponse) => void;
  onUseCode: (phone: string) => void;
}

export function PasswordStep({ initialPhone, onLoggedIn, onUseCode }: Props) {
  const [phone, setPhone] = React.useState(initialPhone);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!phone.trim() || !password) {
      setError("Completá tu celular y tu contraseña.");
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res = await api<AuthResponse>("/auth/login", {
        method: "POST",
        body: { phone: phone.trim(), password },
        noRefresh: true,
      });
      onLoggedIn(res);
    } catch (err) {
      setError(errorMessage(err));
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <StepHeader title="Ingresá con contraseña">
        <p>Usá la contraseña que creaste en tu perfil.</p>
      </StepHeader>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          id="login-phone"
          name="phone"
          label="Tu celular"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="264 412-3456"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={sending}
          required
        />
        <TextField
          id="login-password"
          name="password"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={sending}
          required
        />
        {error ? <FormMessage>{error}</FormMessage> : null}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={sending}
          className="w-full"
        >
          {sending ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>
      <p className="text-meta text-muted-foreground">
        ¿No tenés contraseña o te la olvidaste?{" "}
        <button
          type="button"
          onClick={() => onUseCode(phone)}
          className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4 hover:text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Ingresar con código por WhatsApp
        </button>
      </p>
    </div>
  );
}
