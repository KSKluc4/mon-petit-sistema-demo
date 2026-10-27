import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mon Petit — Pet Shop",
    short_name: "Mon Petit",
    description: "Sistema de gestão do Pet Shop Mon Petit",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#107f7f",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
