import { defineConfig } from "vite";

// Compile widget/ (le script que les marchands collent sur leur site) en un seul
// fichier, servi par Next.js depuis public/v1/widget.js. Ce n'est pas du React :
// il doit rester minuscule et ne rien casser chez le marchand.
// La version est dans l'URL : une v2 pourra coexister sans casser les installations existantes.
export default defineConfig({
  // public/ est servi par Next.js : Vite n'a pas à le recopier.
  publicDir: false,
  build: {
    lib: {
      entry: "widget/index.ts",
      formats: ["iife"],
      name: "SwiftStyleWidget",
      fileName: () => "widget.js",
    },
    outDir: "public/v1",
    emptyOutDir: false,
    minify: true,
    target: "es2022",
  },
});
