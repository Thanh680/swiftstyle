"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { DEMO_ARTICLES, estimateBody, type BodyKey, type DemoArticle, type FitPreference } from "@/lib/recommendation";
import { body, garment, geo, recommend, ruler, sizeDims, type Measures } from "./figures";

/**
 * Démo du widget sur la page d'accueil. Elle utilise le vrai moteur de
 * recommandation (src/lib/recommendation) avec les guides des tailles d'exemple,
 * entièrement dans le navigateur. Le traitement de la photo est simulé.
 */

type Tab = "mesures" | "photo";
type Skin = "papier" | "minimal" | "nuit";

const LABEL: Record<BodyKey, string> = { chest: "Poitrine", waist: "Tour de taille", hips: "Hanches" };
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const ARTICLES: { value: DemoArticle; label: string; viewBox: string }[] = [
  { value: "tee", label: "T-shirt", viewBox: "52 150 196 240" },
  { value: "jean", label: "Jean", viewBox: "60 292 180 330" },
  { value: "veste", label: "Veste", viewBox: "40 145 220 270" },
];
const FITS: { value: FitPreference; label: string }[] = [
  { value: "ajustee", label: "Ajustés" },
  { value: "normale", label: "Normaux" },
  { value: "ample", label: "Amples" },
];
const SKINS: { value: Skin; label: string }[] = [
  { value: "papier", label: "Papier" },
  { value: "minimal", label: "Minimal" },
  { value: "nuit", label: "Nuit" },
];

// Vignettes des articles : un mannequin standard habillé en M.
const thumbModel = { h: 175, w: 70, ...estimateBody(175, 70) };
const THUMBS = Object.fromEntries(
  ARTICLES.map(({ value }) => [value, garment(value, geo(thumbModel, 150), sizeDims(value, 2, thumbModel))]),
) as Record<DemoArticle, string>;

interface SliderProps {
  id: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  /** Tour de mesure : grisé tant que l'estimation automatique est cochée. */
  tour?: boolean;
  disabled?: boolean;
  onChange: (v: number) => void;
}

function Slider({ id, label, unit, value, min, max, tour, disabled, onChange }: SliderProps) {
  return (
    <div className={["field", tour && "tour", disabled && "is-off"].filter(Boolean).join(" ")}>
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
        disabled={disabled}
        style={{ "--p": `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function WidgetDemo() {
  const [article, setArticle] = useState<DemoArticle>("tee");
  const [m, setM] = useState<Measures>({ h: 172, w: 68, ...estimateBody(172, 68) });
  const [auto, setAuto] = useState(true);
  const [fit, setFit] = useState<FitPreference>("normale");
  const [skin, setSkin] = useState<Skin>("papier");
  const [tab, setTab] = useState<Tab>("mesures");
  const [shown, setShown] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ tab: Tab; label: string } | null>(null);
  const [addedFor, setAddedFor] = useState<string | null>(null);
  const barRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ mesures: null, photo: null });

  // Libère l'aperçu de la photo quand il change ou quand la page se ferme.
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const setMeasure = (key: keyof Measures, value: number) =>
    setM((prev) => {
      const next = { ...prev, [key]: value };
      return auto && (key === "h" || key === "w") ? { ...next, ...estimateBody(next.h, next.w) } : next;
    });

  const toggleAuto = (on: boolean) => {
    setAuto(on);
    if (on) setM((prev) => ({ ...prev, ...estimateBody(prev.h, prev.w) }));
  };

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

  const result = shown ? recommend(article, m, fit) : null;
  const resultKey = JSON.stringify([article, m, fit]);
  const g = geo(m, 215);
  const figure = ruler(m.h) + body(g) + (result ? garment(article, g, sizeDims(article, result.index, m)) : "");

  return (
    <section className="demo crumple" id="demo" aria-labelledby="demo-title">
      <div className="demo-head">
        <div>
          <h2 className="display" id="demo-title">
            Essayez le widget.
          </h2>
          <p>
            Voici ce que vos clients voient sur la fiche produit. Choisissez un article, réglez les mesures ou importez une photo : le
            mannequin suit, et la taille conseillée s&apos;affiche.
          </p>
        </div>
        <fieldset className="skins">
          <legend>Habillage du widget</legend>
          <div className="opts">
            {SKINS.map((s) => (
              <label key={s.value}>
                <input className="sr" type="radio" name="skin" value={s.value} checked={skin === s.value} onChange={() => setSkin(s.value)} />
                <span>{s.label}</span>
              </label>
            ))}
          </div>
          <small>Le widget reprend les couleurs et les polices de votre boutique.</small>
        </fieldset>
      </div>

      <div className="stage">
        <div className="widget" data-skin={skin}>
          <div className="w-head">
            <strong>Trouver ma taille</strong>
            <span>{DEMO_ARTICLES[article].name}</span>
          </div>

          <fieldset className="w-group w-articles">
            <legend>Article</legend>
            <div className="opts">
              {ARTICLES.map((a) => (
                <label key={a.value}>
                  <input className="sr" type="radio" name="article" value={a.value} checked={article === a.value} onChange={() => setArticle(a.value)} />
                  <span className="art">
                    <svg viewBox={a.viewBox} aria-hidden="true" dangerouslySetInnerHTML={{ __html: THUMBS[a.value] }} />
                    {a.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

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
              Une photo
            </button>
          </div>

          <div role="tabpanel" id="panel-m" aria-labelledby="tab-m" hidden={tab !== "mesures"}>
            <Slider id="m-h" label="Taille" unit="cm" value={m.h} min={145} max={205} onChange={(v) => setMeasure("h", v)} />
            <Slider id="m-w" label="Poids" unit="kg" value={m.w} min={40} max={130} onChange={(v) => setMeasure("w", v)} />
            <label className="w-auto">
              <input type="checkbox" checked={auto} onChange={(e) => toggleAuto(e.target.checked)} /> Estimer mes tours de mesure à partir de ma
              taille et de mon poids
            </label>
            <Slider id="m-c" label="Tour de poitrine" unit="cm" value={m.chest} min={70} max={130} tour disabled={auto} onChange={(v) => setMeasure("chest", v)} />
            <Slider id="m-t" label="Tour de taille" unit="cm" value={m.waist} min={55} max={125} tour disabled={auto} onChange={(v) => setMeasure("waist", v)} />
            <Slider id="m-hi" label="Tour de hanches" unit="cm" value={m.hips} min={75} max={135} tour disabled={auto} onChange={(v) => setMeasure("hips", v)} />
            <fieldset className="w-group w-seg">
              <legend>Je porte mes vêtements</legend>
              <div className="opts">
                {FITS.map((f) => (
                  <label key={f.value}>
                    <input className="sr" type="radio" name="fit" value={f.value} checked={fit === f.value} onChange={() => setFit(f.value)} />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button
              className="w-cta"
              type="button"
              disabled={busy !== null}
              onClick={() => runLoading("mesures", 900, "Calcul de votre taille…").then(() => setShown(true))}
            >
              {busy?.tab === "mesures" ? busy.label : "Voir ma taille"}
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
              <strong>Importer une photo de face</strong>
              <small>Debout, bras légèrement écartés, de la tête aux pieds</small>
              {photoUrl && <img src={photoUrl} alt="Aperçu de votre photo" />}
            </label>
            <Slider id="p-h" label="Taille" unit="cm" value={m.h} min={145} max={205} onChange={(v) => setMeasure("h", v)} />
            <Slider id="p-w" label="Poids" unit="kg" value={m.w} min={40} max={130} onChange={(v) => setMeasure("w", v)} />
            <p className="w-note">
              Démo : la photo reste sur votre appareil, rien n&apos;est envoyé. Les mesures affichées sont simulées à partir de votre taille et de
              votre poids.
            </p>
            <button
              className="w-cta"
              type="button"
              disabled={!photoUrl || busy !== null}
              onClick={() =>
                runLoading("photo", 1700, "Analyse de la photo…").then(() => {
                  toggleAuto(true);
                  setShown(true);
                })
              }
            >
              {busy?.tab === "photo" ? busy.label : "Analyser la photo"}
            </button>
          </div>

          <div className={busy ? "w-progress on" : "w-progress"} aria-hidden="true">
            <i ref={barRef} />
          </div>
          <div className="w-result" aria-live="polite">
            {result ? (
              <>
                <div className="w-res-top">
                  <div className="w-stamp">{result.size}</div>
                  <div>
                    <p className="t">Taille {result.size} conseillée</p>
                    <p className="s">{Math.round(result.confidence * 100)} % de correspondance pour cet article</p>
                  </div>
                </div>
                <ul className="w-fit">
                  {result.details.map((d) => (
                    <li key={d.key}>
                      <span>{LABEL[d.key]}</span>
                      <span className="bar">
                        <i style={{ left: `${clamp(50 + d.position * 25, 4, 96).toFixed(1)}%` }} />
                      </span>
                      <b>{d.feel}</b>
                    </li>
                  ))}
                </ul>
                <p className="w-other">{result.alternatives.map((a) => `${a.size} : ${a.note}`).join(". ")}.</p>
                <button className="w-add" type="button" onClick={() => setAddedFor(resultKey)}>
                  {addedFor === resultKey ? `Ajouté en taille ${result.size} (démo)` : `Ajouter en taille ${result.size} au panier`}
                </button>
              </>
            ) : (
              <p className="w-empty">Réglez vos mesures ou importez une photo, puis lancez le calcul.</p>
            )}
          </div>
        </div>

        <div className="stage-body" aria-hidden="true">
          <svg viewBox="0 0 380 640" dangerouslySetInnerHTML={{ __html: figure }} />
        </div>
      </div>
    </section>
  );
}
