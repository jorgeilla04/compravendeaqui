import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Indicador de pasos: texto "Paso N de M", nombres de cada paso, tilde en los
 * completos y aria-current en el actual. El color nunca es la única señal.
 */
export function StepIndicator({
  steps,
  current,
}: {
  steps: readonly string[];
  current: number;
}) {
  return (
    <nav aria-label="Pasos para publicar" className="flex flex-col gap-3">
      <p className="text-meta font-semibold text-foreground">
        Paso {current + 1} de {steps.length}
        <span className="font-normal text-muted-foreground">
          {" "}
          · {steps[current]}
        </span>
      </p>
      <ol className="grid grid-cols-5 gap-1.5">
        {steps.map((name, index) => {
          const done = index < current;
          const active = index === current;
          return (
            <li
              key={name}
              aria-current={active ? "step" : undefined}
              className="flex flex-col gap-1.5"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 rounded-pill",
                  done || active ? "bg-primary" : "bg-border",
                )}
              />
              <span
                className={cn(
                  "flex items-center gap-1 text-meta",
                  active
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {done ? (
                  <Check aria-hidden="true" className="size-3.5 shrink-0" />
                ) : null}
                <span className="truncate">{name}</span>
                {done ? <span className="sr-only"> (listo)</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
