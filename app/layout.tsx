import type { Metadata, Viewport } from "next";
import { Nunito, Inter } from "next/font/google";
import "./globals.css";
import { EH_AMBIENTE_TESTE } from "@/lib/ambienteCliente";
import { TarjaAmbienteTeste } from "@/components/ui/TarjaAmbienteTeste";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// No ambiente de teste o aviso vai também no título da aba: a tarja rola para
// fora da tela numa página longa, o título não. Some sozinho na produção.
export const metadata: Metadata = {
  title: {
    default: EH_AMBIENTE_TESTE ? "[TESTE] Mon Petit" : "Mon Petit",
    template: EH_AMBIENTE_TESTE ? "[TESTE] Mon Petit · %s" : "Mon Petit · %s",
  },
  description: "Sistema de gestão do Pet Shop Mon Petit",
};

export const viewport: Viewport = {
  themeColor: "#107f7f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${nunito.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <TarjaAmbienteTeste />
        {children}
      </body>
    </html>
  );
}
