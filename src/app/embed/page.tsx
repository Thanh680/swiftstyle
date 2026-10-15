import { compareSizes, type BodyKey } from "@/lib/recommendation";
import { findProduct, findShop, getDb, listReferenceGarments } from "@/lib/db";
import { SizeFinder, Unavailable, type GarmentOption } from "@/components/size-finder/SizeFinder";
import "./embed.css";

// Contenu de l'iframe ouverte par le widget (widget/index.ts) au clic sur le bouton.
// /embed?shopKey=pk_…&productId=…

export const dynamic = "force-dynamic";

export default async function EmbedPage({ searchParams }: { searchParams: Promise<{ shopKey?: string; productId?: string }> }) {
  const { shopKey = "", productId = "" } = await searchParams;
  const db = await getDb();
  const shop = shopKey.startsWith("pk_") ? await findShop(db, shopKey) : undefined;
  const product = shop && productId ? await findProduct(db, shop.id, productId) : undefined;
  if (!shop || !product?.chart) return <Unavailable />;

  const chart = product.chart;
  const keys = (Object.keys(chart.weights) as BodyKey[]).sort((a, b) => (chart.weights[b] ?? 0) - (chart.weights[a] ?? 0));
  const total = keys.reduce((s, k) => s + (chart.weights[k] ?? 0), 0);

  // On ne propose que les vêtements de référence qui couvrent l'essentiel des
  // mensurations utiles à cet article (même seuil que le moteur).
  const garments: GarmentOption[] = (await listReferenceGarments(db))
    .filter((g) => keys.reduce((s, k) => s + (g.measurements[k] !== undefined ? (chart.weights[k] ?? 0) : 0), 0) / total >= 0.5)
    .map((g) => ({ id: g.id, model: `${g.brand} ${g.model}`, size: g.size }))
    .sort((a, b) => a.model.localeCompare(b.model) || compareSizes(a.size, b.size));

  return (
    <SizeFinder
      shopKey={shop.publicKey}
      productId={product.externalId}
      productTitle={product.title}
      keys={keys}
      theme={shop.theme}
      allowedOrigins={shop.allowedOrigins}
      garments={garments}
    />
  );
}
