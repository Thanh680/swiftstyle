"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DEMO_ARTICLES, estimateBody, type BodyKey, type DemoArticle, type FitPreference } from "@/lib/recommendation";
import { asset } from "@/lib/asset";
import { recommend, type Measures } from "./figures";

/**
 * Démo du widget sur la page d'accueil : la fiche produit d'une boutique fictive,
 * affichée dans un écran. Le widget y prend la forme d'un bouton sous le choix des
 * tailles, qui ouvre une modale, comme le vrai widget (widget/index.ts). La modale
 * est volontairement neutre : elle prend les couleurs, la police et les arrondis de
 * la boutique. Elle utilise le vrai moteur de recommandation (src/lib/recommendation)
 * avec les guides des tailles d'exemple, entièrement dans le navigateur. Le
 * traitement de la photo est simulé : le client donne seulement sa taille, les tours
 * « lus » sur la photo se remplissent seuls dans des curseurs verrouillés.
 */

type Step = 1 | 2 | 3;
type View = "face" | "detail";

const LABEL: Record<BodyKey, string> = { chest: "Poitrine", waist: "Tour de taille", hips: "Hanches" };
const BODY: { key: BodyKey; id: string; label: string; min: number; max: number }[] = [
  { key: "chest", id: "m-c", label: "Tour de poitrine", min: 70, max: 130 },
  { key: "waist", id: "m-t", label: "Tour de taille", min: 55, max: 125 },
  { key: "hips", id: "m-hi", label: "Tour de hanches", min: 75, max: 135 },
];
/** Corpulence prêtée à la personne photographiée (IMC de 23), faute de vraie analyse. */
const shotWeight = (h: number) => Math.round(23 * (h / 100) ** 2);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

interface Product {
  /** Nom affiché sur la fiche (le guide des tailles reste celui de l'article de démo). */
  name: string;
  rayon: string;
  slug: string;
  price: string;
  desc: string;
  care: string;
  /** Vue de détail : point visé sur la photo (en %) et grossissement. */
  detail: { x: number; y: number; zoom: number };
  /** Photos détourées, une par coloris (public/demo). */
  colors: { name: string; src: string; swatch: string }[];
}

const PRODUCTS: Record<DemoArticle, Product> = {
  tee: {
    name: "T-shirt SwiftStyle",
    rayon: "T-shirts",
    slug: "t-shirt-swiftstyle",
    price: "39,00 €",
    desc: "Jersey de coton épais, col rond côtelé, coupe droite. Logo SwiftStyle sérigraphié.",
    care: "100 % coton biologique. Lavage en machine à 30 °C.",
    detail: { x: 50, y: 50, zoom: 2.2 },
    colors: [
      { name: "Blanc", src: asset("/demo/tee-blanc.webp"), swatch: "#F4F3EE" },
      { name: "Citron", src: asset("/demo/tee-citron.webp"), swatch: "#E3EB66" },
      { name: "Corail", src: asset("/demo/tee-corail.webp"), swatch: "#F2694B" },
      { name: "Encre", src: asset("/demo/tee-encre.webp"), swatch: "#2B2E35" },
    ],
  },
  jean: {
    name: "Jean droit",
    rayon: "Jeans",
    slug: "jean-droit",
    price: "89,00 €",
    desc: "Denim stretch délavé, taille mi-haute, jambe droite.",
    care: "98 % coton, 2 % élasthanne. Lavage à 30 °C, sur l'envers.",
    detail: { x: 40, y: 12, zoom: 2.6 },
    colors: [{ name: "Bleu délavé", src: asset("/demo/jean-bleu.webp"), swatch: "#7FA3CF" }],
  },
  // La boutique vend un sweat, mesuré avec le guide des tailles de la « veste » d'exemple.
  veste: {
    name: "Sweat à capuche SwiftStyle",
    rayon: "Sweats",
    slug: "sweat-a-capuche-swiftstyle",
    price: "69,00 €",
    desc: "Molleton gratté, capuche doublée, poche kangourou. Logo SwiftStyle brodé.",
    care: "80 % coton, 20 % polyester. Lavage en machine à 30 °C, sur l'envers.",
    detail: { x: 50, y: 48, zoom: 2.2 },
    colors: [
      { name: "Blanc", src: asset("/demo/sweat-blanc.webp"), swatch: "#F4F3EE" },
      { name: "Sauge", src: asset("/demo/sweat-sauge.webp"), swatch: "#A4B795" },
      { name: "Rouille", src: asset("/demo/sweat-rouille.webp"), swatch: "#B5613E" },
      { name: "Encre", src: asset("/demo/sweat-encre.webp"), swatch: "#2B2E35" },
    ],
  },
};
const ARTICLES = Object.keys(PRODUCTS) as DemoArticle[];

const FITS: { value: FitPreference; label: string }[] = [
  { value: "ajustee", label: "Ajustés" },
  { value: "normale", label: "Normaux" },
  { value: "ample", label: "Amples" },
];
const TITLES: Record<Step, string> = { 1: "Votre photo", 2: "Analyse des mensurations", 3: "Votre taille" };

const zoomOn = (d: Product["detail"]): CSSProperties => ({ transform: `scale(${d.zoom})`, transformOrigin: `${d.x}% ${d.y}%` });

const HESITATION = "Vous hésitez entre deux tailles ? SwiftStyle vous conseille.";

interface SliderProps {
  id: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  /** Sans `onChange`, le curseur est verrouillé : sa valeur vient de l'analyse de la photo. */
  onChange?: (v: number) => void;
}

function Slider({ id, label, unit, value, min, max, onChange }: SliderProps) {
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {!onChange && (
          <>
            <svg className="w-lock" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M5 7V5a3 3 0 0 1 6 0v2M3.75 7h8.5v6.5h-8.5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            <span className="sr">, mesuré sur la photo</span>
          </>
        )}
      </label>
      <output htmlFor={id}>
        {value} {unit}
      </output>
      <input
        type="range"
        id={id}
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={!onChange}
        onChange={(e) => onChange?.(Number(e.target.value))}
      />
    </div>
  );
}

export function WidgetDemo() {
  // Fiche produit de la boutique
  const [article, setArticle] = useState<DemoArticle>("tee");
  const [color, setColor] = useState(0);
  const [view, setView] = useState<View>("face");
  const [size, setSize] = useState<string | null>(null);
  const [reco, setReco] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [changes, setChanges] = useState(0);
  const [cart, setCart] = useState(0);
  const [added, setAdded] = useState(false);
  const [open, setOpen] = useState(false);

  // Modale du widget
  const [m, setM] = useState<Measures>({ h: 172, w: 68, ...estimateBody(172, 68) });
  const [fit, setFit] = useState<FitPreference>("normale");
  const [step, setStep] = useState<Step>(1);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Analyse en cours : les tours montent seuls dans leurs curseurs.
  const [reading, setReading] = useState(false);

  const barRef = useRef<HTMLElement>(null);
  const readFrame = useRef(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const wasOpen = useRef(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Libère l'aperçu de la photo quand il change ou quand la page se ferme.
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  useEffect(
    () => () => {
      clearTimeout(addedTimer.current);
      cancelAnimationFrame(readFrame.current);
    },
    [],
  );

  // Précharge les autres coloris de l'article : changer de couleur ne fait pas clignoter la photo.
  useEffect(() => {
    for (const c of PRODUCTS[article].colors) new Image().src = c.src;
  }, [article]);

  // Le focus entre dans la modale à l'ouverture et revient au bouton à la fermeture.
  useEffect(() => {
    if (open) dialogRef.current?.focus();
    else if (wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // À chaque étape, la modale revient en haut et le focus passe sur son titre.
  useEffect(() => {
    if (!wasOpen.current) return;
    if (dialogRef.current) dialogRef.current.scrollTop = 0;
    titleRef.current?.focus({ preventScroll: true });
  }, [step]);

  const product = PRODUCTS[article];
  const name = product.name;
  const sizes = DEMO_ARTICLES[article].chart.sizes;

  const pickArticle = (a: DemoArticle) => {
    setArticle(a);
    setColor(0);
    setView("face");
    setSize(null);
    setReco(null);
    setHint("");
    setChanges(0);
    setAdded(false);
  };

  /** Le client change de taille lui-même : au deuxième changement, le widget se signale. */
  const pickSize = (s: string) => {
    setSize(s);
    setAdded(false);
    const n = changes + 1;
    setChanges(n);
    if (n >= 2) setHint(HESITATION);
  };

  const openWidget = () => {
    setChanges(0);
    setHint("");
    setOpen(true);
  };

  const chooseSize = (s: string) => {
    setSize(s);
    setReco(s);
    setAdded(false);
    setHint(`Taille ${s} sélectionnée.`);
    setOpen(false);
  };

  const addToCart = () => {
    setCart((c) => c + 1);
    setAdded(true);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(false), 2200);
  };

  /**
   * Les tours « lus » sur la photo partent du bas de leur curseur et montent seuls jusqu'à leur
   * valeur : le client voit qu'il n'a rien à régler.
   */
  const readBody = () => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const at = (prev: Measures, e: number) => {
      const w = shotWeight(prev.h);
      const to = estimateBody(prev.h, w);
      const next = { ...prev, w };
      for (const b of BODY) next[b.key] = Math.round(b.min + (to[b.key] - b.min) * e);
      return next;
    };
    cancelAnimationFrame(readFrame.current);
    setM((prev) => at(prev, 0));
    setReading(true);
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = reduce ? 1 : Math.min(1, (now - t0) / 1500);
      setM((prev) => at(prev, 1 - (1 - k) ** 3));
      if (k < 1) readFrame.current = requestAnimationFrame(tick);
      else setReading(false);
    };
    readFrame.current = requestAnimationFrame(tick);
  };

  /** Barre de progression, puis affichage du résultat. */
  function runLoading(ms: number, label: string): Promise<void> {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bar = barRef.current;
    setBusy(label);
    if (bar) {
      bar.style.transitionDuration = "0ms";
      bar.style.width = "0";
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          bar.style.transitionDuration = `${reduce ? 0 : ms}ms`;
          bar.style.width = "100%";
        }),
      );
    }
    return new Promise((resolve) =>
      setTimeout(() => {
        setBusy(null);
        resolve();
      }, reduce ? 200 : ms),
    );
  }

  const result = step === 3 ? recommend(article, m, fit) : null;
  const photo = product.colors[color]!.src;
  const colorName = product.colors[color]!.name;

  return (
    <section className="demo crumple" id="demo" aria-labelledby="demo-title">
      <div className="demo-head">
        <h2 className="display" id="demo-title">
          Essayez le widget.
        </h2>
        <p>
          Voici une fiche produit telle que vos clients la voient. Le widget est un bouton placé sous le choix des tailles : il ouvre une
          fenêtre qui conseille la bonne taille à partir d&apos;une photo, puis la sélectionne sur la fiche.
        </p>
      </div>

      <div className="monitor">
        <div className="monitor-screen">
          <div className="browser">
            <div className="browser-bar" aria-hidden="true">
              <span className="dots">
                <i />
                <i />
                <i />
              </span>
              <span className="url">
                <svg viewBox="0 0 16 16">
                  <path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2M3.5 7h9v7h-9z" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <span>ourlet.example/produits/{product.slug}</span>
              </span>
            </div>

            <div className="shop">
              <div className="shop-page" inert={open}>
                <p className="shop-promo">Livraison offerte dès 80 € · Retours gratuits sous 30 jours</p>
                <header className="shop-head">
                  <nav className="shop-nav" aria-label="Rayons de la boutique">
                    {ARTICLES.map((a) => (
                      <button key={a} type="button" aria-current={article === a ? "page" : undefined} onClick={() => pickArticle(a)}>
                        {PRODUCTS[a].rayon}
                      </button>
                    ))}
                  </nav>
                  <svg className="shop-menu" viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  <span className="shop-logo">Ourlet</span>
                  <span className="shop-icons">
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <circle cx="8.5" cy="8.5" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M12.5 12.5 17 17" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <svg viewBox="0 0 20 20" aria-hidden="true">
                      <circle cx="10" cy="7" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M3.5 17.5c1-3.5 3.6-5 6.5-5s5.5 1.5 6.5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <span className="shop-bag">
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M4 6.5h12l-1 11H5zM7 6.5V5a3 3 0 0 1 6 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      {cart > 0 && <b aria-hidden="true">{cart}</b>}
                      <span className="sr">
                        Panier : {cart} article{cart > 1 ? "s" : ""}
                      </span>
                    </span>
                  </span>
                </header>

                <div className="shop-main">
                  <div className="shop-gallery">
                    <div className="shop-photo">
                      <span className="shop-tag">Nouveauté</span>
                      <img src={photo} alt={`${name}, coloris ${colorName}`} style={view === "detail" ? zoomOn(product.detail) : undefined} />
                    </div>
                    <div className="shop-thumbs">
                      {(["face", "detail"] as View[]).map((v) => (
                        <button
                          key={v}
                          type="button"
                          aria-pressed={view === v}
                          aria-label={v === "face" ? "Vue d'ensemble" : "Vue de détail"}
                          onClick={() => setView(v)}
                        >
                          <img src={photo} alt="" style={v === "detail" ? zoomOn(product.detail) : undefined} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="shop-info">
                    <p className="shop-crumb">Accueil / {product.rayon}</p>
                    <h3 className="shop-title">{name}</h3>
                    <p className="shop-price">{product.price}</p>

                    <fieldset className="shop-opt">
                      <legend>
                        Couleur : <b>{colorName}</b>
                      </legend>
                      <div className="shop-swatches">
                        {product.colors.map((c, i) => (
                          <label key={c.name}>
                            <input className="sr" type="radio" name="demo-color" checked={color === i} onChange={() => setColor(i)} />
                            <span style={{ "--c": c.swatch } as CSSProperties} title={c.name}>
                              <span className="sr">{c.name}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset className="shop-opt">
                      <legend>Taille</legend>
                      <div className="shop-sizes">
                        {sizes.map((s) => (
                          <label key={s} className={reco === s ? "is-reco" : undefined}>
                            <input className="sr" type="radio" name="demo-size" value={s} checked={size === s} onChange={() => pickSize(s)} />
                            <span>
                              {s}
                              {reco === s && <span className="sr"> (conseillée par SwiftStyle)</span>}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <button
                      ref={triggerRef}
                      className={changes >= 2 ? "ss-trigger is-nudge" : "ss-trigger"}
                      type="button"
                      aria-haspopup="dialog"
                      onClick={openWidget}
                    >
                      <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                        <path d="M2 7h16v6H2zM6 7v3M10 7v3M14 7v3" fill="none" stroke="currentColor" strokeWidth="1.5" />
                      </svg>
                      Trouver ma taille
                    </button>
                    <p className="ss-hint" aria-live="polite">
                      {hint}
                    </p>

                    <button className="shop-buy" type="button" disabled={!size} onClick={addToCart}>
                      {!size ? "Choisissez une taille" : added ? `Ajouté au panier, taille ${size}` : `Ajouter au panier · ${product.price}`}
                    </button>

                    <details>
                      <summary>Description</summary>
                      <p>{product.desc}</p>
                    </details>
                    <details>
                      <summary>Composition et entretien</summary>
                      <p>{product.care}</p>
                    </details>
                  </div>
                </div>
              </div>

              {open && (
                <>
                  <div className="ss-backdrop" aria-hidden="true" onClick={() => setOpen(false)} />
                  <div
                    ref={dialogRef}
                    className="widget"
                    role="dialog"
                    aria-labelledby="w-title"
                    tabIndex={-1}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setOpen(false);
                    }}
                  >
                    <div className="w-top">
                      <span className="w-brand">SwiftStyle</span>
                      <button className="w-close" type="button" aria-label="Fermer" onClick={() => setOpen(false)}>
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path d="M3 3l10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                    <h3 ref={titleRef} className="w-title" id="w-title" tabIndex={-1}>
                      {TITLES[step]}
                    </h3>
                    <div className="w-steps" aria-hidden="true">
                      {([1, 2, 3] as Step[]).map((n) => (
                        <i key={n} className={n <= step ? "on" : undefined} />
                      ))}
                    </div>
                    <p className="sr">
                      Étape {step} sur 3, {name}
                    </p>

                    {step === 1 && (
                      <>
                        <label className="drop">
                          <input
                            className="sr"
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setPhotoUrl(URL.createObjectURL(file));
                            }}
                          />
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                            <circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                          </svg>
                          <strong>Prendre ou importer une photo</strong>
                          <small>De face, de la tête aux pieds</small>
                          {photoUrl && <img src={photoUrl} alt="Aperçu de votre photo" />}
                        </label>
                        <Slider id="p-h" label="Taille" unit="cm" value={m.h} min={145} max={205} onChange={(h) => setM((prev) => ({ ...prev, h }))} />
                        <p className="w-note">
                          Démo : la photo reste sur votre appareil, rien n&apos;est envoyé. Les mensurations sont simulées.
                        </p>
                        <button
                          className="w-cta"
                          type="button"
                          disabled={!photoUrl || busy !== null}
                          aria-busy={busy !== null}
                          onClick={() =>
                            runLoading(1700, "Analyse de la photo…").then(() => {
                              setStep(2);
                              readBody();
                            })
                          }
                        >
                          {busy ?? "Analyser la photo"}
                        </button>
                      </>
                    )}

                    {step === 2 && (
                      <>
                        <p className={reading ? "w-lead w-read" : "w-lead w-read is-done"} aria-live="polite">
                          {reading ? (
                            <i aria-hidden="true" />
                          ) : (
                            <svg viewBox="0 0 16 16" aria-hidden="true">
                              <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                          {reading ? "Lecture de vos mensurations sur la photo…" : "Mesurées sur votre photo : vous n'avez rien à régler."}
                        </p>
                        {BODY.map((b) => (
                          <Slider key={b.key} id={b.id} label={b.label} unit="cm" value={m[b.key]} min={b.min} max={b.max} />
                        ))}
                        <fieldset className="w-group">
                          <legend>Je porte mes vêtements</legend>
                          <div className="w-seg">
                            {FITS.map((f) => (
                              <label key={f.value}>
                                <input className="sr" type="radio" name="demo-fit" value={f.value} checked={fit === f.value} onChange={() => setFit(f.value)} />
                                <span>{f.label}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <button
                          className="w-cta"
                          type="button"
                          disabled={busy !== null || reading}
                          aria-busy={busy !== null}
                          onClick={() => runLoading(900, "Calcul de votre taille…").then(() => setStep(3))}
                        >
                          {busy ?? "Voir ma taille"}
                        </button>
                      </>
                    )}

                    {result && (
                      <div aria-live="polite">
                        <div className="w-res">
                          <div className="w-size">{result.size}</div>
                          <div>
                            <p className="t">Taille {result.size} conseillée</p>
                            <p className="s">{Math.round(result.confidence * 100)} % de correspondance pour cet article</p>
                          </div>
                        </div>
                        <ul className="w-fit">
                          {result.details.map((d) => (
                            <li key={d.key}>
                              <span>{LABEL[d.key]}</span>
                              <b>{d.feel}</b>
                              <span className="bar">
                                <i style={{ left: `${clamp(50 + d.position * 25, 4, 96).toFixed(1)}%` }} />
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="w-other">{result.alternatives.map((a) => `${a.size} : ${a.note}`).join(". ")}.</p>
                        <button className="w-cta" type="button" onClick={() => chooseSize(result.size)}>
                          Choisir la taille {result.size}
                        </button>
                      </div>
                    )}

                    <div className={busy ? "w-progress on" : "w-progress"} aria-hidden="true">
                      <i ref={barRef} />
                    </div>
                    {step > 1 && (
                      <button className="w-back" type="button" disabled={busy !== null || reading} onClick={() => setStep(step === 3 ? 2 : 1)}>
                        {step === 3 ? "Revoir l'analyse" : "Changer de photo"}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="monitor-stand" aria-hidden="true">
          <i />
          <b />
        </div>
      </div>
    </section>
  );
}
