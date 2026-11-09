import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border pb-24 md:pb-0">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-meta text-muted-foreground md:flex-row md:items-center md:justify-between">
        <p>CompraVendeAqui — clasificados de San Juan, Argentina.</p>
        <nav aria-label="Legal">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            <li>
              <Link
                href="/tiendas"
                className="hover:text-foreground hover:underline"
              >
                Tiendas
              </Link>
            </li>
            <li>
              <Link
                href="/terminos"
                className="hover:text-foreground hover:underline"
              >
                Términos y condiciones
              </Link>
            </li>
            <li>
              <Link
                href="/privacidad"
                className="hover:text-foreground hover:underline"
              >
                Política de privacidad
              </Link>
            </li>
            <li>
              <a
                href="https://www.argentina.gob.ar/aaip"
                className="hover:text-foreground hover:underline"
                rel="noopener noreferrer"
                target="_blank"
              >
                AAIP — Datos personales
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
