"use client";

import { BadgeCheck, Camera } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { USERNAME_RE } from "@/components/auth/login/profile-step";
import { RequireAuth } from "@/components/auth/require-auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage, TextField } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import type { Me } from "@/lib/types";

export default function PerfilPage() {
  return (
    <RequireAuth>
      <ProfileEditor />
    </RequireAuth>
  );
}

type Errors = Partial<
  Record<"username" | "full_name" | "email" | "phone", string>
>;

function ProfileEditor() {
  const { user, setUser } = useAuth();
  const me = user as Me;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 py-4">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-h1 font-semibold">Mi perfil</h1>
        <p className="text-base text-muted-foreground">
          Así te ven los compradores.{" "}
          <Link
            href={`/u/${me.id}`}
            className="font-semibold text-primary underline underline-offset-4 hover:text-secondary"
          >
            Ver mi perfil público
          </Link>
        </p>
      </header>
      <AvatarSection me={me} onSaved={setUser} />
      <DetailsForm me={me} onSaved={setUser} />
    </div>
  );
}

function AvatarSection({ me, onSaved }: { me: Me; onSaved: (me: Me) => void }) {
  const [preview, setPreview] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [message, setMessage] = React.useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage({ tone: "error", text: "Elegí una foto (JPG, PNG o WebP)." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ tone: "error", text: "La foto puede pesar hasta 5 MB." });
      return;
    }
    setMessage(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const updated = await api<Me>("/users/me/avatar", {
        method: "POST",
        body: form,
      });
      onSaved(updated);
      setPreview(null);
      setMessage({ tone: "success", text: "Listo, actualizamos tu foto." });
    } catch (err) {
      setPreview(null);
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setUploading(false);
    }
  }

  const src = preview ?? me.avatar_url;
  const initial = (me.display_name || me.username).charAt(0).toUpperCase();

  return (
    <section aria-labelledby="foto-title" className="flex flex-col gap-3">
      <h2 id="foto-title" className="font-heading text-h2 font-semibold">
        Foto de perfil
      </h2>
      <div className="flex items-center gap-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-pill border border-border bg-muted">
          {src ? (
            <Image
              src={src}
              alt="Tu foto de perfil"
              fill
              sizes="80px"
              className="object-cover"
              unoptimized={Boolean(preview)}
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex size-full items-center justify-center font-heading text-h1 font-semibold text-foreground"
            >
              {initial}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <input
            ref={inputRef}
            id="avatar"
            type="file"
            accept="image/*"
            aria-label="Elegir foto de perfil"
            // Se abre con el botón visible: el input no suma otra parada de Tab.
            tabIndex={-1}
            className="sr-only"
            onChange={handleFile}
            disabled={uploading}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <Camera aria-hidden="true" />
            {uploading ? "Subiendo foto…" : src ? "Cambiar foto" : "Subir foto"}
          </Button>
          <p className="text-meta text-muted-foreground">
            JPG, PNG o WebP, hasta 5 MB.
          </p>
        </div>
      </div>
      {message ? (
        <FormMessage tone={message.tone}>{message.text}</FormMessage>
      ) : null}
    </section>
  );
}

function DetailsForm({ me, onSaved }: { me: Me; onSaved: (me: Me) => void }) {
  const [fullName, setFullName] = React.useState(me.full_name ?? "");
  const [username, setUsername] = React.useState(me.username);
  const [email, setEmail] = React.useState(me.email ?? "");
  const [phone, setPhone] = React.useState("");
  // Con lo que se ingresa no se edita acá; el otro dato sí.
  const loginByEmail = me.email_verified && !me.phone_verified;
  const [errors, setErrors] = React.useState<Errors>({});
  const [message, setMessage] = React.useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: Errors = {};
    if (fullName.trim().length < 2)
      found.full_name = "Escribí tu nombre y apellido.";
    if (!USERNAME_RE.test(username)) {
      found.username =
        "Usá entre 3 y 30 caracteres: letras minúsculas, números, _ o punto.";
    }
    if (
      !loginByEmail &&
      email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      found.email = "Revisá el email, parece que le falta algo.";
    }
    if (loginByEmail && phone.trim() && phone.replace(/\D/g, "").length < 10) {
      found.phone =
        "Ingresá tu celular con característica, por ejemplo 264 412-3456.";
    }
    setErrors(found);
    setMessage(null);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      const updated = await api<Me>("/users/me", {
        method: "PUT",
        body: {
          full_name: fullName.trim(),
          username,
          ...(loginByEmail
            ? phone.trim()
              ? { phone: phone.trim() }
              : {}
            : { email: email.trim() || null }),
        },
      });
      onSaved(updated);
      setPhone("");
      setMessage({ tone: "success", text: "Guardamos los cambios." });
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="datos-title" className="flex flex-col gap-4">
      <h2 id="datos-title" className="font-heading text-h2 font-semibold">
        Tus datos
      </h2>
      <dl className="flex flex-col gap-1.5">
        <dt className="text-meta font-semibold text-foreground">
          {loginByEmail ? "Email" : "Celular"}
        </dt>
        <dd className="flex flex-wrap items-center gap-2 text-base">
          <span>
            {loginByEmail ? me.email : (me.phone_masked ?? "Sin celular")}
          </span>
          {loginByEmail || me.phone_verified ? (
            <Badge tone="success">
              <BadgeCheck aria-hidden="true" className="size-4" />
              Verificado
            </Badge>
          ) : null}
        </dd>
        <dd className="text-meta text-muted-foreground">
          Es tu forma de ingresar. No se muestra en tus avisos.
        </dd>
      </dl>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          id="full_name"
          label="Nombre y apellido"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          error={errors.full_name}
          disabled={saving}
          required
        />
        <TextField
          id="username"
          label="Nombre de usuario"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          hint="Minúsculas, números, _ o punto."
          value={username}
          onChange={(e) =>
            setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))
          }
          error={errors.username}
          disabled={saving}
          required
        />
        {loginByEmail ? (
          <TextField
            id="phone"
            label="Celular (WhatsApp)"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="264 412-3456"
            optional
            hint={
              me.phone_masked
                ? `Ahora: ${me.phone_masked}. Escribí otro solo si querés cambiarlo.`
                : "Por acá te escriben los compradores. No se muestra en el aviso."
            }
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
            disabled={saving}
          />
        ) : (
          <TextField
            id="email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            optional
            hint="Solo para avisos de tu cuenta. No lo mostramos."
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            disabled={saving}
          />
        )}
        {message ? (
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          disabled={saving}
          className="w-full sm:w-auto"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </form>
    </section>
  );
}
