import type { Metadata, Viewport } from "next";
import { Rubik, Nunito_Sans } from "next/font/google";

import "./globals.css";

const rubik = Rubik({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-rubik",
  display: "swap",
});

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CompraVendeAqui — Clasificados de San Juan",
    template: "%s · CompraVendeAqui",
  },
  description:
    "Comprá y vendé en San Juan. Publicá tu aviso en minutos y contactá por WhatsApp.",
  applicationName: "CompraVendeAqui",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eff6ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f1a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${rubik.variable} ${nunitoSans.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
