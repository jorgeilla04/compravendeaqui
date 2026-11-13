"use client";

import { MapPin, X } from "lucide-react";
import * as React from "react";

import { api } from "@/lib/api";
import type { Lugar } from "@/lib/transporte/types";
import { cn } from "@/lib/utils";

/**
 * Campo de lugar con sugerencias (combobox): se escribe, se elige uno de la
 * lista y queda fijado con sus coordenadas para calcular los km por ruta.
 */
export function LugarField({
  id,
  label,
  value,
  onChange,
  error,
  disabled,
}: {
  id: string;
  label: string;
  value: Lugar | null;
  onChange: (lugar: Lugar | null) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const [texto, setTexto] = React.useState("");
  const [sugerencias, setSugerencias] = React.useState<Lugar[]>([]);
  const [activo, setActivo] = React.useState(-1);
  const [abierto, setAbierto] = React.useState(false);
  const [estado, setEstado] = React.useState<"" | "buscando" | "sin" | "error">(
    "",
  );
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listId = `${id}-lista`;
  const errorId = `${id}-error`;

  React.useEffect(() => {
    const q = texto.trim();
    if (value || q.length < 3) {
      setSugerencias([]);
      setEstado("");
      return;
    }
    setEstado("buscando");
    const timer = window.setTimeout(() => {
      api<Lugar[]>("/transporte/lugares", { query: { q } })
        .then((lugares) => {
          setSugerencias(lugares);
          setActivo(lugares.length ? 0 : -1);
          setEstado(lugares.length ? "" : "sin");
          setAbierto(true);
        })
        .catch(() => setEstado("error"));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [texto, value]);

  function elegir(lugar: Lugar) {
    onChange(lugar);
    setTexto("");
    setSugerencias([]);
    setAbierto(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!abierto || sugerencias.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActivo((i) => (i + 1) % sugerencias.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActivo((i) => (i - 1 + sugerencias.length) % sugerencias.length);
    } else if (event.key === "Enter" && activo >= 0) {
      event.preventDefault();
      elegir(sugerencias[activo]);
    } else if (event.key === "Escape") {
      setAbierto(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-meta font-semibold text-foreground">
        {label}
      </label>
      {value ? (
        <div className="flex min-h-11 items-center gap-2 rounded-input border border-border bg-card px-3 py-2">
          <MapPin aria-hidden="true" className="size-4 shrink-0 text-primary" />
          <span id={id} className="min-w-0 flex-1">
            <span className="font-semibold">{value.nombre}</span>
            {value.detalle ? (
              <span className="text-meta text-muted-foreground">
                {" "}
                · {value.detalle}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              window.setTimeout(() => inputRef.current?.focus(), 0);
            }}
            disabled={disabled}
            aria-label={`Cambiar ${label.toLowerCase()}`}
            className="flex size-9 shrink-0 items-center justify-center rounded-input text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-expanded={abierto && sugerencias.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              abierto && activo >= 0 ? `${listId}-${activo}` : undefined
            }
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? errorId : undefined}
            autoComplete="off"
            placeholder="Ciudad, barrio, empresa o dirección"
            value={texto}
            disabled={disabled}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => sugerencias.length && setAbierto(true)}
            onBlur={() => window.setTimeout(() => setAbierto(false), 150)}
            className="h-11 w-full rounded-input border border-border bg-card px-3 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid]:border-destructive"
          />
          {abierto && sugerencias.length > 0 ? (
            <ul
              id={listId}
              role="listbox"
              aria-label={`Sugerencias para ${label.toLowerCase()}`}
              className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-input border border-border bg-card py-1 shadow-lg"
            >
              {sugerencias.map((lugar, i) => (
                <li
                  key={`${lugar.lat},${lugar.lon},${i}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === activo}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    elegir(lugar);
                  }}
                  onMouseEnter={() => setActivo(i)}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 px-3 py-2.5",
                    i === activo && "bg-muted",
                  )}
                >
                  <MapPin
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  />
                  <span>
                    <span className="font-semibold">{lugar.nombre}</span>
                    {lugar.detalle ? (
                      <span className="block text-meta text-muted-foreground">
                        {lugar.detalle}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      <p aria-live="polite" className="text-meta text-muted-foreground">
        {estado === "buscando"
          ? "Buscando…"
          : estado === "sin"
            ? "No encontramos ese lugar. Probá con la ciudad o una calle cercana."
            : estado === "error"
              ? "No pudimos buscar lugares ahora. Probá de nuevo."
              : null}
      </p>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-meta font-semibold text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
