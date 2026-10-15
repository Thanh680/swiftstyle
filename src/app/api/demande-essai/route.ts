import { z } from "zod";
import { EMAIL_RE } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/http";

// POST /api/demande-essai : formulaire « Demander un essai » de la page d'accueil.
// Transmet la demande au Google Sheet de l'équipe (integrations/google-sheets/apps-script.gs),
// dont l'URL est dans GOOGLE_SHEETS_WEBHOOK_URL.

export const dynamic = "force-dynamic";

const text = (max: number) => z.string().trim().max(max);

const Input = z.object({
  name: text(120).min(2),
  email: text(200).regex(EMAIL_RE),
  brand: text(120).min(1),
  site: text(200).min(1),
  platform: text(80).min(1),
  volume: text(80).min(1),
  message: text(2000).default(""),
  consent: z.literal("on"),
  societe: z.string().optional(),
  source: text(300).default(""),
  referrer: text(300).default(""),
});

export async function POST(req: Request) {
  if (!rateLimit(`demande:${clientIp(req)}`, 5, 10 * 60_000)) return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });

  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
  const input = parsed.data;

  // Piège à robots rempli : on répond comme si tout allait bien, sans rien transmettre.
  if (input.societe) return Response.json({ ok: true });

  // Colonnes attendues par le script Google Sheets.
  const row = {
    date: new Date().toISOString(),
    marque: input.brand,
    siteWeb: input.site,
    nom: input.name,
    email: input.email,
    plateforme: input.platform,
    volume: input.volume,
    message: input.message,
    source: input.source,
    referrer: input.referrer,
  };

  const url = process.env.GOOGLE_SHEETS_WEBHOOK_URL;
  if (!url) {
    // En production, une demande perdue sans le dire serait pire qu'une erreur.
    if (process.env.NODE_ENV === "production") return Response.json({ ok: false, error: "not_configured" }, { status: 503 });
    console.info("[demande-essai] GOOGLE_SHEETS_WEBHOOK_URL vide, mode démo : rien n'est envoyé.", row);
    return Response.json({ ok: true, mode: "demo" });
  }

  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(row) });
    // Apps Script répond 200 même quand il refuse la ligne : on lit sa réponse.
    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    if (!res.ok || data?.ok === false) throw new Error(`Google Sheets a refusé la demande (HTTP ${res.status})`);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[demande-essai]", err);
    return Response.json({ ok: false, error: "upstream" }, { status: 502 });
  }
}
