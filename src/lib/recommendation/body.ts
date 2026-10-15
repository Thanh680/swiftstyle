import type { Body, BodyKey, FitPreference } from "./types";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Estime les tours de poitrine, de taille et de hanches à partir de la taille (cm)
 * et du poids (kg).
 *
 * Formule reprise de la démo du site v0.2. Elle donne un ordre de grandeur
 * plausible mais n'a jamais été comparée à des mesures réelles : à remplacer
 * dès qu'un jeu de mensurations existe. Les résultats qui en dépendent sont
 * marqués `basis: "estimated"` par l'API.
 */
export function estimateBody(heightCm: number, weightKg: number): Required<Body> {
  return {
    chest: Math.round(clamp(0.62 * weightKg + 0.25 * heightCm + 10, 70, 130)),
    waist: Math.round(clamp(0.85 * weightKg + 0.1 * heightCm + 3, 55, 125)),
    hips: Math.round(clamp(0.55 * weightKg + 0.3 * heightCm + 8, 75, 135)),
  };
}

/**
 * Aisance entre un vêtement et le corps qui le porte, par coupe du vêtement,
 * en cm de tour. Valeurs de départ, à recalibrer en mesurant de vrais vêtements
 * portés par de vraies personnes.
 */
export const DEFAULT_EASE: Record<FitPreference, Required<Body>> = {
  ajustee: { chest: 4, waist: 4, hips: 3 },
  normale: { chest: 10, waist: 10, hips: 6 },
  ample: { chest: 20, waist: 20, hips: 12 },
};

export interface GarmentMeasure {
  /** Tours du vêtement lui-même, en cm (pas les mensurations de la personne). */
  measurements: Body;
  /** Coupe du vêtement de référence. */
  cut: FitPreference;
}

/**
 * Option 3 de mai 2026 : déduit les mensurations de l'utilisateur d'un vêtement
 * qu'il possède déjà et dont on connaît les mesures réelles.
 */
export function bodyFromGarment(garment: GarmentMeasure, ease = DEFAULT_EASE): Body {
  const body: Body = {};
  for (const [key, value] of Object.entries(garment.measurements) as [BodyKey, number][]) {
    body[key] = Math.round(value - ease[garment.cut][key]);
  }
  return body;
}
