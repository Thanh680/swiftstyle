import { describe, expect, it } from "vitest";
import { bodyFromGarment, estimateBody } from "./body";
import { compareSizes, RecommendError, recommendSize, validateChart } from "./recommend";
import type { SizeChart } from "./types";

// Guide du t-shirt de la démo v0.2.
const TEE: SizeChart = {
  sizes: ["XS", "S", "M", "L", "XL", "XXL"],
  ranges: {
    chest: [[78, 84], [84, 90], [90, 97], [97, 104], [104, 112], [112, 120]],
    waist: [[64, 70], [70, 77], [77, 84], [84, 92], [92, 100], [100, 110]],
  },
  weights: { chest: 0.75, waist: 0.25 },
};

describe("recommendSize", () => {
  it("donne la taille dont les intervalles contiennent les mensurations", () => {
    const r = recommendSize(TEE, { chest: 93, waist: 80 });
    expect(r.size).toBe("M");
    expect(r.confidence).toBeGreaterThan(0.9);
    expect(r.details.map((d) => d.feel)).toEqual(["Juste", "Juste"]);
    expect(r.alternatives.map((a) => a.size)).toEqual(["S", "L"]);
  });

  it("monte d'une taille quand l'utilisateur porte ample, près d'une borne", () => {
    expect(recommendSize(TEE, { chest: 95, waist: 82 }, "normale").size).toBe("M");
    expect(recommendSize(TEE, { chest: 95, waist: 82 }, "ample").size).toBe("L");
  });

  it("descend d'une taille quand l'utilisateur porte ajusté, près d'une borne", () => {
    expect(recommendSize(TEE, { chest: 91, waist: 78 }, "ajustee").size).toBe("S");
  });

  it("baisse la confiance hors du guide", () => {
    const r = recommendSize(TEE, { chest: 130, waist: 118 });
    expect(r.size).toBe("XXL");
    expect(r.confidence).toBeLessThan(0.7);
    expect(r.details[0]!.feel).toBe("Serré");
  });

  it("accepte une mensuration manquante si l'essentiel du poids est couvert, en baissant la confiance", () => {
    const full = recommendSize(TEE, { chest: 93, waist: 80 });
    const partial = recommendSize(TEE, { chest: 93 });
    expect(partial.size).toBe("M");
    expect(partial.confidence).toBeLessThan(full.confidence);
  });

  it("refuse de recommander sans les mensurations qui comptent", () => {
    expect(() => recommendSize(TEE, { waist: 80 })).toThrow(RecommendError);
    expect(() => recommendSize(TEE, { hips: 100 })).toThrow(/poitrine|chest/);
  });

  it("rejette un guide incohérent", () => {
    const broken: SizeChart = { ...TEE, ranges: { ...TEE.ranges, waist: [[64, 70]] } };
    expect(validateChart(broken)).toHaveLength(1);
    expect(() => recommendSize(broken, { chest: 93, waist: 80 })).toThrow(RecommendError);
  });
});

describe("compareSizes", () => {
  it("range les tailles dans leur ordre naturel", () => {
    expect(["L", "XS", "M"].sort(compareSizes)).toEqual(["XS", "M", "L"]);
    expect(["W34", "W30", "W32"].sort(compareSizes)).toEqual(["W30", "W32", "W34"]);
    expect(["42", "38", "40"].sort(compareSizes)).toEqual(["38", "40", "42"]);
  });
});

describe("estimateBody", () => {
  it("reste dans les bornes du guide", () => {
    const b = estimateBody(205, 130);
    expect(b.chest).toBeLessThanOrEqual(130);
    expect(estimateBody(145, 40).waist).toBeGreaterThanOrEqual(55);
  });
});

describe("bodyFromGarment", () => {
  it("retire l'aisance de la coupe du vêtement de référence", () => {
    expect(bodyFromGarment({ measurements: { chest: 104 }, cut: "normale" })).toEqual({ chest: 94 });
    expect(bodyFromGarment({ measurements: { chest: 114 }, cut: "ample" })).toEqual({ chest: 94 });
  });
});
