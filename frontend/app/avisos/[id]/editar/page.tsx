"use client";

import { Suspense } from "react";

import { RequireAuth } from "@/components/auth/require-auth";
import { EditListing } from "@/components/publish/edit-listing";

export default function EditarAvisoPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <RequireAuth>
      <Suspense>
        <EditListing id={params.id} />
      </Suspense>
    </RequireAuth>
  );
}
