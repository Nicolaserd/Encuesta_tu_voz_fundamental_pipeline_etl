import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Transformador CAI",
  description: "Procesa las respuestas del Diagnóstico CAI y genera los reportes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
