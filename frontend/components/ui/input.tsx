import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Input de DESIGN.md: radio 8px, label SIEMPRE visible (ver componente Field).
 * No usar placeholder como sustituto de label.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-input border border-border bg-card px-3 py-2 text-base text-foreground",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

/** Campo con label visible asociado (accesibilidad WCAG). */
interface FieldProps extends React.ComponentProps<"input"> {
  label: string;
  id: string;
  hint?: string;
}

const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, id, hint, className, ...props }, ref) => {
    const hintId = hint ? `${id}-hint` : undefined;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-meta font-semibold text-foreground">
          {label}
        </label>
        <Input
          id={id}
          ref={ref}
          aria-describedby={hintId}
          className={className}
          {...props}
        />
        {hint ? (
          <p id={hintId} className="text-meta text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    );
  },
);
Field.displayName = "Field";

export { Input, Field };
