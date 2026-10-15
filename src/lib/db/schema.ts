import type { Body, FitPreference, SizeChart, Theme } from "../recommendation/types";
import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, real, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// Tables décrites au § 6 de docs/ARCHITECTURE-TECHNIQUE.md.

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Marque cliente. La clé publique `pk_…` est visible dans le navigateur : c'est voulu. */
export const shops = pgTable("shops", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  publicKey: text("public_key").notNull().unique(),
  /** Origines autorisées à afficher le widget, ex. https://www.marque.fr */
  allowedOrigins: text("allowed_origins").array().notNull().default(sql`'{}'::text[]`),
  theme: jsonb("theme").$type<Theme>().notNull().default({}),
  locale: text("locale").notNull().default("fr-FR"),
  plan: text("plan").notNull().default("pilote"),
  createdAt: createdAt(),
});

/** Guide des tailles, partagé par les produits d'une même catégorie ou propre à un produit. */
export const sizeCharts = pgTable("size_charts", {
  id: uuid("id").primaryKey().defaultRandom(),
  shopId: uuid("shop_id")
    .notNull()
    .references(() => shops.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  /** Mensurations en jsonb : un pantalon n'a pas de tour de poitrine. */
  chart: jsonb("chart").$type<SizeChart>().notNull(),
  createdAt: createdAt(),
});

/** Produit du marchand, retrouvé par son identifiant externe (Shopify, WooCommerce, SKU). */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    sizeChartId: uuid("size_chart_id").references(() => sizeCharts.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("products_shop_external_idx").on(t.shopId, t.externalId)],
);

/**
 * L'actif stratégique (§ 6) : vêtements du commerce dont on connaît les mesures
 * réelles, qui servent de point de comparaison pour l'option 3.
 */
export const referenceGarments = pgTable(
  "reference_garments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brand: text("brand").notNull(),
    model: text("model").notNull(),
    category: text("category").notNull(),
    size: text("size").notNull(),
    cut: text("cut").$type<FitPreference>().notNull(),
    /** Tours du vêtement, en cm. */
    measurements: jsonb("measurements").$type<Body>().notNull(),
    /** Provenance de la mesure : indispensable pour savoir ce qu'on peut affirmer. */
    source: text("source").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("reference_garments_unique_idx").on(t.brand, t.model, t.size)],
);

/**
 * Trace d'une recommandation. Aucun identifiant d'utilisateur n'est stocké :
 * pas d'IP, pas de cookie, seulement les mensurations envoyées et la taille rendue.
 */
export const recommendations = pgTable(
  "recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    basis: text("basis").notNull(),
    input: jsonb("input").notNull(),
    size: text("size").notNull(),
    confidence: real("confidence").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("recommendations_shop_idx").on(t.shopId, t.createdAt)],
);

/** Télémétrie d'usage (§ 5.1). */
export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shopId: uuid("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    recommendationId: uuid("recommendation_id").references(() => recommendations.id, { onDelete: "set null" }),
    productExternalId: text("product_external_id"),
    createdAt: createdAt(),
  },
  (t) => [index("events_shop_type_idx").on(t.shopId, t.type, t.createdAt)],
);
