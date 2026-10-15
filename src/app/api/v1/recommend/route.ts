import { BODY_KEYS, FIT_PREFERENCES, RecommendError, bodyFromGarment, estimateBody, recommendSize, type Basis, type Body } from "@/lib/recommendation";
import { findProduct, findReferenceGarment, findShop, getDb, insertRecommendation } from "@/lib/db";
import { z } from "zod";
import { clientIp, isAllowedOrigin, json, preflight, rateLimit, serverError } from "@/lib/http";

// POST /api/v1/recommend    { shopKey, productId, reference|measurements, fitPreference }
//                    →  { size, confidence, reason, alternatives[], ... }

export const dynamic = "force-dynamic";

const circumference = z.number().min(40).max(200);

const Input = z
  .object({
    shopKey: z.string().startsWith("pk_").max(100),
    productId: z.string().min(1).max(200),
    fitPreference: z.enum(FIT_PREFERENCES).default("normale"),
    measurements: z
      .object({
        heightCm: z.number().min(120).max(230).optional(),
        weightKg: z.number().min(30).max(250).optional(),
        chest: circumference.optional(),
        waist: circumference.optional(),
        hips: circumference.optional(),
      })
      .optional(),
    reference: z.object({ garmentId: z.uuid() }).optional(),
  })
  .refine((v) => Boolean(v.measurements) !== Boolean(v.reference), {
    message: "Envoyer soit measurements, soit reference.",
  });

export function OPTIONS(req: Request) {
  return preflight(req);
}

export async function POST(req: Request) {
  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(req, { error: "invalid_input", issues: parsed.error.issues }, 400);
  const input = parsed.data;

  if (!rateLimit(`recommend:${input.shopKey}:${clientIp(req)}`, 30)) return json(req, { error: "rate_limited" }, 429);

  try {
    const db = await getDb();
    const shop = await findShop(db, input.shopKey);
    if (!shop) return json(req, { error: "unknown_shop" }, 404);
    if (!isAllowedOrigin(req, shop)) return json(req, { error: "origin_not_allowed" }, 403, false);

    const product = await findProduct(db, shop.id, input.productId);
    if (!product?.chart) return json(req, { error: "unknown_product" }, 404);

    let body: Body;
    let basis: Basis;
    let label: string | null = null;

    if (input.reference) {
      const garment = await findReferenceGarment(db, input.reference.garmentId);
      if (!garment) return json(req, { error: "unknown_reference" }, 404);
      body = bodyFromGarment({ measurements: garment.measurements, cut: garment.cut });
      basis = "reference";
      label = `${garment.brand} ${garment.model} en ${garment.size}`;
    } else {
      const m = input.measurements!;
      const given: Body = {};
      for (const k of BODY_KEYS) if (m[k] !== undefined) given[k] = m[k];
      if (Object.keys(given).length > 0) {
        body = given;
        basis = "measured";
      } else if (m.heightCm !== undefined && m.weightKg !== undefined) {
        body = estimateBody(m.heightCm, m.weightKg);
        basis = "estimated";
      } else {
        return json(req, { error: "invalid_input", message: "Il faut des tours mesurés, ou la taille et le poids." }, 400);
      }
    }

    const result = recommendSize(product.chart, body, input.fitPreference);
    const recommendationId = await insertRecommendation(db, {
      shopId: shop.id,
      productId: product.id,
      basis,
      // Aucun identifiant de personne : seulement ce qui a servi au calcul.
      input: { fitPreference: input.fitPreference, measurements: input.measurements ?? null, reference: input.reference ?? null },
      size: result.size,
      confidence: result.confidence,
    });

    return json(req, { recommendationId, basis, reference: label, body, ...result });
  } catch (err) {
    if (err instanceof RecommendError) return json(req, { error: err.code, message: err.message }, 422);
    return serverError(req, err);
  }
}
