import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// 👇 Imports existants
import OracleWrapper from "@/components/OracleWrapper";
// 👇 1. IMPORT DU FOOTER
import Footer from "@/components/Footer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gamaar",
  description: "L'application de recommandation ultime",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      {/* 👇 2. AJOUT DE STYLES FLEXBOX SUR LE BODY */}
      <body className={inter.className} style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        
        {/* 👇 3. ON ENVELOPPE LES ENFANTS DANS UNE DIV QUI PREND TOUTE LA PLACE (flex: 1) */}
        <div style={{ flex: 1 }}>
          {children}
        </div>

        {/* 👇 4. LE FOOTER ARRIVE ICI (JUSTE AVANT LE WIDGET) */}
        <Footer />
        
        {/* 👇 5. LE WIDGET ORACLE RESTE LÀ */}
        <OracleWrapper/> 
        
      </body>
    </html>
  );
}