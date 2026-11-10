import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { AuthProvider } from "@/components/auth/auth-provider";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SITE_URL } from "@/lib/constants";

import "./globals.css";

// Fuentes servidas desde el propio sitio (variables, solo latin): el build no
// depende de Google Fonts y los visitantes no le pasan datos a terceros.
const rubik = localFont({
  src: "../node_modules/@fontsource-variable/rubik/files/rubik-latin-wght-normal.woff2",
  weight: "300 900",
  variable: "--font-rubik",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

const nunitoSans = localFont({
  src: "../node_modules/@fontsource-variable/nunito-sans/files/nunito-sans-latin-wght-normal.woff2",
  weight: "200 1000",
  variable: "--font-nunito",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
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
    { media: "(prefers-color-scheme: light)", color: "#16233f" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1020" },
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
