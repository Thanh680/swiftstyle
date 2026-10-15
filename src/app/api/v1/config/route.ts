import { enabledCategories, findProduct, findShop, getDb } from "@/lib/db";
import { clientIp, isAllowedOrigin, json, preflight, rateLimit, serverError } from "@/lib/http";

// GET /api/v1/config?shopKey=pk_…&productId=…
// Appelé par le widget depuis la page du marchand. Si l'origine n'est pas dans
// l'allowlist de la boutique, le widget n'affiche pas le bouton.

export const dynamic = "force-dynamic";

export function OPTIONS(req: Request) {
  return preflight(req);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const shopKey = url.searchParams.get("shopKey") ?? "";
  const productId = url.searchParams.get("productId");

  if (!rateLimit(`config:${shopKey}:${clientIp(req)}`, 120)) return json(req, { error: "rate_limited" }, 429);

  try {
    const db = await getDb();
    const shop = shopKey.startsWith("pk_") ? await findShop(db, shopKey) : undefined;
    if (!shop) return json(req, { error: "unknown_shop" }, 404);
    if (!isAllowedOrigin(req, shop)) return json(req, { error: "origin_not_allowed" }, 403, false);

    const product = productId ? await findProduct(db, shop.id, productId) : undefined;
    return json(req, {
      theme: shop.theme,
      locale: shop.locale,
      enabledCategories: await enabledCategories(db, shop.id),
      product: productId ? { id: productId, enabled: Boolean(product?.chart) } : null,
    });
  } catch (err) {
    return serverError(req, err);
  }
}
