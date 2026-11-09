import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/require-auth";
import { AdminPanel } from "@/components/uniformes/admin/admin-panel";

export const metadata: Metadata = {
  title: "Administrar la tienda de uniformes",
  robots: { index: false },
};

export default function UniformesAdminPage() {
  return (
    <RequireAuth>
      <AdminPanel />
    </RequireAuth>
  );
}
