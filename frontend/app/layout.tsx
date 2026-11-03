import type { Metadata, Viewport } from "next";
import { Rubik, Nunito_Sans } from "next/font/google";

import { AuthProvider } from "@/components/auth/auth-provider";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SITE_URL } from "@/lib/constants";

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
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CompraVendeAqui — Clasificados de San Juan",
    template: "%s · CompraVendeAqui",
  },
  description:
    "Comprá y vendé en San Juan. Publicá tu aviso en minutos y contactá por WhatsApp.",
  applicationName: "CompraVendeAqui",
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "CompraVendeAqui",
  },
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
    <html lang="es-AR" className={`${rubik.variable} ${nunitoSans.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#contenido"
          className="sr-only z-50 rounded-input bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Saltar al contenido
        </a>
        <AuthProvider>
          <SiteHeader />
          <main
            id="contenido"
            className="mx-auto w-full max-w-6xl flex-1 px-4 py-6"
          >
            {children}
          </main>
          <SiteFooter />
          <MobileNav />
        </AuthProvider>
      </body>
    </html>
  );
}
