/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Salida standalone para una imagen Docker liviana.
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
