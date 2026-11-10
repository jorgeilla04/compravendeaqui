"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  FormMessage,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import {
  type CatalogoAdmin,
  type PrecioGrupo,
  type ProductoAdmin,
  TIPOS_ILUSTRACION,
} from "@/lib/tiendas/types";

const input =
  "h-11 w-32 rounded-input border border-border bg-card px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** "S, M, L" → ["S", "M", "L"]. */
export function parseOpciones(text: string): string[] {
  return text
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function NuevoProducto({
  slug,
  opcionLabel,
  onCreated,
}: {
  slug: string;
  opcionLabel: string;
  onCreated: (p: ProductoAdmin) => void;
}) {
  const [nombre, setNombre] = React.useState("");
  const [precio, setPrecio] = React.useState("");
  const [opciones, setOpciones] = React.useState("");
  const [tipo, setTipo] = React.useState("generico");
  const [descripcion, setDescripcion] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nombre.trim().length < 2 || !precio) {
      setError("Completá el nombre y el precio.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onCreated(
        await api<ProductoAdmin>(`/admin/tiendas/${slug}/productos`, {
          method: "POST",
          body: {
            nombre: nombre.trim(),
            precio_base: precio,
            opciones: parseOpciones(opciones),
            tipo,
            descripcion: descripcion.trim() || null,
          },
        }),
      );
      setNombre("");
      setPrecio("");
      setOpciones("");
      setDescripcion("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-3 sm:grid-cols-2"
    >
      <TextField
        id="nuevo-producto-nombre"
        label="Nombre del producto"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        disabled={saving}
        required
      />
      <TextField
        id="nuevo-producto-precio"
        label="Precio ($)"
        type="number"
        inputMode="numeric"
        min={0}
        step={100}
        value={precio}
        onChange={(e) => setPrecio(e.target.value)}
        disabled={saving}
        required
      />
      <TextField
        id="nuevo-producto-opciones"
        label={`${opcionLabel} (separados por coma)`}
        optional
        hint="Ej.: S, M, L. Vacío si no tiene."
        value={opciones}
        onChange={(e) => setOpciones(e.target.value)}
        disabled={saving}
      />
      <SelectField
        id="nuevo-producto-tipo"
        label="Dibujo mientras no tenga foto"
        value={tipo}
        onChange={(e) => setTipo(e.target.value)}
        disabled={saving}
      >
        {Object.entries(TIPOS_ILUSTRACION).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      <TextAreaField
        id="nuevo-producto-descripcion"
        label="Descripción"
        optional
        rows={2}
        maxLength={1000}
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        disabled={saving}
        className="sm:col-span-2"
      />
      <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:items-center">
        <Button type="submit" variant="primary" disabled={saving}>
          {saving ? "Agregando…" : "Agregar producto"}
        </Button>
        {error ? <FormMessage>{error}</FormMessage> : null}
      </div>
    </form>
  );
}

function ProductoRow({
  slug,
  producto,
  opcionLabel,
  onSaved,
}: {
  slug: string;
  producto: ProductoAdmin;
  opcionLabel: string;
  onSaved: (p: ProductoAdmin) => void;
}) {
  const [nombre, setNombre] = React.useState(producto.nombre);
  const [descripcion, setDescripcion] = React.useState(
    producto.descripcion ?? "",
  );
  const [precio, setPrecio] = React.useState(
    String(Number(producto.precio_base)),
  );
  const [opciones, setOpciones] = React.useState(producto.opciones.join(", "));
  const [activo, setActivo] = React.useState(producto.activo);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const id = `base-${producto.slug}`;
  const path = `/admin/tiendas/${slug}/productos/${producto.slug}`;

  async function save() {
    setMessage(null);
    setError(null);
    if (nombre.trim().length < 2) {
      setError("El nombre necesita al menos 2 letras.");
      return;
    }
    try {
      onSaved(
        await api<ProductoAdmin>(path, {
          method: "PUT",
          body: {
            nombre: nombre.trim(),
            descripcion: descripcion.trim() || null,
            precio_base: precio || "0",
            opciones: parseOpciones(opciones),
            activo,
          },
        }),
      );
      setMessage("Guardado.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function upload(file: File) {
    const form = new FormData();
    form.append("file", file, file.name);
    try {
      onSaved(
        await api<ProductoAdmin>(`${path}/foto`, {
          method: "POST",
          body: form,
        }),
      );
      setMessage("Foto subida.");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <li className="flex flex-col gap-3 rounded-card border border-border bg-card p-3">
      <h4 className="font-semibold">{producto.nombre}</h4>
      <TextField
        id={`${id}-nombre`}
        label="Nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        maxLength={120}
      />
      <TextAreaField
        id={`${id}-descripcion`}
        label="Descripción"
        optional
        hint="La ven los clientes en la ficha del producto."
        rows={2}
        maxLength={1000}
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
      />
      <div className="flex flex-wrap items-end gap-3">
        <label
          htmlFor={id}
          className="flex flex-col gap-1 text-meta font-semibold"
        >
          Precio base ($)
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            className={input}
          />
        </label>
        <label
          htmlFor={`${id}-opciones`}
          className="flex min-w-48 flex-1 flex-col gap-1 text-meta font-semibold"
        >
          {opcionLabel} (separados por coma)
          <input
            id={`${id}-opciones`}
            value={opciones}
            onChange={(e) => setOpciones(e.target.value)}
            className={`${input} w-full`}
          />
        </label>
        <label
          htmlFor={`${id}-activo`}
          className="flex min-h-11 items-center gap-2 text-base"
        >
          <input
            id={`${id}-activo`}
            type="checkbox"
            checked={activo}
            onChange={(e) => setActivo(e.target.checked)}
            className="size-5 accent-[var(--color-primary)]"
          />
          Se vende
        </label>
        <Button type="button" variant="primary" onClick={save}>
          Guardar
        </Button>
      </div>
      <label
        htmlFor={`${id}-foto`}
        className="flex flex-col gap-1 text-meta font-semibold"
      >
        Foto real {producto.foto_url ? "(ya tiene)" : "(usa el dibujo)"}
        <input
          id={`${id}-foto`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-meta font-normal"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>
      {message ? (
        <p className="text-meta text-accent" role="status">
          {message}
        </p>
      ) : null}
      {error ? <FormMessage>{error}</FormMessage> : null}
    </li>
  );
}

function PrecioGrupoRow({
  slug,
  grupo,
  producto,
  current,
  porDefecto,
  onSaved,
}: {
  slug: string;
  grupo: string;
  producto: ProductoAdmin;
  current: PrecioGrupo | undefined;
  porDefecto: boolean;
  onSaved: (p: PrecioGrupo) => void;
}) {
  const [precio, setPrecio] = React.useState(
    current?.precio ? String(Number(current.precio)) : "",
  );
  const [disponible, setDisponible] = React.useState(
    current?.disponible ?? porDefecto,
  );
  const [status, setStatus] = React.useState<string | null>(null);
  const id = `precio-${grupo}-${producto.slug}`;

  async function save() {
    setStatus(null);
    try {
      onSaved(
        await api<PrecioGrupo>(`/admin/tiendas/${slug}/precios`, {
          method: "PUT",
          body: {
            grupo,
            producto: producto.slug,
            precio: precio || null,
            disponible,
          },
        }),
      );
      setStatus("Guardado.");
    } catch (err) {
      setStatus(errorMessage(err));
    }
  }

  return (
    <tr className="border-t border-border">
      <th scope="row" className="py-2 pr-3 text-left font-semibold">
        {producto.nombre}
      </th>
      <td className="py-2 pr-3">
        <label htmlFor={id} className="sr-only">
          Precio de {producto.nombre}
        </label>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          step={100}
          placeholder={String(Number(producto.precio_base))}
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          className={input}
        />
      </td>
      <td className="py-2 pr-3">
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="checkbox"
            checked={disponible}
            onChange={(e) => setDisponible(e.target.checked)}
            className="size-5 accent-[var(--color-primary)]"
          />
          <span className="sr-only">{producto.nombre} </span>Lo vende
        </label>
      </td>
      <td className="py-2">
        <Button type="button" variant="ghost" onClick={save}>
          Guardar
        </Button>
        <span role="status" className="ml-2 text-meta">
          {status}
        </span>
      </td>
    </tr>
  );
}

export function ProductosAdmin({
  catalogo,
  onChange,
}: {
  catalogo: CatalogoAdmin;
  onChange: (c: CatalogoAdmin) => void;
}) {
  const { tienda } = catalogo;
  const [grupo, setGrupo] = React.useState(catalogo.grupos[0]?.slug ?? "");
  const grupoLabel = tienda.grupo_label.toLowerCase();
  const replaceProducto = (p: ProductoAdmin) =>
    onChange({
      ...catalogo,
      productos: catalogo.productos.some((x) => x.slug === p.slug)
        ? catalogo.productos.map((x) => (x.slug === p.slug ? p : x))
        : [...catalogo.productos, p],
    });

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="nuevo-producto"
        className="flex flex-col gap-3 rounded-card border border-border bg-card p-4"
      >
        <h3 id="nuevo-producto" className="font-heading text-h3 font-semibold">
          Agregar producto
        </h3>
        <NuevoProducto
          slug={tienda.slug}
          opcionLabel={tienda.opcion_label}
          onCreated={replaceProducto}
        />
      </section>

      <section aria-labelledby="precios-base" className="flex flex-col gap-3">
        <h3 id="precios-base" className="font-heading text-h3 font-semibold">
          Productos y precio base
        </h3>
        <p className="text-muted-foreground">
          El precio base rige en todos los {grupoLabel}s, salvo que le cargues
          uno propio abajo.
        </p>
        <ul className="flex flex-col gap-3">
          {catalogo.productos.map((producto) => (
            <ProductoRow
              key={producto.slug}
              slug={tienda.slug}
              producto={producto}
              opcionLabel={tienda.opcion_label}
              onSaved={replaceProducto}
            />
          ))}
        </ul>
      </section>

      <section aria-labelledby="precios-grupo" className="flex flex-col gap-3">
        <h3 id="precios-grupo" className="font-heading text-h3 font-semibold">
          Precios y productos de cada {grupoLabel}
        </h3>
        {catalogo.grupos.length === 0 ? (
          <p className="text-muted-foreground">
            Primero cargá un {grupoLabel}.
          </p>
        ) : (
          <>
            <SelectField
              id="precios-grupo-select"
              label={tienda.grupo_label}
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              className="sm:max-w-md"
            >
              {catalogo.grupos.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.nombre}
                </option>
              ))}
            </SelectField>
            <p className="text-meta text-muted-foreground">
              Precio vacío = precio base.{" "}
              {tienda.productos_en_todos
                ? `Destildá "Lo vende" si ese ${grupoLabel} no usa el producto.`
                : `Tildá "Lo vende" en los productos de este ${grupoLabel}.`}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-base">
                <thead>
                  <tr className="text-left text-meta text-muted-foreground">
                    <th scope="col" className="pb-2">
                      Producto
                    </th>
                    <th scope="col" className="pb-2">
                      Precio ($)
                    </th>
                    <th scope="col" className="pb-2">
                      Disponible
                    </th>
                    <th scope="col" className="pb-2">
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody key={grupo}>
                  {catalogo.productos.map((producto) => (
                    <PrecioGrupoRow
                      key={producto.slug}
                      slug={tienda.slug}
                      grupo={grupo}
                      producto={producto}
                      porDefecto={tienda.productos_en_todos}
                      current={catalogo.precios.find(
                        (p) =>
                          p.grupo === grupo && p.producto === producto.slug,
                      )}
                      onSaved={(saved) =>
                        onChange({
                          ...catalogo,
                          precios: [
                            ...catalogo.precios.filter(
                              (p) =>
                                !(
                                  p.grupo === saved.grupo &&
                                  p.producto === saved.producto
                                ),
                            ),
                            saved,
                          ],
                        })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
