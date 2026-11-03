"use client";

import * as React from "react";

import { StepHeader } from "@/components/auth/login/step-header";
import { Button } from "@/components/ui/button";
import { FormMessage, TextField } from "@/components/ui/form";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { AuthResponse, OtpRequestResponse } from "@/lib/types";

interface Props {
  phone: string;
  otp: OtpRequestResponse;
  onVerified: (res: AuthResponse) => void;
  onResent: (otp: OtpRequestResponse) => void;
  onChangePhone: () => void;
}

export function channelLabel(channel: string): string {
  return channel === "sms" ? "SMS" : "WhatsApp";
}

function useCountdown(initial: number) {
  const [seconds, setSeconds] = React.useState(initial);
  React.useEffect(() => {
    if (seconds <= 0) return;
    const id = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [seconds]);
  return [seconds, setSeconds] as const;
}

export function CodeStep({
  phone,
  otp,
  onVerified,
  onResent,
  onChangePhone,
}: Props) {
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [verifying, setVerifying] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [seconds, setSeconds] = useCountdown(otp.resend_in);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("El código tiene 6 números.");
      return;
    }
    setError(null);
    setNotice(null);
    setVerifying(true);
    try {
      const res = await api<AuthResponse>("/auth/otp/verify", {
        method: "POST",
        body: { phone, code },
        noRefresh: true,
      });
      onVerified(res);
    } catch (err) {
      setError(errorMessage(err));
      setCode("");
      setVerifying(false);
      inputRef.current?.focus();
    }
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      const next = await api<OtpRequestResponse>("/auth/otp/request", {
        method: "POST",
        body: { phone },
        noRefresh: true,
      });
      onResent(next);
      setSeconds(next.resend_in);
      setCode("");
      setNotice(
        `Te mandamos un código nuevo por ${channelLabel(next.channel)}.`,
      );
    } catch (err) {
      if (err instanceof ApiError && err.retryAfter) setSeconds(err.retryAfter);
      setError(errorMessage(err));
    } finally {
      setResending(false);
    }
  }

  const minutes = Math.max(1, Math.round(otp.expires_in / 60));

  return (
    <div className="flex flex-col gap-6">
      <StepHeader title="Ingresá el código">
        <p>
          Te enviamos un código por {channelLabel(otp.channel)} a{" "}
          <strong className="font-semibold text-foreground">{otp.phone}</strong>
          .
        </p>
      </StepHeader>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          ref={inputRef}
          id="otp-code"
          name="code"
          label="Código de 6 números"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          hint={`Vence en ${minutes} ${minutes === 1 ? "minuto" : "minutos"}.`}
          value={code}
          onChange={(e) =>
            setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          error={error}
          disabled={verifying}
          className="text-h2 tracking-[0.4em]"
          required
        />
        {notice ? <FormMessage tone="success">{notice}</FormMessage> : null}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={verifying}
          className="w-full"
        >
          {verifying ? "Verificando…" : "Ingresar"}
        </Button>
      </form>
      <div className="flex flex-col items-start gap-1">
        <Button
          type="button"
          variant="ghost"
          onClick={handleResend}
          disabled={seconds > 0 || resending || verifying}
          className="-ml-3"
          aria-live="polite"
        >
          {resending
            ? "Reenviando…"
            : seconds > 0
              ? `Reenviar código en ${seconds} s`
              : "Reenviar código"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onChangePhone}
          className="-ml-3"
        >
          Cambiar número
        </Button>
      </div>
    </div>
  );
}
