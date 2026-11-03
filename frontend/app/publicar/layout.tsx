import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Publicar aviso",
  description: "Publicá tu aviso en San Juan en pocos pasos, desde el celular.",
  robots: { index: false },
};

export default function PublicarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
