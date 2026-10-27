import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Fotos de pets tiradas por celular/tablet passam facilmente de 1MB (padrão do Next).
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
