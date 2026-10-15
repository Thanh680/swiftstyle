"use client";

import type { Alternative, Basis, Body, BodyKey, FitDetail, FitPreference, Theme } from "@/lib/recommendation";
import { isMessage, MESSAGE_SOURCE, type EventType, type FrameMessage } from "@/lib/widget-protocol";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useHydrated } from "@/lib/use-hydrated";

export interface GarmentOption {
  id: string;
  model: string;
  size: string;
}

interface Props {
  shopKey: string;
  productId: string;
  productTitle: string;
  keys: BodyKey[];
  theme: Theme;
  allowedOrigins: string[];
  garments: GarmentOption[];
}

interface Recommendation {
  recommendationId: string;
  basis: Basis;
  reference: string | null;
  body: Body;
  size: string;
  confidence: number;
  details: FitDetail[];
  alternatives: Alternative[];
}

const LABEL: Record<BodyKey, string> = { chest: "Tour de poitrine", waist: "Tour de taille", hips: "Tour de hanches" };
const FITS: [FitPreference, string][] = [
  ["ajustee", "Ajustés"],
  ["normale", "Normaux"],
  ["ample", "Amples"],
];
const STORAGE_KEY = "swiftstyle.profile";

interface Profile {
  height: number;
  weight: number;
  knowsTours: boolean;
  tours: Partial<Record<BodyKey, string>>;
  fit: FitPreference;
}

const DEFAULT_PROFILE: Profile = { height: 172, weight: 68, knowsTours: false, tours: {}, fit: "normale" };

// Le profil reste dans le navigateur de l'utilisateur (§ 10) : rien d'identifiant côté serveur.
function loadProfile(): Profile {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<Profile> | null;
    return { ...DEFAULT_PROFILE, ...saved };
  } catch {
    return DEFAULT_PROFILE;
  }
}

function saveProfile(p: Profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // stockage bloqué (navigation privée, iframe tierce) : le widget marche quand même
  }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function themeVars(theme: Theme, hostFont: string | null): CSSProperties {
  return {
    "--ss-font": theme.font && theme.font !== "inherit" ? theme.font : (hostFont ?? "system-ui, sans-serif"),
    "--ss-radius": theme.radius ?? "2px",
    "--ss-accent": theme.accent ?? "#111",
    "--ss-bg": theme.bg ?? "#fff",
    "--ss-text": theme.text ?? "#111",
    "--ss-border": theme.border ?? "#e5e5e5",
  } as CSSProperties;
}

function useHost(allowedOrigins: string[]) {
  const hostOrigin = useRef<string | null>(null);
  const [font, setFont] = useState<string | null>(null);
  const [sizes, setSizes] = useState<string[] | null>(null);

  const post = (msg: FrameMessage) => {
    if (window.parent === window) return;
    // Tant que la page hôte ne s'est pas présentée, on n'écrit qu'aux origines
    // autorisées : le navigateur ne livre le message qu'à celle qui correspond.
    const targets = hostOrigin.current ? [hostOrigin.current] : [...allowedOrigins, window.location.origin];
    for (const target of targets) window.parent.postMessage(msg, target);
  };

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      if (e.origin !== window.location.origin && !allowedOrigins.includes(e.origin)) return;
      if (!isMessage(e.data) || e.data.type !== "context") return;
      const data = e.data as { font?: unknown; sizes?: unknown };
      hostOrigin.current = e.origin;
      setFont(typeof data.font === "string" ? data.font : null);
      setSizes(Array.isArray(data.sizes) ? data.sizes.filter((s): s is string => typeof s === "string") : null);
    };
    window.addEventListener("message", onMessage);
    post({ source: MESSAGE_SOURCE, type: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return { post, font, sizes };
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" className="ss-close" onClick={onClose} aria-label="Fermer">
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </button>
  );
}

export function SizeFinder({ shopKey, productId, productTitle, keys, theme, allowedOrigins, garments }: Props) {
  const { post, font, sizes: hostSizes } = useHost(allowedOrigins);
  const rootRef = useRef<HTMLDivElement>(null);
  const hydrated = useHydrated();

  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [tab, setTab] = useState<"mesures" | "vetement">("mesures");
  const [model, setModel] = useState(garments[0]?.model ?? "");
  const [garmentId, setGarmentId] = useState(garments[0]?.id ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [result, setResult] = useState<Recommendation | null>(null);

  const models = [...new Set(garments.map((g) => g.model))];
  const sizesOfModel = garments.filter((g) => g.model === model);

  const track = (type: EventType, recommendationId: string | null = null) => {
    fetch("/api/v1/events", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ shopKey, type, recommendationId, productId }),
    }).catch(() => {});
  };

  const close = () => post({ source: MESSAGE_SOURCE, type: "close" });

  useEffect(() => {
    setProfile(loadProfile());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // La page hôte ajuste la hauteur de l'iframe à son contenu.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => post({ source: MESSAGE_SOURCE, type: "resize", height: Math.ceil(el.getBoundingClientRect().height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const update = (patch: Partial<Profile>) =>
    setProfile((p) => {
      const next = { ...p, ...patch };
      saveProfile(next);
      return next;
    });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");

    let payload: Record<string, unknown>;
    if (tab === "vetement") {
      payload = { reference: { garmentId } };
    } else if (profile.knowsTours) {
      const tours: Body = {};
      for (const k of keys) {
        const v = Number(profile.tours[k]);
        if (profile.tours[k] && Number.isFinite(v)) tours[k] = v;
      }
      payload = { measurements: tours };
    } else {
      payload = { measurements: { heightCm: profile.height, weightKg: profile.weight } };
    }

    try {
      const res = await fetch("/api/v1/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shopKey, productId, fitPreference: profile.fit, ...payload }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as Recommendation;
      setResult(data);
      setStatus("idle");
      track("recommendation_shown", data.recommendationId);
    } catch {
      setStatus("error");
    }
  }

  function choose(r: Recommendation) {
    track("size_selected", r.recommendationId);
    post({ source: MESSAGE_SOURCE, type: "size-selected", size: r.size, recommendationId: r.recommendationId });
  }

  const missingOnPage = result && hostSizes && hostSizes.length > 0 && !hostSizes.some((s) => s.trim().toUpperCase() === result.size.toUpperCase());

  return (
    <div ref={rootRef} className="ss-root" style={themeVars(theme, font)}>
      <header className="ss-head">
        <div>
          <h1>Trouver ma taille</h1>
          <p>{productTitle}</p>
        </div>
        <CloseButton onClose={close} />
      </header>

      {result ? (
        <section className="ss-result" aria-live="polite">
          <div className="ss-size">
            <span className="ss-stamp">{result.size}</span>
            <div>
              <p className="ss-title">Taille {result.size} conseillée</p>
              <p className="ss-muted">Correspondance avec le guide des tailles : {Math.round(result.confidence * 100)} %</p>
            </div>
          </div>

          <ul className="ss-fit">
            {result.details.map((d) => (
              <li key={d.key}>
                <span>{LABEL[d.key]}</span>
                <span className="ss-bar">
                  <i style={{ left: `${clamp(50 + d.position * 25, 4, 96)}%` }} />
                </span>
                <b>{d.feel}</b>
              </li>
            ))}
          </ul>

          {result.alternatives.length > 0 && (
            <p className="ss-muted">{result.alternatives.map((a) => `${a.size} : ${a.note}`).join(". ")}.</p>
          )}

          <p className="ss-note">
            {result.basis === "estimated" &&
              `Tours estimés à partir de votre taille et de votre poids (${keys
                .filter((k) => result.body[k] !== undefined)
                .map((k) => `${LABEL[k].toLowerCase()} ${result.body[k]} cm`)
                .join(", ")}). Si vous connaissez vos tours, indiquez-les pour un conseil plus sûr.`}
            {result.basis === "measured" && "Calculé à partir des tours que vous avez indiqués."}
            {result.basis === "reference" && `Déduit de votre ${result.reference}.`}
          </p>

          {missingOnPage && <p className="ss-warn">Cette taille n&apos;apparaît pas dans le sélecteur de la page : elle est peut-être épuisée.</p>}

          <div className="ss-actions">
            <button type="button" className="ss-cta" onClick={() => choose(result)}>
              Choisir la taille {result.size}
            </button>
            <button type="button" className="ss-link" onClick={() => setResult(null)}>
              Modifier mes informations
            </button>
          </div>
        </section>
      ) : (
        <form className="ss-form" onSubmit={submit}>
          {garments.length > 0 && (
            <div className="ss-tabs" role="tablist" aria-label="Méthode">
              <button type="button" role="tab" aria-selected={tab === "mesures"} onClick={() => setTab("mesures")}>
                Mes mesures
              </button>
              <button type="button" role="tab" aria-selected={tab === "vetement"} onClick={() => setTab("vetement")}>
                Un vêtement que j&apos;ai
              </button>
            </div>
          )}

          {tab === "mesures" ? (
            <div className="ss-panel">
              {!profile.knowsTours && (
                <>
                  <label className="ss-range">
                    <span>Taille</span>
                    <output>{profile.height} cm</output>
                    <input type="range" min={145} max={205} value={profile.height} onChange={(e) => update({ height: Number(e.target.value) })} />
                  </label>
                  <label className="ss-range">
                    <span>Poids</span>
                    <output>{profile.weight} kg</output>
                    <input type="range" min={40} max={130} value={profile.weight} onChange={(e) => update({ weight: Number(e.target.value) })} />
                  </label>
                </>
              )}
              <label className="ss-check">
                <input type="checkbox" checked={profile.knowsTours} onChange={(e) => update({ knowsTours: e.target.checked })} />
                Je connais mes tours de mesure
              </label>
              {profile.knowsTours &&
                keys.map((k) => (
                  <label key={k} className="ss-field">
                    <span>{LABEL[k]} (cm)</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={40}
                      max={200}
                      value={profile.tours[k] ?? ""}
                      onChange={(e) => update({ tours: { ...profile.tours, [k]: e.target.value } })}
                    />
                  </label>
                ))}
            </div>
          ) : (
            <div className="ss-panel">
              <label className="ss-field">
                <span>Vêtement</span>
                <select
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setGarmentId(garments.find((g) => g.model === e.target.value)?.id ?? "");
                  }}
                >
                  {models.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label className="ss-field">
                <span>Taille que vous portez</span>
                <select value={garmentId} onChange={(e) => setGarmentId(e.target.value)}>
                  {sizesOfModel.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <fieldset className="ss-seg">
            <legend>Je porte mes vêtements</legend>
            <div>
              {FITS.map(([value, label]) => (
                <label key={value}>
                  <input type="radio" name="fit" value={value} checked={profile.fit === value} onChange={() => update({ fit: value })} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {status === "error" && <p className="ss-warn">Le calcul n&apos;a pas abouti. Vérifiez vos informations et réessayez.</p>}

          <button type="submit" className="ss-cta" disabled={!hydrated || status === "loading"}>
            {status === "loading" ? "Calcul en cours…" : "Voir ma taille"}
          </button>
        </form>
      )}
    </div>
  );
}

export function Unavailable() {
  // Origine de la page hôte inconnue ici : le message « close » ne contient rien de sensible.
  const close = () => window.parent.postMessage({ source: MESSAGE_SOURCE, type: "close" } satisfies FrameMessage, "*");
  return (
    <div className="ss-root">
      <header className="ss-head">
        <div>
          <h1>Trouver ma taille</h1>
          <p>Ce produit n&apos;a pas encore de guide des tailles SwiftStyle.</p>
        </div>
        <CloseButton onClose={close} />
      </header>
    </div>
  );
}
