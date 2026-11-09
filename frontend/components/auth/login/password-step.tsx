"use client";

import * as React from "react";

import { StepHeader } from "@/components/auth/login/step-header";
import { Button } from "@/components/ui/button";
import { FormMessage, TextField } from "@/components/ui/form";
import { identityBody } from "@/components/auth/login/identity-step";
import { api, errorMessage } from "@/lib/api";
import type { AuthResponse, LoginMethod } from "@/lib/types";

interface Props {
  method: LoginMethod;
  initialValue: string;
  onLoggedIn: (res: AuthResponse) => void;
  onUseCode: (value: string) => void;
}

export function PasswordStep({
  method,
  initialValue,
  onLoggedIn,
  onUseCode,
}: Props) {
  const isEmail = method === "email";
  const [phone, setPhone] = React.useState(initialValue);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!phone.trim() || !password) {
      setError(
        isEmail
          ? "Completá tu email y tu contraseña."
          : "Completá tu celular y tu contraseña.",
      );
      return;
    }
    setError(null);
    setSending(true);
    try {
      const res = await api<AuthResponse>("/auth/login", {
        method: "POST",
        body: { ...identityBody(method, phone), password },
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
        {isEmail ? (
          <TextField
            id="login-email"
            name="email"
            label="Tu email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="juan@gmail.com"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={sending}
            required
          />
        ) : (
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
        )}
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
          {isEmail
            ? "Ingresar con código por email"
            : "Ingresar con código por WhatsApp"}
        </button>
      </p>
    </div>
  );
}
