import { findShop, getDb, insertEvent } from "@/lib/db";
import { EVENT_TYPES } from "@/lib/widget-protocol";
import { z } from "zod";
import { clientIp, isAllowedOrigin, json, preflight, rateLimit, serverError } from "@/lib/http";

// POST /api/v1/events    { shopKey, type, recommendationId?, productId? }
// Accepte du JSON envoyé en text/plain : navigator.sendBeacon et fetch keepalive
// évitent ainsi la requête preflight depuis la page du marchand.

export const dynamic = "force-dynamic";

const Input = z.object({
  shopKey: z.string().startsWith("pk_").max(100),
  type: z.enum(EVENT_TYPES),
  recommendationId: z.uuid().nullish(),
  productId: z.string().max(200).nullish(),
});

export function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const raw = await req.text();
  let data: unknown = null;
  try {
    data = JSON.parse(raw);
  } catch {
    // laissé à null, rejeté par la validation
  }
  const parsed = Input.safeParse(data);
  if (!parsed.success) return json(req, { error: "invalid_input", issues: parsed.error.issues }, 400);
  const input = parsed.data;

  if (!rateLimit(`events:${input.shopKey}:${clientIp(req)}`, 120)) return json(req, { error: "rate_limited" }, 429);

  try {
    const db = await getDb();
    const shop = await findShop(db, input.shopKey);
    if (!shop) return json(req, { error: "unknown_shop" }, 404);
    if (!isAllowedOrigin(req, shop)) return json(req, { error: "origin_not_allowed" }, 403, false);

    await insertEvent(db, {
      shopId: shop.id,
      type: input.type,
      recommendationId: input.recommendationId ?? null,
      productExternalId: input.productId ?? null,
    });
    return json(req, { ok: true });
  } catch (err) {
    return serverError(req, err);
  }
}
