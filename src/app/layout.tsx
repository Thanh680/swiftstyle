import type { Metadata } from "next";
import { Archivo, Plus_Jakarta_Sans } from "next/font/google";
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

// Police de la boutique fictive de la démo et de sa modale, chargée de la même façon.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "SwiftStyle",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${archivo.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
