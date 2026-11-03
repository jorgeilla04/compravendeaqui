import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Campos de formulario con label visible, hint y error enlazados por
 * aria-describedby (WCAG). Mismo look que <Field> de input.tsx.
 */

const control =
  "w-full rounded-input border border-border bg-card px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive";

interface WrapperProps {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  children: (
    describedBy: string | undefined,
    invalid: boolean,
  ) => React.ReactNode;
}

export function FieldWrapper({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: WrapperProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-meta font-semibold text-foreground">
        {label}
        {optional ? (
          <span className="font-normal text-muted-foreground"> (opcional)</span>
        ) : null}
      </label>
      {children(describedBy, Boolean(error))}
      {hint ? (
        <p id={hintId} className="text-meta text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          className="text-meta font-semibold text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

type Common = {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
};

export const TextField = React.forwardRef<
  HTMLInputElement,
  Common & React.ComponentProps<"input">
>(({ id, label, hint, error, optional, className, ...props }, ref) => (
  <FieldWrapper
    id={id}
    label={label}
    hint={hint}
    error={error}
    optional={optional}
  >
    {(describedBy, invalid) => (
      <input
        ref={ref}
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={cn(control, "h-11 py-2", className)}
        {...props}
      />
    )}
  </FieldWrapper>
));
TextField.displayName = "TextField";

export const TextAreaField = React.forwardRef<
  HTMLTextAreaElement,
  Common & React.ComponentProps<"textarea">
>(({ id, label, hint, error, optional, className, ...props }, ref) => (
  <FieldWrapper
    id={id}
    label={label}
    hint={hint}
    error={error}
    optional={optional}
  >
    {(describedBy, invalid) => (
      <textarea
        ref={ref}
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className={cn(control, "min-h-32 py-2 leading-relaxed", className)}
        {...props}
      />
    )}
  </FieldWrapper>
));
TextAreaField.displayName = "TextAreaField";

export const SelectField = React.forwardRef<
  HTMLSelectElement,
  Common & React.ComponentProps<"select">
>(
  (
    { id, label, hint, error, optional, className, children, ...props },
    ref,
  ) => (
    <FieldWrapper
      id={id}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
    >
      {(describedBy, invalid) => (
        <select
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(
            control,
            "h-11 appearance-none bg-no-repeat pr-9",
            "select-chevron",
            className,
          )}
          {...props}
        >
          {children}
        </select>
      )}
    </FieldWrapper>
  ),
);
SelectField.displayName = "SelectField";

/** Mensaje en línea (errores de envío, avisos). Nunca solo color: lleva texto. */
export function FormMessage({
  tone = "error",
  children,
}: {
  tone?: "error" | "info" | "success";
  children: React.ReactNode;
}) {
  const styles = {
    error: "border-destructive/40 bg-destructive/10",
    info: "border-primary/30 bg-primary/10",
    success: "border-accent/40 bg-accent/10",
  }[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-input border px-3 py-2 text-base text-foreground",
        styles,
      )}
    >
      {children}
    </div>
  );
}
