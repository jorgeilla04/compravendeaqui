"use client";

import { Download } from "lucide-react";
import * as React from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { RequireAuth } from "@/components/auth/require-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormMessage, TextField } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import type { Me } from "@/lib/types";

type Message = { tone: "error" | "success"; text: string } | null;

export default function AjustesPage() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}

function Settings() {
  const { user, setUser } = useAuth();
  const me = user as Me;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-10 py-4">
      <h1 className="font-heading text-h1 font-semibold">Ajustes</h1>
      <WhatsappSection me={me} onSaved={setUser} />
      <PasswordSection me={me} onSaved={setUser} />
      <ExportSection />
      <DeleteSection />
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-3 border-t border-border pt-6"
    >
      <h2 id={id} className="font-heading text-h2 font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function WhatsappSection({
  me,
  onSaved,
}: {
  me: Me;
  onSaved: (me: Me) => void;
}) {
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<Message>(null);
  const on = me.whatsapp_optin;

  async function toggle() {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await api<Me>("/users/me", {
        method: "PUT",
        body: { whatsapp_optin: !on },
      });
      onSaved(updated);
      setMessage({
        tone: "success",
        text: updated.whatsapp_optin
          ? "Listo: los compradores pueden escribirte por WhatsApp."
          : "Listo: dejaste de recibir consultas por WhatsApp.",
      });
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section id="whatsapp-title" title="Consultas por WhatsApp">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span id="optin-label" className="text-base font-semibold">
            Recibir consultas de compradores
          </span>
          <p id="optin-hint" className="text-meta text-muted-foreground">
            Es como te contactan los compradores. Tu número no se muestra en el
            aviso: solo se abre el chat cuando alguien toca &quot;Contactar por
            WhatsApp&quot;. Si lo apagás, no van a poder escribirte.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="optin-label"
          aria-describedby="optin-hint"
          onClick={toggle}
          disabled={saving}
          className={
            "relative inline-flex h-11 w-[4.25rem] shrink-0 items-center rounded-pill border-2 px-1 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 " +
            (on ? "border-primary bg-primary" : "border-border bg-muted")
          }
        >
          <span
            aria-hidden="true"
            className={
              "block size-8 rounded-pill bg-card shadow-sm transition-transform duration-200 motion-reduce:transition-none " +
              (on ? "translate-x-6" : "translate-x-0")
            }
          />
        </button>
      </div>
      <p className="text-meta font-semibold" aria-live="polite">
        {saving ? "Guardando…" : on ? "Activado" : "Desactivado"}
      </p>
      {message ? (
        <FormMessage tone={message.tone}>{message.text}</FormMessage>
      ) : null}
    </Section>
  );
}

function PasswordSection({
  me,
  onSaved,
}: {
  me: Me;
  onSaved: (me: Me) => void;
}) {
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<Message>(null);
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    if (next.length < 8) {
      setError("La contraseña nueva tiene que tener al menos 8 caracteres.");
      return;
    }
    setError(null);
    if (me.has_password && !current) {
      setMessage({ tone: "error", text: "Escribí tu contraseña actual." });
      return;
    }
    setSaving(true);
    try {
      await api("/users/me/password", {
        method: "PUT",
        body: me.has_password
          ? { current_password: current, new_password: next }
          : { new_password: next },
      });
      if (!me.has_password) onSaved({ ...me, has_password: true });
      setCurrent("");
      setNext("");
      setMessage({ tone: "success", text: "Guardamos tu contraseña nueva." });
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      id="password-title"
      title={me.has_password ? "Cambiar contraseña" : "Crear contraseña"}
    >
      <p className="text-base text-muted-foreground">
        {me.has_password
          ? "Podés ingresar con tu contraseña o con el código que te mandamos."
          : "Es opcional: te sirve para ingresar sin esperar el código."}
      </p>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {/* Campo oculto para que el gestor de contraseñas asocie la cuenta. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={me.username}
          readOnly
          hidden
        />
        {me.has_password ? (
          <TextField
            id="current-password"
            label="Contraseña actual"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            disabled={saving}
            required
          />
        ) : null}
        <TextField
          id="new-password"
          label="Contraseña nueva"
          type="password"
          autoComplete="new-password"
          hint="Mínimo 8 caracteres."
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={error}
          disabled={saving}
          required
        />
        {message ? (
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          disabled={saving}
          className="w-full sm:w-auto"
        >
          {saving ? "Guardando…" : "Guardar contraseña"}
        </Button>
      </form>
    </Section>
  );
}

function ExportSection() {
  const [downloading, setDownloading] = React.useState(false);
  const [message, setMessage] = React.useState<Message>(null);

  async function handleDownload() {
    setDownloading(true);
    setMessage(null);
    try {
      const data = await api<unknown>("/users/me/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mis-datos-compravendeaqui-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage({
        tone: "success",
        text: "Descargamos tus datos en un archivo JSON.",
      });
    } catch (err) {
      setMessage({ tone: "error", text: errorMessage(err) });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Section id="export-title" title="Tus datos">
      <p className="text-base text-muted-foreground">
        Por la Ley 25.326 de Protección de Datos Personales tenés derecho a
        acceder a toda la información que guardamos sobre vos: perfil, avisos y
        actividad.
      </p>
      <Button
        type="button"
        variant="outline"
        onClick={handleDownload}
        disabled={downloading}
        className="w-full sm:w-auto"
      >
        <Download aria-hidden="true" />
        {downloading ? "Preparando archivo…" : "Descargar mis datos"}
      </Button>
      {message ? (
        <FormMessage tone={message.tone}>{message.text}</FormMessage>
      ) : null}
    </Section>
  );
}

const CONFIRM_WORD = "ELIMINAR";

function DeleteSection() {
  const [open, setOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleDelete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirm.trim() !== CONFIRM_WORD) return;
    setDeleting(true);
    setError(null);
    try {
      await api("/users/me", { method: "DELETE" });
      // Navegación completa a "/": limpia todo el estado del cliente y evita que
      // <RequireAuth> (al ver user=null) redirija a /ingresar antes de llegar.
      window.location.replace("/");
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <Section id="delete-title" title="Eliminar mi cuenta">
      <p className="text-base text-muted-foreground">
        Borramos tus datos personales y damos de baja todos tus avisos. No se
        puede deshacer.
      </p>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (deleting) return;
          setOpen(value);
          if (!value) {
            setConfirm("");
            setError(null);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button type="button" variant="outline" className="w-full sm:w-auto">
            Eliminar mi cuenta
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar tu cuenta?</DialogTitle>
            <DialogDescription>
              Se borran tu perfil, tu foto y tus datos de contacto, y se dan de
              baja todos tus avisos. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleDelete}
            noValidate
            className="flex flex-col gap-4"
          >
            <TextField
              id="confirm-delete"
              label={`Escribí ${CONFIRM_WORD} para confirmar`}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              disabled={deleting}
            />
            {error ? <FormMessage>{error}</FormMessage> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={deleting}>
                  Conservar mi cuenta
                </Button>
              </DialogClose>
              <Button
                type="submit"
                variant="destructive"
                disabled={confirm.trim() !== CONFIRM_WORD || deleting}
              >
                {deleting ? "Eliminando…" : "Eliminar definitivamente"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
