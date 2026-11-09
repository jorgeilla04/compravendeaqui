"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { FormMessage, SelectField } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import type {
  CatalogoAdmin,
  PrecioColegio,
  PrendaAdmin,
} from "@/lib/uniformes/types";

const input =
  "h-11 w-32 rounded-input border border-border bg-card px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function PrendaBaseRow({
  prenda,
  onSaved,
}: {
  prenda: PrendaAdmin;
  onSaved: (p: PrendaAdmin) => void;
}) {
  const [precio, setPrecio] = React.useState(
    String(Number(prenda.precio_base)),
  );
  const [activo, setActivo] = React.useState(prenda.activo);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const id = `base-${prenda.slug}`;

  async function save() {
    setMessage(null);
    setError(null);
    try {
      onSaved(
        await api<PrendaAdmin>(`/admin/uniformes/prendas/${prenda.slug}`, {
          method: "PUT",
          body: { precio_base: precio || "0", activo },
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
        await api<PrendaAdmin>(`/admin/uniformes/prendas/${prenda.slug}/foto`, {
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
    <li className="flex flex-col gap-2 rounded-card border border-border bg-card p-3">
      <div className="flex flex-wrap items-end gap-3">
        <span className="min-w-36 font-semibold">{prenda.nombre}</span>
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
        Foto real de la prenda{" "}
        {prenda.foto_url ? "(ya tiene)" : "(usa la ilustración)"}
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

function PrecioColegioRow({
  colegio,
  prenda,
  current,
  onSaved,
}: {
  colegio: string;
  prenda: PrendaAdmin;
  current: PrecioColegio | undefined;
  onSaved: (p: PrecioColegio) => void;
}) {
  const [precio, setPrecio] = React.useState(
    current?.precio ? String(Number(current.precio)) : "",
  );
  const [disponible, setDisponible] = React.useState(
    current?.disponible ?? true,
  );
  const [status, setStatus] = React.useState<string | null>(null);
  const id = `precio-${colegio}-${prenda.slug}`;

  async function save() {
    setStatus(null);
    try {
      onSaved(
        await api<PrecioColegio>("/admin/uniformes/precios", {
          method: "PUT",
          body: {
            colegio,
            prenda: prenda.slug,
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
        {prenda.nombre}
      </th>
      <td className="py-2 pr-3">
        <label htmlFor={id} className="sr-only">
          Precio de {prenda.nombre}
        </label>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          step={100}
          placeholder={String(Number(prenda.precio_base))}
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
          <span className="sr-only">{prenda.nombre} </span>Lo usa
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

export function PreciosAdmin({
  catalogo,
  onChange,
}: {
  catalogo: CatalogoAdmin;
  onChange: (c: CatalogoAdmin) => void;
}) {
  const [colegio, setColegio] = React.useState(
    catalogo.colegios[0]?.slug ?? "",
  );

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="precios-base" className="flex flex-col gap-3">
        <h3 id="precios-base" className="font-heading text-h3 font-semibold">
          Precio base de cada prenda
        </h3>
        <p className="text-muted-foreground">
          Rige para todos los colegios, salvo que le cargues un precio propio
          abajo.
        </p>
        <ul className="flex flex-col gap-3">
          {catalogo.prendas.map((prenda) => (
            <PrendaBaseRow
              key={prenda.slug}
              prenda={prenda}
              onSaved={(p) =>
                onChange({
                  ...catalogo,
                  prendas: catalogo.prendas.map((x) =>
                    x.slug === p.slug ? p : x,
                  ),
                })
              }
            />
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="precios-colegio"
        className="flex flex-col gap-3"
      >
        <h3 id="precios-colegio" className="font-heading text-h3 font-semibold">
          Precios de un colegio
        </h3>
        {catalogo.colegios.length === 0 ? (
          <p className="text-muted-foreground">Primero cargá un colegio.</p>
        ) : (
          <>
            <SelectField
              id="precios-colegio-select"
              label="Colegio"
              value={colegio}
              onChange={(e) => setColegio(e.target.value)}
              className="sm:max-w-md"
            >
              {catalogo.colegios.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.nombre}
                </option>
              ))}
            </SelectField>
            <p className="text-meta text-muted-foreground">
              Vacío = precio base. Destildá &quot;Lo usa&quot; si ese colegio no
              tiene esa prenda.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-base">
                <thead>
                  <tr className="text-left text-meta text-muted-foreground">
                    <th scope="col" className="pb-2">
                      Prenda
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
                <tbody key={colegio}>
                  {catalogo.prendas.map((prenda) => (
                    <PrecioColegioRow
                      key={prenda.slug}
                      colegio={colegio}
                      prenda={prenda}
                      current={catalogo.precios.find(
                        (p) =>
                          p.colegio === colegio && p.prenda === prenda.slug,
                      )}
                      onSaved={(saved) =>
                        onChange({
                          ...catalogo,
                          precios: [
                            ...catalogo.precios.filter(
                              (p) =>
                                !(
                                  p.colegio === saved.colegio &&
                                  p.prenda === saved.prenda
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
