import { eq } from "drizzle-orm";
import { DEMO_ARTICLES } from "../recommendation/demo-charts";
import type { Db } from "./client";
import { products, referenceGarments, shops, sizeCharts } from "./schema";

/**
 * Données de démonstration. Tout est fictif : la boutique, ses guides des
 * tailles (repris de la démo du site v0.2) et les vêtements de référence.
 * Rien de tout cela ne doit être présenté comme une mesure réelle.
 */

export const DEMO_KEY = "pk_demo_boutique";

const FICTIF = "Données fictives de démonstration, à remplacer par des mesures réelles";

const GARMENTS: (typeof referenceGarments.$inferInsert)[] = [
  { brand: "Exemple", model: "T-shirt basique", category: "tshirt", size: "S", cut: "normale", measurements: { chest: 96 }, source: FICTIF },
  { brand: "Exemple", model: "T-shirt basique", category: "tshirt", size: "M", cut: "normale", measurements: { chest: 102 }, source: FICTIF },
  { brand: "Exemple", model: "T-shirt basique", category: "tshirt", size: "L", cut: "normale", measurements: { chest: 108 }, source: FICTIF },
  { brand: "Exemple", model: "Jean coupe droite", category: "jean", size: "W30", cut: "ajustee", measurements: { waist: 80, hips: 96 }, source: FICTIF },
  { brand: "Exemple", model: "Jean coupe droite", category: "jean", size: "W32", cut: "ajustee", measurements: { waist: 85, hips: 101 }, source: FICTIF },
  { brand: "Exemple", model: "Jean coupe droite", category: "jean", size: "W34", cut: "ajustee", measurements: { waist: 90, hips: 106 }, source: FICTIF },
  { brand: "Exemple", model: "Sweat à capuche ample", category: "sweat", size: "M", cut: "ample", measurements: { chest: 118, waist: 112 }, source: FICTIF },
  { brand: "Exemple", model: "Sweat à capuche ample", category: "sweat", size: "L", cut: "ample", measurements: { chest: 124, waist: 118 }, source: FICTIF },
];

export async function seed(db: Db, log: (msg: string) => void = console.log): Promise<void> {
  const [existing] = await db.select({ id: shops.id }).from(shops).where(eq(shops.publicKey, DEMO_KEY)).limit(1);
  if (existing) {
    log(`Boutique démo déjà présente (${DEMO_KEY}).`);
  } else {
    const [shop] = await db
      .insert(shops)
      .values({
        name: "Boutique démo",
        publicKey: DEMO_KEY,
        allowedOrigins: ["http://localhost:3000", "http://127.0.0.1:3000"],
      })
      .returning({ id: shops.id });

    for (const article of Object.values(DEMO_ARTICLES)) {
      const [chart] = await db
        .insert(sizeCharts)
        .values({ shopId: shop!.id, name: article.name, category: article.category, chart: article.chart })
        .returning({ id: sizeCharts.id });
      await db.insert(products).values({
        shopId: shop!.id,
        externalId: article.externalId,
        title: article.name,
        category: article.category,
        sizeChartId: chart!.id,
      });
    }
    log(`Boutique démo créée : clé ${DEMO_KEY}, ${Object.keys(DEMO_ARTICLES).length} produits.`);
  }

  const inserted = await db.insert(referenceGarments).values(GARMENTS).onConflictDoNothing().returning({ id: referenceGarments.id });
  log(`Vêtements de référence ajoutés : ${inserted.length}.`);
}
