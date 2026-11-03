/** Layout de texto legal: ancho de lectura cómodo y jerarquía clara. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto flex max-w-[60ch] flex-col gap-4 py-4 text-base leading-relaxed [&_h2]:mt-6 [&_h2]:font-heading [&_h2]:text-h2 [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
      <h1 className="font-heading text-h1 font-semibold">{title}</h1>
      <p className="text-meta text-muted-foreground">
        Última actualización: {updated}
      </p>
      {children}
    </article>
  );
}

/** Datos del titular. Completar antes del lanzamiento (Ley 25.326, art. 6). */
export const OWNER = {
  name: "[Razón social del titular]",
  cuit: "[CUIT]",
  address: "[Domicilio legal], San Juan, Argentina",
  email: "[email de contacto]",
};
