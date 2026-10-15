import type { NextConfig } from "next";

const config: NextConfig = {
  // Le badge de dev de Next s'afficherait dans l'iframe du widget, par-dessus ses boutons.
  devIndicators: false,
  // PGlite charge son WebAssembly depuis son propre dossier : ne pas l'empaqueter.
  serverExternalPackages: ["@electric-sql/pglite", "postgres"],
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
};

export default config;
