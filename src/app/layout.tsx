import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Videa - Generador Automático de Videos Verticales con IA",
  description: "Ingresa un tema y genera un video vertical con voz en off, subtítulos y animaciones IA listo para publicar en TikTok, Reels y Shorts 100% gratis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${outfit.variable} ${inter.variable} scroll-smooth`}>
      <body className="bg-[#0a0a0f] text-gray-100 font-sans antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
