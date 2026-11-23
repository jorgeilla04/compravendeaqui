import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/require-auth";
import { CalendarioRedes } from "@/components/redes/calendario-redes";

export const metadata: Metadata = {
  title: "Calendario de publicaciones",
  robots: { index: false },
};

export default function CalendarioRedesPage() {
  return (
    <RequireAuth>
      <CalendarioRedes />
    </RequireAuth>
  );
}
