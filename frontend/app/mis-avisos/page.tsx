"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { MyListings } from "@/components/publish/my-listings";

export default function MisAvisosPage() {
  return (
    <RequireAuth>
      <MyListings />
    </RequireAuth>
  );
}
