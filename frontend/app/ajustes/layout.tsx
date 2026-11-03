import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ajustes",
  robots: { index: false },
};

export default function AjustesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
