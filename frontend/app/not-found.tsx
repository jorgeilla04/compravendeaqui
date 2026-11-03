import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-4 py-12">
      <h1 className="font-heading text-h1 font-semibold">
        No encontramos esta página
      </h1>
      <p className="text-base text-muted-foreground">
        Puede que el aviso se haya vendido, vencido o que el link esté mal
        escrito.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/buscar">Buscar avisos</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
