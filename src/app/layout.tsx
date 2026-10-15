import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import type { ReactNode } from "react";

// Police de la page d'accueil, servie par notre domaine (aucune requête vers Google
// côté visiteur). preload: false, parce que la modale du widget (/embed) partage ce
// layout et n'a pas à la télécharger.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "SwiftStyle",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}
