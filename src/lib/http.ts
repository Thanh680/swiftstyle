import type { Shop } from "@/lib/db";

// Sécurité de l'API publique (ARCHITECTURE-TECHNIQUE.md § 5.2) : la clé pk_… est
// publique, ce sont l'allowlist de domaines, le CORS et le rate limiting qui protègent.

export function selfOrigin(req: Request): string {
  return process.env.APP_ORIGIN ?? new URL(req.url).origin;
}

/**
 * Une requête sans en-tête Origin ne vient pas du navigateur d'un autre site
 * (requête same-origin ou appel serveur) : elle reste soumise au rate limiting.
 */
export function isAllowedOrigin(req: Request, shop: Pick<Shop, "allowedOrigins">): boolean {
  const origin = req.headers.get("origin");
  return !origin || origin === selfOrigin(req) || shop.allowedOrigins.includes(origin);
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function json(req: Request, data: unknown, status = 200, cors = true): Response {
  return Response.json(data, { status, headers: cors ? corsHeaders(req) : {} });
}

export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

// Fenêtre fixe en mémoire. Suffit en local et sur un seul serveur ; sur Vercel
// chaque instance a son propre compteur, il faudra un stockage partagé
// (Upstash Redis ou équivalent) avant d'ouvrir l'API à plusieurs boutiques.
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset <= now) {
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
    }
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

/** Code d'erreur PostgreSQL, que Drizzle range parfois dans `cause`. */
function pgCode(err: unknown): string | undefined {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = e?.code ?? e?.cause?.code;
  return typeof code === "string" ? code : undefined;
}

export function serverError(req: Request, err: unknown): Response {
  const code = pgCode(err);
  if (code === "42P01") {
    return json(req, { error: "database_not_ready", message: "Base non initialisée : lancer npm run db:setup." }, 503);
  }
  if (code === "23503" || code === "22P02") {
    return json(req, { error: "invalid_reference" }, 422);
  }
  console.error(err);
  return json(req, { error: "internal" }, 500);
}
