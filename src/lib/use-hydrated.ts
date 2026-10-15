"use client";

import { useEffect, useState } from "react";

/**
 * Vrai une fois React branché sur la page. Sert à désactiver les boutons
 * d'envoi avant : sinon un clic trop rapide soumet le formulaire en HTML pur,
 * et ses champs partent dans l'URL.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
