import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mis avisos",
  robots: { index: false },
};

export default function MisAvisosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
