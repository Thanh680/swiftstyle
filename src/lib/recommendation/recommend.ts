import type { Alternative, Body, BodyKey, FitDetail, FitPreference, SizeChart, SizeResult } from "./types";

/**
 * Algorithme repris de la démo du site v0.2 : chaque taille reçoit un score
 * d'écart pondéré entre les mensurations et le milieu de ses intervalles,
 * la taille au plus petit écart l'emporte.
 */

/** Décalage appliqué aux mensurations selon la préférence de port, en cm. */
const SHIFT: Record<FitPreference, number> = { ajustee: -1.5, normale: 0, ample: 3.5 };

const WHERE: Record<BodyKey, string> = {
  chest: "à la poitrine",
  waist: "à la taille",
  hips: "aux hanches",
};

export class RecommendError extends Error {
  constructor(
    readonly code: "invalid_chart" | "missing_measurements",
    message: string,
  ) {
    super(message);
    this.name = "RecommendError";
  }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round2 = (v: number) => Math.round(v * 100) / 100;

/** Position d'une valeur dans un intervalle : 0 au milieu, -1 et +1 aux bornes. */
const position = (v: number, [min, max]: [number, number]) => (v - (min + max) / 2) / ((max - min) / 2);

const LETTER_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL"];

/** Ordre naturel des libellés de taille : XS < S < M, W30 < W32, 38 < 40. */
export function compareSizes(a: string, b: string): number {
  const ia = LETTER_SIZES.indexOf(a.toUpperCase());
  const ib = LETTER_SIZES.indexOf(b.toUpperCase());
  if (ia >= 0 && ib >= 0) return ia - ib;
  const na = Number.parseFloat(a.replace(/^\D+/, ""));
  const nb = Number.parseFloat(b.replace(/^\D+/, ""));
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.localeCompare(b);
}

export function feel(p: number): string {
  if (p > 1) return "Serré";
  if (p > 0.4) return "Près du corps";
  if (p >= -0.4) return "Juste";
  if (p >= -1) return "Un peu ample";
  return "Ample";
}

/** Liste les incohérences d'un guide des tailles. Tableau vide si le guide est utilisable. */
export function validateChart(chart: SizeChart): string[] {
  const errors: string[] = [];
  if (chart.sizes.length === 0) errors.push("aucune taille");
  const weighted = Object.entries(chart.weights) as [BodyKey, number][];
  if (weighted.length === 0) errors.push("aucune mensuration pondérée");
  for (const [key, weight] of weighted) {
    if (!(weight > 0)) errors.push(`poids de ${key} non positif`);
    const ranges = chart.ranges[key];
    if (!ranges) {
      errors.push(`${key} est pondéré mais n'a pas d'intervalles`);
      continue;
    }
    if (ranges.length !== chart.sizes.length) {
      errors.push(`${key} : ${ranges.length} intervalles pour ${chart.sizes.length} tailles`);
    }
    ranges.forEach(([min, max], i) => {
      if (!(max > min)) errors.push(`${key}, taille ${chart.sizes[i] ?? i} : intervalle vide`);
    });
  }
  return errors;
}

export function recommendSize(chart: SizeChart, body: Body, fit: FitPreference = "normale"): SizeResult {
  const errors = validateChart(chart);
  if (errors.length) throw new RecommendError("invalid_chart", errors.join(" ; "));

  // Mensuration la plus déterminante en premier (l'ordre des clés jsonb n'est pas garanti).
  const weighted = (Object.entries(chart.weights) as [BodyKey, number][]).sort((a, b) => b[1] - a[1]);
  const total = weighted.reduce((s, [, w]) => s + w, 0);
  const used = weighted.filter(([k]) => typeof body[k] === "number");
  const coverage = used.reduce((s, [, w]) => s + w, 0) / total;
  if (coverage < 0.5) {
    const missing = weighted.filter(([k]) => typeof body[k] !== "number").map(([k]) => k);
    throw new RecommendError("missing_measurements", `mensurations manquantes pour cet article : ${missing.join(", ")}`);
  }

  const shift = SHIFT[fit];
  const rangeOf = (k: BodyKey, i: number) => chart.ranges[k]![i]!;
  const valueOf = (k: BodyKey) => body[k]!;

  const scoreOf = (i: number) => used.reduce((s, [k, w]) => s + (w / coverage / total) * Math.abs(position(valueOf(k) + shift, rangeOf(k, i))), 0);
  const worstOf = (i: number) => Math.max(...used.map(([k]) => Math.abs(position(valueOf(k) + shift, rangeOf(k, i)))));
  const confidenceOf = (i: number, floor: number) =>
    round2(clamp(0.99 - 0.12 * scoreOf(i) - 0.08 * Math.max(0, worstOf(i) - 1), floor, 0.99) * coverage);

  let best = 0;
  let bestScore = Infinity;
  chart.sizes.forEach((_, i) => {
    const s = scoreOf(i);
    if (s < bestScore - 1e-9) {
      bestScore = s;
      best = i;
    }
  });

  const details: FitDetail[] = used.map(([k]) => {
    const p = position(valueOf(k), rangeOf(k, best));
    return { key: k, position: round2(p), feel: feel(p) };
  });

  const alternatives: Alternative[] = [best - 1, best + 1]
    .filter((i) => i >= 0 && i < chart.sizes.length)
    .map((i) => {
      let worstKey = used[0]![0];
      let worstPos = 0;
      for (const [k] of used) {
        const p = position(valueOf(k), rangeOf(k, i));
        if (Math.abs(p) > Math.abs(worstPos)) {
          worstPos = p;
          worstKey = k;
        }
      }
      return {
        size: chart.sizes[i]!,
        confidence: confidenceOf(i, 0),
        note: `${feel(worstPos).toLowerCase()} ${WHERE[worstKey]}`,
      };
    });

  const size = chart.sizes[best]!;
  return {
    size,
    index: best,
    confidence: confidenceOf(best, 0.52),
    reason: `Taille ${size} : ${details.map((d) => `${d.feel.toLowerCase()} ${WHERE[d.key]}`).join(", ")}.`,
    details,
    alternatives,
  };
}
