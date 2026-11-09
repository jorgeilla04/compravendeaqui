import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/require-auth";
import { MisTiendas } from "@/components/tiendas/admin/mis-tiendas";

export const metadata: Metadata = {
  title: "Mis tiendas",
  robots: { index: false },
};

export default function MisTiendasPage() {
  return (
    <RequireAuth>
      <MisTiendas />
    </RequireAuth>
  );
}
