import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/require-auth";
import { TiendaAdminPanel } from "@/components/tiendas/admin/admin-panel";

export const metadata: Metadata = {
  title: "Administrar tienda",
  robots: { index: false },
};

export default function TiendaAdminPage({
  params,
}: {
  params: { tienda: string };
}) {
  return (
    <RequireAuth>
      <TiendaAdminPanel slug={params.tienda} />
    </RequireAuth>
  );
}
