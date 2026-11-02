import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JurisAI | Gestão e Inteligência Jurídica",
  description: "Ambiente privado de gestão e inteligência jurídica."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
