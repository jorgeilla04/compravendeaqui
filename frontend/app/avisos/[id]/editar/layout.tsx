import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Editar aviso",
  robots: { index: false },
};

export default function EditarAvisoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
