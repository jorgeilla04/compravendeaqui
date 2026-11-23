import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/require-auth";
import { HistorialRedes } from "@/components/redes/historial-redes";

export const metadata: Metadata = {
  title: "Redes sociales",
  robots: { index: false },
};

export default function RedesPage() {
  return (
    <RequireAuth>
      <HistorialRedes />
    </RequireAuth>
  );
}
