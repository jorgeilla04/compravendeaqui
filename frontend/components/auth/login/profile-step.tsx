"use client";

import Link from "next/link";
import * as React from "react";

import { StepHeader } from "@/components/auth/login/step-header";
import { Button } from "@/components/ui/button";
import { FormMessage, TextField } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import type { Me } from "@/lib/types";

export interface ProfileValues {
  username: string;
  full_name: string;
  email: string;
  phone: string;
  password: string;
  accept_terms: boolean;
  whatsapp_optin: boolean;
}

type Errors = Partial<Record<keyof ProfileValues, string>>;

export const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;

/**
 * Validación en el cliente, espejo de RegisterIn (backend). `needsPhone`: se
 * ingresó por email y todavía no hay WhatsApp de contacto.
 */
export function validateProfile(
  values: ProfileValues,
  needsPhone = false,
): Errors {
  const errors: Errors = {};
  if (!USERNAME_RE.test(values.username)) {
    errors.username =
      "Usá entre 3 y 30 caracteres: letras minúsculas, números, _ o punto.";
  }
  const name = values.full_name.trim();
  if (name.length < 2 || name.length > 120) {
    errors.full_name = "Escribí tu nombre y apellido.";
  }
  if (
    values.email.trim() &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
  ) {
    errors.email = "Revisá el email, parece que le falta algo.";
  }
  if (needsPhone && values.phone.replace(/\D/g, "").length < 10) {
    errors.phone =
      "Ingresá tu celular con característica, por ejemplo 264 412-3456.";
  }
  if (values.password && values.password.length < 8) {
    errors.password = "La contraseña tiene que tener al menos 8 caracteres.";
  }
  if (!values.accept_terms) {
    errors.accept_terms =
      "Para crear tu cuenta tenés que aceptar los Términos y la Política.";
  }
  return errors;
}

/** El backend asigna "usuario1234567" provisorio: no lo sugerimos. */
function suggestUsername(user: Me | null): string {
  const base = user?.username ?? "";
  return USERNAME_RE.test(base) && !/^usuario\d{7}$/.test(base) ? base : "";
}

const checkbox =
  "mt-0.5 size-5 shrink-0 rounded border-border accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ProfileStep({
  user,
  onDone,
}: {
  user: Me | null;
  onDone: (me: Me) => void;
}) {
  const [values, setValues] = React.useState<ProfileValues>({
    username: suggestUsername(user),
    full_name: user?.full_name ?? "",
    email: user?.email ?? "",
    phone: "",
    password: "",
    accept_terms: false,
    whatsapp_optin: true,
  });
  // Ingreso por email: falta el WhatsApp de contacto y el email ya está.
  const needsPhone = !user?.phone_masked;
  const emailFromLogin = Boolean(user?.email_verified);
  const [errors, setErrors] = React.useState<Errors>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  function set<K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    // El error de un campo se va apenas se corrige, no recién al reenviar.
    setErrors((e) => {
      if (!(key in e)) return e;
      const { [key]: _, ...rest } = e;
      return rest;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateProfile(values, needsPhone);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      const me = await api<Me>("/auth/register", {
        method: "POST",
        body: {
          username: values.username,
          full_name: values.full_name.trim(),
          ...(emailFromLogin ? {} : { email: values.email.trim() || null }),
          ...(needsPhone ? { phone: values.phone.trim() } : {}),
          password: values.password || null,
          accept_terms: values.accept_terms,
          whatsapp_optin: values.whatsapp_optin,
        },
      });
      onDone(me);
    } catch (err) {
      setServerError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <StepHeader title="Completá tu perfil">
        <p>Es lo que ven los compradores en tus avisos. Te lleva un minuto.</p>
      </StepHeader>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          id="username"
          name="username"
          label="Nombre de usuario"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          hint="Minúsculas, números, _ o punto. Ej: juan.perez"
          value={values.username}
          onChange={(e) =>
            set("username", e.target.value.toLowerCase().replace(/\s/g, ""))
          }
          error={errors.username}
          disabled={saving}
          required
        />
        <TextField
          id="full_name"
          name="full_name"
          label="Nombre y apellido"
          autoComplete="name"
          value={values.full_name}
          onChange={(e) => set("full_name", e.target.value)}
          error={errors.full_name}
          disabled={saving}
          required
        />
        {needsPhone ? (
          <TextField
            id="phone"
            name="phone"
            label="Tu celular (WhatsApp)"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="264 412-3456"
            hint="Por acá te escriben los compradores. No se muestra en el aviso."
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            error={errors.phone}
            disabled={saving}
            required
          />
        ) : null}
        {emailFromLogin ? null : (
          <TextField
            id="email"
            name="email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            optional
            hint="Solo para avisos de tu cuenta. No lo mostramos."
            value={values.email}
            onChange={(e) => set("email", e.target.value)}
            error={errors.email}
            disabled={saving}
          />
        )}
        <TextField
          id="new-password"
          name="password"
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          optional
          hint="Mínimo 8 caracteres. Te sirve para ingresar sin esperar el código."
          value={values.password}
          onChange={(e) => set("password", e.target.value)}
          error={errors.password}
          disabled={saving}
        />

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="whatsapp_optin"
            className="flex min-h-11 items-start gap-3 text-base"
          >
            <input
              id="whatsapp_optin"
              type="checkbox"
              className={checkbox}
              checked={values.whatsapp_optin}
              onChange={(e) => set("whatsapp_optin", e.target.checked)}
              aria-describedby="whatsapp_optin-hint"
              disabled={saving}
            />
            <span>Quiero recibir consultas de compradores por WhatsApp</span>
          </label>
          <p
            id="whatsapp_optin-hint"
            className="pl-8 text-meta text-muted-foreground"
          >
            Es la forma en que los compradores te contactan. Tu número no se
            muestra en el aviso: solo se abre el chat cuando alguien toca
            &quot;Contactar por WhatsApp&quot;.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex min-h-11 items-start gap-3 text-base">
            <input
              id="accept_terms"
              type="checkbox"
              className={checkbox}
              checked={values.accept_terms}
              onChange={(e) => set("accept_terms", e.target.checked)}
              aria-invalid={errors.accept_terms ? true : undefined}
              aria-describedby={
                errors.accept_terms ? "accept_terms-error" : undefined
              }
              disabled={saving}
              required
            />
            <label htmlFor="accept_terms">
              Acepto los{" "}
              <Link
                href="/terminos"
                target="_blank"
                className="font-semibold text-primary underline underline-offset-4"
              >
                Términos
              </Link>{" "}
              y la{" "}
              <Link
                href="/privacidad"
                target="_blank"
                className="font-semibold text-primary underline underline-offset-4"
              >
                Política de privacidad
              </Link>
            </label>
          </div>
          {errors.accept_terms ? (
            <p
              id="accept_terms-error"
              role="alert"
              className="pl-8 text-meta font-semibold text-destructive"
            >
              {errors.accept_terms}
            </p>
          ) : null}
        </div>

        {serverError ? <FormMessage>{serverError}</FormMessage> : null}
        <Button
          type="submit"
          variant="accent"
          size="lg"
          disabled={saving}
          className="w-full"
        >
          {saving ? "Creando tu cuenta…" : "Crear mi cuenta"}
        </Button>
      </form>
    </div>
  );
}
