import type { Metadata } from "next";

import { RequireAuth } from "@/components/auth/require-auth";
import { ModeracionPanel } from "@/components/moderacion/moderacion-panel";

export const metadata: Metadata = {
  title: "Moderación",
  robots: { index: false },
};

export default function ModeracionPage() {
  return (
    <RequireAuth>
      <ModeracionPanel />
    </RequireAuth>
  );
}
