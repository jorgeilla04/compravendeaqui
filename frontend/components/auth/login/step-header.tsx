import * as React from "react";

/** Encabezado de cada paso: un h1 por pantalla, enfocable para lectores de pantalla. */
export function StepHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  const ref = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    // Al cambiar de paso, el foco va al título para anunciar la nueva pantalla.
    if (document.activeElement && document.activeElement !== document.body) {
      ref.current?.focus();
    }
  }, []);
  return (
    <header className="flex flex-col gap-2">
      <h1
        ref={ref}
        tabIndex={-1}
        className="font-heading text-h1 font-semibold focus:outline-none"
      >
        {title}
      </h1>
      {children ? (
        <div className="text-base text-muted-foreground">{children}</div>
      ) : null}
    </header>
  );
}
