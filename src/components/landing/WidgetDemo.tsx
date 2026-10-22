"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { DEMO_ARTICLES, estimateBody, type BodyKey, type DemoArticle, type FitPreference } from "@/lib/recommendation";
import { recommend, type Measures } from "./figures";

/**
 * Démo du widget sur la page d'accueil : la fiche produit d'une boutique fictive,
 * affichée dans un écran. Le widget y prend la forme d'un bouton sous le choix des
 * tailles, qui ouvre une modale, comme le vrai widget (widget/index.ts). La modale
 * est volontairement neutre : elle prend les couleurs, la police et les arrondis de
 * la boutique. Elle utilise le vrai moteur de recommandation (src/lib/recommendation)
 * avec les guides des tailles d'exemple, entièrement dans le navigateur. Le
 * traitement de la photo est simulé.
 */

type Tab = "mesures" | "photo";
type Step = 1 | 2 | 3;
type View = "face" | "detail";

const LABEL: Record<BodyKey, string> = { chest: "Poitrine", waist: "Tour de taille", hips: "Hanches" };
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
      { name: "Blanc", src: "/demo/tee-blanc.webp", swatch: "#F4F3EE" },
      { name: "Citron", src: "/demo/tee-citron.webp", swatch: "#E3EB66" },
      { name: "Corail", src: "/demo/tee-corail.webp", swatch: "#F2694B" },
      { name: "Encre", src: "/demo/tee-encre.webp", swatch: "#2B2E35" },
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
    colors: [{ name: "Bleu délavé", src: "/demo/jean-bleu.webp", swatch: "#7FA3CF" }],
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
      { name: "Blanc", src: "/demo/sweat-blanc.webp", swatch: "#F4F3EE" },
      { name: "Sauge", src: "/demo/sweat-sauge.webp", swatch: "#A4B795" },
      { name: "Rouille", src: "/demo/sweat-rouille.webp", swatch: "#B5613E" },
      { name: "Encre", src: "/demo/sweat-encre.webp", swatch: "#2B2E35" },
    ],
  },
};
const ARTICLES = Object.keys(PRODUCTS) as DemoArticle[];

const FITS: { value: FitPreference; label: string }[] = [
  { value: "ajustee", label: "Ajustés" },
  { value: "normale", label: "Normaux" },
  { value: "ample", label: "Amples" },
];
const TITLES: Record<Step, string> = { 1: "Votre morphologie", 2: "Vos mensurations", 3: "Votre taille" };

const zoomOn = (d: Product["detail"]): CSSProperties => ({ transform: `scale(${d.zoom})`, transformOrigin: `${d.x}% ${d.y}%` });

const HESITATION = "Vous hésitez entre deux tailles ? SwiftStyle vous conseille.";

interface SliderProps {
  id: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

function Slider({ id, label, unit, value, min, max, onChange }: SliderProps) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
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
        onChange={(e) => onChange(Number(e.target.value))}
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
  const [tab, setTab] = useState<Tab>("mesures");
  const [source, setSource] = useState<Tab>("mesures");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ tab: Tab; label: string } | null>(null);

  const barRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ mesures: null, photo: null });
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

  useEffect(() => () => clearTimeout(addedTimer.current), []);

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

  /** Changer la taille ou le poids réestime les tours de mesure, que le client peut ensuite ajuster. */
  const setMeasure = (key: keyof Measures, value: number) =>
    setM((prev) => {
      const next = { ...prev, [key]: value };
      return key === "h" || key === "w" ? { ...next, ...estimateBody(next.h, next.w) } : next;
    });

  const selectTab = (t: Tab) => {
    setTab(t);
    tabRefs.current[t]?.focus();
  };
  const onTabKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      selectTab(tab === "mesures" ? "photo" : "mesures");
    }
  };

  /** Barre de progression, puis affichage du résultat. */
  function runLoading(from: Tab, ms: number, label: string): Promise<void> {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bar = barRef.current;
    setBusy({ tab: from, label });
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
          fenêtre qui conseille la bonne taille à partir de quelques mesures ou d&apos;une photo, puis la sélectionne sur la fiche.
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
                      <span className="w-brand">
                        <svg viewBox="0 0 16 16" aria-hidden="true">
                          <path d="M8 0c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8Z" fill="currentColor" />
                        </svg>
                        SwiftStyle
                      </span>
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
                        <div className="w-tabs" role="tablist" aria-label="Méthode" onKeyDown={onTabKey}>
                          <button
                            ref={(el) => {
                              tabRefs.current.mesures = el;
                            }}
                            role="tab"
                            id="tab-m"
                            aria-controls="panel-m"
                            aria-selected={tab === "mesures"}
                            tabIndex={tab === "mesures" ? 0 : -1}
                            onClick={() => selectTab("mesures")}
                          >
                            Mes mesures
                          </button>
                          <button
                            ref={(el) => {
                              tabRefs.current.photo = el;
                            }}
                            role="tab"
                            id="tab-p"
                            aria-controls="panel-p"
                            aria-selected={tab === "photo"}
                            tabIndex={tab === "photo" ? 0 : -1}
                            onClick={() => selectTab("photo")}
                          >
                            Caméra
                          </button>
                        </div>

                        <div role="tabpanel" id="panel-m" aria-labelledby="tab-m" hidden={tab !== "mesures"}>
                          <p className="w-lead">Deux repères suffisent pour estimer votre morphologie.</p>
                          <Slider id="m-h" label="Taille" unit="cm" value={m.h} min={145} max={205} onChange={(v) => setMeasure("h", v)} />
                          <Slider id="m-w" label="Poids" unit="kg" value={m.w} min={40} max={130} onChange={(v) => setMeasure("w", v)} />
                          <button
                            className="w-cta"
                            type="button"
                            onClick={() => {
                              setSource("mesures");
                              setStep(2);
                            }}
                          >
                            Continuer
                          </button>
                        </div>

                        <div role="tabpanel" id="panel-p" aria-labelledby="tab-p" hidden={tab !== "photo"}>
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
                          {/* Côte à côte : avec la zone photo, l'onglet tient dans la modale sans défiler. */}
                          <div className="w-pair">
                            <Slider id="p-h" label="Taille" unit="cm" value={m.h} min={145} max={205} onChange={(v) => setMeasure("h", v)} />
                            <Slider id="p-w" label="Poids" unit="kg" value={m.w} min={40} max={130} onChange={(v) => setMeasure("w", v)} />
                          </div>
                          <p className="w-note">
                            Démo : la photo reste sur votre appareil, rien n&apos;est envoyé. Les mensurations sont simulées.
                          </p>
                          <button
                            className="w-cta"
                            type="button"
                            disabled={!photoUrl || busy !== null}
                            aria-busy={busy?.tab === "photo"}
                            onClick={() =>
                              runLoading("photo", 1700, "Analyse de la photo…").then(() => {
                                setM((prev) => ({ ...prev, ...estimateBody(prev.h, prev.w) }));
                                setSource("photo");
                                setStep(2);
                              })
                            }
                          >
                            {busy?.tab === "photo" ? busy.label : "Analyser la photo"}
                          </button>
                        </div>
                      </>
                    )}

                    {step === 2 && (
                      <>
                        <p className="w-lead">
                          {source === "photo"
                            ? "Mesurées sur votre photo. Ajustez-les si besoin."
                            : "Estimées à partir de votre taille et de votre poids. Ajustez-les si vous les connaissez."}
                        </p>
                        <Slider id="m-c" label="Tour de poitrine" unit="cm" value={m.chest} min={70} max={130} onChange={(v) => setMeasure("chest", v)} />
                        <Slider id="m-t" label="Tour de taille" unit="cm" value={m.waist} min={55} max={125} onChange={(v) => setMeasure("waist", v)} />
                        <Slider id="m-hi" label="Tour de hanches" unit="cm" value={m.hips} min={75} max={135} onChange={(v) => setMeasure("hips", v)} />
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
                          disabled={busy !== null}
                          aria-busy={busy?.tab === "mesures"}
                          onClick={() => runLoading("mesures", 900, "Calcul de votre taille…").then(() => setStep(3))}
                        >
                          {busy?.tab === "mesures" ? busy.label : "Voir ma taille"}
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
                      <button className="w-back" type="button" disabled={busy !== null} onClick={() => setStep(step === 3 ? 2 : 1)}>
                        {step === 3 ? "Modifier mes mensurations" : "Retour"}
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
