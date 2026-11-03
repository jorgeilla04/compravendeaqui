"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { PublishWizard } from "@/components/publish/publish-wizard";

export default function PublicarPage() {
  return (
    <RequireAuth>
      <PublishWizard />
    </RequireAuth>
  );
}
