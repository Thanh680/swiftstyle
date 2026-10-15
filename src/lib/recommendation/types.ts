/** Mensurations prises en compte, en centimètres de tour de corps. */
export const BODY_KEYS = ["chest", "waist", "hips"] as const;
export type BodyKey = (typeof BODY_KEYS)[number];
export type Body = Partial<Record<BodyKey, number>>;

/** Comment l'utilisateur dit porter ses vêtements. */
export const FIT_PREFERENCES = ["ajustee", "normale", "ample"] as const;
export type FitPreference = (typeof FIT_PREFERENCES)[number];

/**
 * Guide des tailles d'un produit ou d'une catégorie.
 * `ranges[k][i]` est l'intervalle [min, max] de la mensuration `k` pour la taille `sizes[i]`.
 * `weights` dit quelles mensurations comptent pour cet article, et combien.
 */
export interface SizeChart {
  sizes: string[];
  ranges: Partial<Record<BodyKey, [number, number][]>>;
  weights: Partial<Record<BodyKey, number>>;
}

/** Thème du widget, surchargeable par la marque (ARCHITECTURE-TECHNIQUE.md § 9). */
export interface Theme {
  font?: string;
  radius?: string;
  accent?: string;
  bg?: string;
  text?: string;
  border?: string;
}

/** D'où viennent les mensurations utilisées pour la recommandation. */
export type Basis = "measured" | "estimated" | "reference";

export interface FitDetail {
  key: BodyKey;
  /** 0 = milieu de l'intervalle de la taille, -1 / +1 = ses bornes. */
  position: number;
  feel: string;
}

export interface Alternative {
  size: string;
  confidence: number;
  note: string;
}

export interface SizeResult {
  size: string;
  index: number;
  /**
   * Indice de proximité entre les mensurations et le guide des tailles, de 0 à 1.
   * Ce n'est pas un taux de bonnes recommandations mesuré : aucun n'existe à ce jour.
   */
  confidence: number;
  reason: string;
  details: FitDetail[];
  alternatives: Alternative[];
}
