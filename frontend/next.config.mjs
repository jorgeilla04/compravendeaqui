/** @type {import('next').NextConfig} */

// Origen de las imágenes (bucket S3/MinIO o CDN). Ej: http://localhost:9000
const mediaUrl = new URL(
  process.env.NEXT_PUBLIC_MEDIA_URL ?? "http://localhost:9000",
);

const nextConfig = {
  reactStrictMode: true,
  // Permite builds aislados (e2e) sin pisar el .next de desarrollo.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  poweredByHeader: false,
  // Salida standalone para una imagen Docker liviana.
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: mediaUrl.protocol.replace(":", ""),
        hostname: mediaUrl.hostname,
        port: mediaUrl.port,
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
