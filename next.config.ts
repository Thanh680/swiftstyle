import type { NextConfig } from "next";

// Vitrine statique pour GitHub Pages (.github/workflows/pages.yml) : la page d'accueil seule, sans
// l'API ni /embed qui ont besoin d'un serveur, servie sous https://thanh680.github.io/swiftstyle/.
const pages = process.env.GITHUB_PAGES === "1";
const basePath = pages ? "/swiftstyle" : "";

const config: NextConfig = {
  // Le site exporté sort dans out/ (publié par le workflow), sans toucher au .next du serveur de dev.
  ...(pages ? { output: "export" as const, basePath, distDir: "out" } : {}),
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // Le badge de dev de Next s'afficherait dans l'iframe du widget, par-dessus ses boutons.
  devIndicators: false,
  // PGlite charge son WebAssembly depuis son propre dossier : ne pas l'empaqueter.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
  // Les en-têtes ne s'appliquent qu'avec un serveur Next (pas sur GitHub Pages).
  ...(pages
    ? {}
    : {
        async headers() {
          return [
            {
              // La modale doit pouvoir s'afficher dans une iframe chez n'importe quel marchand.
              // À restreindre aux domaines de chaque boutique avant le premier pilote (voir README).
              source: "/embed",
              headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
            },
            {
              // Le script du widget est chargé depuis les sites des marchands.
              source: "/v1/widget.js",
              headers: [
                { key: "Access-Control-Allow-Origin", value: "*" },
                { key: "Cache-Control", value: "public, max-age=300" },
              ],
            },
          ];
        },
      }),
};

export default config;
