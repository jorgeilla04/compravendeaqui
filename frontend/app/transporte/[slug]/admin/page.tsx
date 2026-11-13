import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/require-auth";
import { TransporteAdminPanel } from "@/components/transporte/admin-panel";

export const metadata: Metadata = {
  title: "Administrar cotizador",
  robots: { index: false },
};

export default function TransporteAdminPage({
  params,
}: {
  params: { slug: string };
}) {
  return (
    <RequireAuth>
      <TransporteAdminPanel slug={params.slug} />
    </RequireAuth>
  );
}
