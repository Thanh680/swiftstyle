import type { Basis } from "../recommendation/types";
import type { EventType } from "../widget-protocol";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import type { Db } from "./client";
import { events, products, recommendations, referenceGarments, shops, sizeCharts } from "./schema";

export type Shop = typeof shops.$inferSelect;
export type ReferenceGarment = typeof referenceGarments.$inferSelect;

export async function findShop(db: Db, publicKey: string): Promise<Shop | undefined> {
  const [shop] = await db.select().from(shops).where(eq(shops.publicKey, publicKey)).limit(1);
  return shop;
}

export async function findProduct(db: Db, shopId: string, externalId: string) {
  const [row] = await db
    .select({ product: products, chart: sizeCharts.chart })
    .from(products)
    .leftJoin(sizeCharts, eq(products.sizeChartId, sizeCharts.id))
    .where(and(eq(products.shopId, shopId), eq(products.externalId, externalId)))
    .limit(1);
  return row ? { ...row.product, chart: row.chart } : undefined;
}

/** Catégories pour lesquelles la boutique a au moins un produit relié à un guide des tailles. */
export async function enabledCategories(db: Db, shopId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .where(and(eq(products.shopId, shopId), isNotNull(products.sizeChartId)))
    .orderBy(asc(products.category));
  return rows.map((r) => r.category);
}

export async function listReferenceGarments(db: Db): Promise<ReferenceGarment[]> {
  return db.select().from(referenceGarments).orderBy(asc(referenceGarments.brand), asc(referenceGarments.model), asc(referenceGarments.createdAt));
}

export async function findReferenceGarment(db: Db, id: string): Promise<ReferenceGarment | undefined> {
  const [row] = await db.select().from(referenceGarments).where(eq(referenceGarments.id, id)).limit(1);
  return row;
}

export async function insertRecommendation(
  db: Db,
  values: { shopId: string; productId: string; basis: Basis; input: unknown; size: string; confidence: number },
): Promise<string> {
  const [row] = await db.insert(recommendations).values(values).returning({ id: recommendations.id });
  return row!.id;
}

export async function insertEvent(
  db: Db,
  values: { shopId: string; type: EventType; recommendationId?: string | null; productExternalId?: string | null },
): Promise<void> {
  await db.insert(events).values(values);
}
