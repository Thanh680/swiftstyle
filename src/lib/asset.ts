/**
 * Chemin d'un fichier de public/. La vitrine GitHub Pages est servie sous /swiftstyle
 * (voir next.config.ts) : NEXT_PUBLIC_BASE_PATH y vaut "/swiftstyle", il est vide ailleurs.
 */
export const asset = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
