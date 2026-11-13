"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { FormMessage, TextField } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import type { TiendaAdmin, TiendaResumen } from "@/lib/tiendas/types";

/** Alta rápida: lo demás (envío, pagos...) se ajusta después en su panel. */
function NuevaTienda() {
  const router = useRouter();
  const [nombre, setNombre] = React.useState("");
  const [vendedor, setVendedor] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const tienda = await api<TiendaAdmin>("/admin/tiendas", {
        method: "POST",
        body: {
          nombre: nombre.trim(),
          grupo_label: "Rubro",
          opcion_label: "Opción",
          vendedor_nombre: vendedor.trim(),
          vendedor_email: email.trim(),
          vendedor_whatsapp: whatsapp.trim(),
          envio_monto: "0",
          departamentos_envio: ["Capital"],
          sena_habilitada: false,
          total_habilitado: true,
        },
      });
      router.push(`/tiendas/${tienda.slug}/admin`);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby="nueva-tienda"
      className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
    >
      <h2 id="nueva-tienda" className="font-heading text-h2 font-semibold">
        Abrir una tienda nueva
      </h2>
      <p className="text-meta text-muted-foreground">
        Empieza con envío sin cargo a Capital y pago total; después el dueño
        ajusta envío, express, retiro y seña desde su panel.
      </p>
      <form
        onSubmit={handleSubmit}
        noValidate
        className="grid gap-3 sm:grid-cols-2"
      >
        <TextField
          id="tienda-nombre"
          label="Nombre de la tienda"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          disabled={saving}
          required
        />
        <TextField
          id="tienda-vendedor"
          label="Quién atiende"
          value={vendedor}
          onChange={(e) => setVendedor(e.target.value)}
          disabled={saving}
          required
        />
        <TextField
          id="tienda-email"
          label="Email para los pedidos"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={saving}
          required
        />
        <TextField
          id="tienda-whatsapp"
          label="WhatsApp"
          type="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          disabled={saving}
          required
        />
        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center">
          <Button type="submit" variant="accent" disabled={saving}>
            {saving ? "Creando…" : "Crear tienda"}
          </Button>
          {error ? <FormMessage>{error}</FormMessage> : null}
        </div>
      </form>
    </section>
  );
}

export function MisTiendas() {
  const { user } = useAuth();
  const [tiendas, setTiendas] = React.useState<TiendaResumen[] | null>(null);
  const [transportes, setTransportes] = React.useState<TiendaResumen[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api<TiendaResumen[]>("/admin/tiendas")
      .then(setTiendas)
      .catch((err) => setError(errorMessage(err)));
    // Cotizadores de transporte que administra (mismo acceso que las tiendas).
    api<TiendaResumen[]>("/admin/transporte")
      .then(setTransportes)
      .catch(() => undefined);
  }, []);
  const items = [
    ...(tiendas ?? []).map((t) => ({
      ...t,
      href: `/tiendas/${t.slug}/admin`,
      detalle: "Pedidos, catálogo, envío y pagos",
    })),
    ...transportes.map((t) => ({
      ...t,
      href: `/transporte/${t.slug}/admin`,
      detalle: "Cotizador: tarifas, unidades y pedidos",
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-h1 font-semibold">Mis tiendas</h1>
      {error ? <FormMessage>{error}</FormMessage> : null}
      {tiendas === null && !error ? <Skeleton className="h-24 w-full" /> : null}
      {tiendas !== null && items.length === 0 ? (
        <p className="text-muted-foreground">
          No administrás ninguna tienda. Si querés vender por acá, escribinos al
          contacto que figura en Términos.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                className="flex flex-col gap-1 rounded-card border border-border bg-card p-4 transition-colors duration-200 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-heading text-h3 font-semibold">
                  {t.nombre}
                </span>
                <span className="text-meta text-muted-foreground">
                  {t.detalle}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {user?.role === "admin" ? <NuevaTienda /> : null}
    </div>
  );
}
