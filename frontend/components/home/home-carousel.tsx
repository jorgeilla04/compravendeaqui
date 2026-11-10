"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Slide {
  id: string;
  titulo: string;
  texto: string;
  cta: { href: string; label: string };
  imagen: string;
  /** Encuadre de la foto (object-position) para que el motivo no quede tapado. */
  encuadre: string;
  credito: { autor: string; licencia: string; fuente: string };
}

const INTERVALO_MS = 7000;

/**
 * Carrusel principal de la portada: fotos de Ischigualasto con el mensaje
 * encima. Avanza solo, se pausa al pasar el mouse o enfocar, y tiene botón de
 * pausa (WCAG 2.2.2). Sin avance automático si el sistema pide menos movimiento.
 */
export function HomeCarousel({ slides }: { slides: Slide[] }) {
  const [actual, setActual] = React.useState(0);
  const [pausado, setPausado] = React.useState(false);
  const [enPausa, setEnPausa] = React.useState(false); // hover o foco adentro
  const [quieto, setQuieto] = React.useState(false); // prefers-reduced-motion
  const total = slides.length;

  React.useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setQuieto(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    if (pausado || enPausa || quieto || total < 2) return;
    const timer = window.setTimeout(
      () => setActual((i) => (i + 1) % total),
      INTERVALO_MS,
    );
    return () => window.clearTimeout(timer);
  }, [actual, pausado, enPausa, quieto, total]);

  const ir = (i: number) => setActual((i + total) % total);

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Novedades de CompraVendeAqui"
      className="relative overflow-hidden rounded-card bg-header text-header-foreground shadow-md"
      onMouseEnter={() => setEnPausa(true)}
      onMouseLeave={() => setEnPausa(false)}
      onFocus={() => setEnPausa(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setEnPausa(false);
      }}
    >
      <div className="relative aspect-[4/3] w-full sm:aspect-[2/1] lg:aspect-[16/5]">
        {slides.map((slide, i) => {
          const activo = i === actual;
          return (
            <div
              key={slide.id}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} de ${total}: ${slide.titulo}`}
              aria-hidden={!activo}
              // React 18 no conoce `inert`: se pone a mano para sacar del Tab
              // los links de las diapositivas ocultas.
              ref={(el) => {
                el?.toggleAttribute("inert", !activo);
              }}
              className={cn(
                "absolute inset-0 transition-opacity duration-700 ease-out",
                activo ? "opacity-100" : "pointer-events-none opacity-0",
              )}
            >
              <Image
                src={slide.imagen}
                alt=""
                fill
                priority={i === 0}
                sizes="(min-width: 1152px) 1120px, 100vw"
                style={{ objectPosition: slide.encuadre }}
                className={cn(
                  "object-cover transition-transform ease-out [transition-duration:7000ms]",
                  activo ? "scale-100" : "scale-105",
                )}
              />
              {/* Velo para que el texto se lea sobre cualquier parte de la foto. */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[rgb(14_22_42/0.92)] via-[rgb(14_22_42/0.4)] via-55% to-transparent lg:bg-gradient-to-r lg:from-[rgb(14_22_42/0.88)] lg:via-[rgb(14_22_42/0.5)] lg:to-transparent"
              />
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-3 p-5 pb-16 sm:p-8 sm:pb-24 lg:inset-y-0 lg:right-auto lg:w-1/2 lg:justify-center lg:pb-14 lg:pl-20">
                <h2 className="max-w-md text-balance font-heading text-h1 font-bold leading-tight sm:text-[2.25rem] sm:leading-[1.1]">
                  {slide.titulo}
                </h2>
                <p className="hidden max-w-sm text-base text-header-foreground min-[480px]:block">
                  {slide.texto}
                </p>
                <Button
                  asChild
                  // El ocre es solo para publicar; el resto, rojo arenisca.
                  variant={
                    slide.cta.href === "/publicar" ? "accent" : "primary"
                  }
                  size="lg"
                  className="mt-1"
                >
                  <Link href={slide.cta.href}>{slide.cta.label}</Link>
                </Button>
              </div>
              <a
                href={slide.credito.fuente}
                target="_blank"
                rel="noopener noreferrer license"
                className="absolute right-3 top-2 rounded-input bg-[rgb(14_22_42/0.55)] px-1.5 text-[0.6875rem] leading-5 text-header-foreground underline-offset-2 hover:underline"
              >
                Foto: {slide.credito.autor} · {slide.credito.licencia}
              </a>
            </div>
          );
        })}
      </div>

      {total > 1 ? (
        <div className="absolute bottom-7 left-4 flex items-center gap-1 sm:bottom-9 sm:left-7 lg:left-[4.75rem]">
          <button
            type="button"
            onClick={() => setPausado((p) => !p)}
            aria-label={pausado ? "Reanudar el carrusel" : "Pausar el carrusel"}
            className="flex size-8 items-center justify-center rounded-pill text-header-foreground hover:bg-white/15"
          >
            {pausado ? (
              <Play aria-hidden="true" className="size-4" />
            ) : (
              <Pause aria-hidden="true" className="size-4" />
            )}
          </button>
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => ir(i)}
              aria-label={`Ver diapositiva ${i + 1}: ${slide.titulo}`}
              aria-current={i === actual}
              className="flex size-8 items-center justify-center rounded-pill"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block h-1.5 rounded-pill transition-all duration-300",
                  i === actual
                    ? "w-6 bg-accent"
                    : "w-1.5 bg-[rgb(243_241_238/0.6)]",
                )}
              />
            </button>
          ))}
        </div>
      ) : null}

      {total > 1 ? (
        <>
          <button
            type="button"
            onClick={() => ir(actual - 1)}
            aria-label="Diapositiva anterior"
            className="absolute left-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-pill bg-card text-card-foreground shadow transition-colors hover:text-primary md:flex"
          >
            <ChevronLeft aria-hidden="true" className="size-6" />
          </button>
          <button
            type="button"
            onClick={() => ir(actual + 1)}
            aria-label="Diapositiva siguiente"
            className="absolute right-2 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-pill bg-card text-card-foreground shadow transition-colors hover:text-primary md:flex"
          >
            <ChevronRight aria-hidden="true" className="size-6" />
          </button>
        </>
      ) : null}
    </section>
  );
}
