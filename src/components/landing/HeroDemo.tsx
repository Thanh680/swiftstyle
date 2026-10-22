"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { estimateBody, type BodyKey, type FitPreference, type SizeResult } from "@/lib/recommendation";
import { asset } from "@/lib/asset";
import { personSVG, pointsSVG, recommend } from "./figures";

/**
 * Animation du haut de page : un faux curseur fait deux essais du widget sur un t-shirt.
 * 1. « Mes mesures » : taille et poids, puis les tours de poitrine, taille et hanches et la coupe
 *    préférée. Le mannequin suit chaque réglage (règle de hauteur, rubans de mesure).
 * 2. « Caméra » : la modale se retourne, il importe une photo, l'analyse remplit les mesures.
 * Le logo « Swift / Style » n'apparaît qu'au premier clic sur le bouton.
 * La scène est entièrement décorative : aucun vrai contrôle, le bouton compris (seul le faux curseur « clique »).
 * Les tailles viennent du vrai moteur de recommandation, avec le guide d'exemple du t-shirt.
 */

type Face = "mesures" | "photo";
type Key = "h" | "w" | BodyKey;
type Vals = Record<Key, number>;
type Step = 1 | 2 | 3;
type Scene = "off" | "intro" | "modal" | "out";

const withBody = (h: number, w: number): Vals => ({ h, w, ...estimateBody(h, w) });
/** Taille et poids pour lesquels public/mannequin.svg est dessiné. */
const BASE = withBody(172, 68);
/** Ce que l'analyse « lit » sur la photo. */
const SHOT: Vals = { h: 178, w: 74, chest: 99, waist: 83, hips: 101 };

const RANGE: Record<Key, [number, number]> = { h: [145, 205], w: [40, 130], chest: [70, 130], waist: [55, 125], hips: [75, 135] };
const FIELD: Record<Key, { label: string; unit: string }> = {
  h: { label: "Taille", unit: "cm" },
  w: { label: "Poids", unit: "kg" },
  chest: { label: "Tour de poitrine", unit: "cm" },
  waist: { label: "Tour de taille", unit: "cm" },
  hips: { label: "Tour de hanches", unit: "cm" },
};
const BODY: BodyKey[] = ["chest", "waist", "hips"];
const LABEL: Record<BodyKey, string> = { chest: "Poitrine", waist: "Taille", hips: "Hanches" };
const FITS: { value: FitPreference; label: string }[] = [
  { value: "ajustee", label: "Ajustés" },
  { value: "normale", label: "Normaux" },
  { value: "ample", label: "Amples" },
];
const TITLES: Record<Step, string> = { 1: "Votre morphologie", 2: "Vos mensurations", 3: "Votre taille" };
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// Le t-shirt SwiftStyle (photo détourée), et la personne « photographiée ».
const TEE = asset("/demo/tee-blanc.webp");
const shotBody = withBody(SHOT.h, SHOT.w);
const PHOTO =
  personSVG(shotBody, { skin: "#E8BE9C", hair: "#C9A15E", style: "long", top: "#3A3D42", pants: "#2E4B6E", shoes: "#B3263A" }) +
  pointsSVG(shotBody);

const reco = (v: Vals, fit: FitPreference) => {
  const r = (k: Key) => Math.round(v[k]);
  return recommend("tee", { h: r("h"), w: r("w"), chest: r("chest"), waist: r("waist"), hips: r("hips") }, fit);
};

/* ---------- Mannequin : déformation et repères de mesure ---------- */

/**
 * Hauteur selon la taille, largeur selon la corpulence (IMC), puis poitrine, taille et hanches
 * selon l'écart aux tours estimés. Exagéré par rapport à la réalité pour que ça se voie ; la tête
 * garde sa taille.
 */
function morph(v: Vals) {
  const bmi = (kg: number, cm: number) => kg / (cm / 100) ** 2;
  const sy = 1 + 1.3 * (v.h / BASE.h - 1);
  const sx = clamp(1 + 2 * (Math.sqrt(bmi(v.w, v.h) / bmi(BASE.w, BASE.h)) - 1), 0.78, 1.35);
  const est = estimateBody(v.h, v.w);
  const k = (key: BodyKey) => clamp(1 + 2.5 * (v[key] / est[key] - 1), 0.85, 1.2);
  return { sx, sy, chest: k("chest"), waist: k("waist"), hips: k("hips") };
}
const around = (ox: number, oy: number, x: number, y: number) =>
  `translate(${ox} ${oy}) scale(${x.toFixed(4)} ${y.toFixed(4)}) translate(${-ox} ${-oy})`;
const AXIS = 362;
const FEET_Y = 972;
const NECK_Y = 176;
/** Rubans de mesure : arc devant le corps, étiquette à droite du mannequin. */
const TAPES: Record<BodyKey, { d: string; a: [number, number]; b: [number, number] }> = {
  chest: { d: "M 295 258 Q 366 278 437 258", a: [295, 258], b: [437, 258] },
  waist: { d: "M 301 358 Q 363 374 425 358", a: [301, 358], b: [425, 358] },
  hips: { d: "M 262 436 Q 345 458 427 436", a: [262, 436], b: [427, 436] },
};
const LABEL_X = 500;
/** Cadre du dessin dans la page : marge au-dessus de la tête pour qu'il puisse grandir. */
const VB_Y = -70;
const VB_H = 1050;
const VIEWBOX = `100 ${VB_Y} 520 ${VB_H}`;

/**
 * T-shirt porté par le mannequin, en une seule image (public/demo/tee-mannequin.webp) déjà ajustée
 * à son corps : chaque ligne du dessin est recentrée sur l'axe du buste, qui est déhanché, et chaque
 * manche est pliée autour de son épaule pour suivre le bras. Il n'apparaît qu'avec la taille conseillée.
 * Il passe par-dessus le buste, le bras plié et l'épaule du bras tombant, mais sous l'avant-bras
 * et la main de celui-ci : il est donc rangé dans #groupe-bras-gauche, juste après #bras-gauche.
 */
const TEE_WORN = `<g id="tee-porte"><image href="${asset("/demo/tee-mannequin.webp")}" x="218.6" y="160" width="268.6" height="301.2" preserveAspectRatio="none"/></g>`;

const pill = (w: number) =>
  `<g class="hd-pill"><rect x="0" y="-20" width="${w}" height="40" rx="20"/><text x="${w / 2}" y="8.5" text-anchor="middle"></text></g>`;
const OVERLAY = {
  defs: `<radialGradient id="hd-sol-g"><stop offset="0" stop-color="#0E0E0E" stop-opacity=".3"/><stop offset="1" stop-color="#0E0E0E" stop-opacity="0"/></radialGradient>`,
  ground: `<ellipse class="hd-sol" cx="365" cy="972" rx="130" ry="15" fill="url(#hd-sol-g)"/>`,
  ruler:
    `<g class="hd-ruler"><line class="r-line" x1="118" x2="118" y1="25" y2="${FEET_Y}"/><line class="r-cap r-top" x1="106" x2="130"/>` +
    `<line class="r-cap" x1="106" x2="130" y1="${FEET_Y}" y2="${FEET_Y}"/><line class="r-guide" x1="134" x2="330"/>${pill(110)}</g>`,
  tapes: BODY.map(
    (key, i) =>
      `<g class="hd-tape" data-k="${key}" style="--i:${i}"><path class="t-band" d="${TAPES[key].d}"/>` +
      `<line class="t-lead" x1="${TAPES[key].b[0]}" y1="${TAPES[key].b[1]}" x2="${LABEL_X}" y2="${TAPES[key].b[1]}"/>` +
      `<circle cx="${TAPES[key].a[0]}" cy="${TAPES[key].a[1]}" r="6"/><circle cx="${TAPES[key].b[0]}" cy="${TAPES[key].b[1]}" r="6"/>${pill(170)}</g>`,
  ).join(""),
};

const Star = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 0c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8Z" fill="currentColor" />
  </svg>
);
const Letters = ({ word, from }: { word: string; from: number }) =>
  word.split("").map((c, i) => (
    <span key={i} className="hw-l" style={{ "--i": from + i } as CSSProperties}>
      {c}
    </span>
  ));

export function HeroDemo() {
  // État initial = premier plan de l'animation (t-shirt et bouton), aussi rendu côté serveur.
  const [scene, setScene] = useState<Scene>("intro");
  const [words, setWords] = useState(false);
  // Change à chaque tour de boucle : le t-shirt et le bouton sont recréés et rejouent leur entrée (CSS).
  const [round, setRound] = useState(0);
  const [val, setVal] = useState<Vals>(BASE);
  const [fit, setFit] = useState<FitPreference>("normale");
  const [face, setFace] = useState<Face>("mesures");
  const [step, setStep] = useState<Record<Face, Step>>({ mesures: 1, photo: 1 });
  const [res, setRes] = useState<SizeResult | null>(null);
  const [busy, setBusy] = useState<{ face: Face; label: string; ms: number } | null>(null);
  const [photo, setPhoto] = useState(false);
  const [scan, setScan] = useState(false);
  const [chip, setChip] = useState<SizeResult | null>(null);
  const [down, setDown] = useState<string | null>(null);
  // Réglage mis en avant (champ, règle ou ruban) ; « body » : les trois tours à la fois.
  const [active, setActive] = useState<Key | "body" | null>(null);
  const [svg, setSvg] = useState("");

  const stageRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const mqRef = useRef<HTMLDivElement>(null);
  const targets = useRef<Record<string, HTMLElement | null>>({});
  const target = (key: string) => (node: HTMLElement | null) => {
    targets.current[key] = node;
  };

  // Le mannequin est chargé dans la page (et non en <img>) pour déformer ses groupes.
  useEffect(() => {
    let alive = true;
    fetch(asset("/mannequin.svg"))
      .then((r) => (r.ok ? r.text() : ""))
      .then((t) => alive && setSvg(t))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Une fois le dessin chargé : marge pour qu'il puisse grandir, ombre au sol, règle et rubans.
  useEffect(() => {
    const root = mqRef.current?.querySelector("svg");
    const body = root?.querySelector("#mannequin");
    if (!root || !body) return;
    root.setAttribute("viewBox", VIEWBOX);
    root.setAttribute("preserveAspectRatio", "xMidYMax meet");
    root.removeAttribute("width");
    root.removeAttribute("height");
    root.querySelector("defs")?.insertAdjacentHTML("beforeend", OVERLAY.defs);
    body.insertAdjacentHTML("beforebegin", OVERLAY.ground);
    body.insertAdjacentHTML("afterend", OVERLAY.ruler);
    root.querySelector("#bras-gauche")?.insertAdjacentHTML("afterend", TEE_WORN);
    body.insertAdjacentHTML("beforeend", OVERLAY.tapes);
  }, [svg]);

  useEffect(() => {
    const root = mqRef.current?.querySelector("svg");
    if (!root?.querySelector(".hd-tape")) return;
    const m = morph(val);
    const $ = (sel: string) => root.querySelector(sel);
    const set = (sel: string, t: string) => $(sel)?.setAttribute("transform", t);
    const sx = (k: number) => around(AXIS, 0, k, 1);
    set("#mannequin", around(AXIS, FEET_Y, m.sx, m.sy));
    set("#groupe-tete", around(361, NECK_Y, 1 / m.sx, 1 / m.sy));
    $("#poitrine")?.parentElement?.setAttribute("transform", sx(m.chest));
    $("#ventre")?.parentElement?.setAttribute("transform", sx(m.waist));
    set("#bassin", sx(m.hips));
    // Le t-shirt suit le buste ; il annule le décalage du bras dans lequel il est rangé.
    set("#tee-porte", `translate(${(-(m.chest - 1) * 76).toFixed(2)} 0) ${sx((m.chest + m.waist + m.hips) / 3)}`);
    // Bras et jambes suivent les épaules et les hanches.
    set("#groupe-bras-droit", `translate(${(-(m.chest - 1) * 76).toFixed(2)} 0)`);
    set("#groupe-bras-gauche", `translate(${((m.chest - 1) * 76).toFixed(2)} 0)`);
    set("#groupe-jambe-droite", `translate(${(-(m.hips - 1) * 62).toFixed(2)} 0)`);
    set("#groupe-jambe-gauche", `translate(${((m.hips - 1) * 45).toFixed(2)} 0)`);
    set(".hd-sol", around(365, FEET_Y, m.sx, 1));

    for (const key of BODY) {
      const tape = $(`.hd-tape[data-k="${key}"]`);
      if (!tape) continue;
      tape.setAttribute("transform", sx(m[key]));
      // L'étiquette annule les échelles du mannequin pour garder un texte droit.
      const y = TAPES[key].b[1];
      tape.querySelector(".hd-pill")?.setAttribute("transform", `translate(${LABEL_X} ${y}) scale(${1 / (m.sx * m[key])} ${1 / m.sy})`);
      const text = tape.querySelector("text");
      if (text) text.textContent = `${LABEL[key]} ${Math.round(val[key])}`;
    }

    // Règle de hauteur : du sol au sommet de la tête (qui garde sa taille, voir #groupe-tete).
    const top = FEET_Y - (FEET_Y - NECK_Y) * m.sy - (NECK_Y - 25);
    // Le cercle derrière le mannequin l'entoure de la tête aux pieds, centré sur lui.
    // En % de la hauteur de .hd-model (et .hd-disc, même cadre) : le dessin y occupe 98 %, les pieds sont à 98,5 %.
    const head = 1 + ((top - VB_Y) / VB_H) * 98;
    const style = stageRef.current?.style;
    style?.setProperty("--disc-y", `${((head + 98.5) / 2).toFixed(2)}%`);
    style?.setProperty("--disc-d", `${((98.5 - head) * 1.1).toFixed(2)}%`);
    const ruler = $(".hd-ruler");
    if (ruler) {
      ruler.querySelector(".r-line")?.setAttribute("y1", top.toFixed(1));
      for (const line of ruler.querySelectorAll(".r-top, .r-guide")) {
        line.setAttribute("y1", top.toFixed(1));
        line.setAttribute("y2", top.toFixed(1));
      }
      ruler.querySelector(".hd-pill")?.setAttribute("transform", `translate(63 ${(top - 42).toFixed(1)})`);
      const text = ruler.querySelector("text");
      if (text) text.textContent = `${Math.round(val.h)} cm`;
    }
  }, [svg, val]);

  // Repères affichés : la règle à l'étape 1, les rubans ensuite ; celui qu'on règle est mis en avant.
  // Le t-shirt habille le mannequin une fois la taille conseillée (après « Voir ma taille »).
  const shown = step[face];
  useEffect(() => {
    const root = mqRef.current?.querySelector("svg");
    if (!root) return;
    root.classList.toggle("hd-show-ruler", scene === "modal" && shown === 1);
    root.classList.toggle("hd-show-tapes", scene === "modal" && shown > 1);
    root.classList.toggle("hd-dressed", scene === "modal" && shown === 3);
    if (active) root.dataset.active = active;
    else delete root.dataset.active;
  }, [svg, scene, shown, active]);

  useEffect(() => {
    const stage = stageRef.current;
    const cursor = cursorRef.current;
    if (!stage || !cursor) return;

    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Pas d'animation : la modale reste ouverte sur la taille conseillée.
      const v = { ...withBody(166, 58), chest: 90, waist: 71, hips: 93 };
      const r = reco(v, "ample");
      setScene("modal");
      setWords(true);
      setVal(v);
      setFit("ample");
      setStep({ mesures: 3, photo: 1 });
      setRes(r);
      setChip(r);
      return;
    }

    let cancelled = false;
    let visible = false;
    let wake: (() => void) | null = null;
    let raf = 0;
    const timers = new Set<number>();
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible && wake) {
          wake();
          wake = null;
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(stage);

    const STOP = Symbol("stop");
    const check = () => {
      if (cancelled) throw STOP;
    };
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = window.setTimeout(() => {
          timers.delete(t);
          resolve();
        }, ms);
        timers.add(t);
      }).then(check);
    const whenVisible = () => (visible ? Promise.resolve() : new Promise<void>((resolve) => (wake = resolve))).then(check);
    const ease = (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
    const tween = (ms: number, frame: (k: number) => void) =>
      new Promise<void>((resolve) => {
        const t0 = performance.now();
        const tick = (now: number) => {
          if (cancelled) return resolve();
          const k = Math.min(1, (now - t0) / ms);
          frame(ease(k));
          if (k < 1) raf = requestAnimationFrame(tick);
          else resolve();
        };
        raf = requestAnimationFrame(tick);
      }).then(check);

    // Valeurs courantes. Changer la taille ou le poids réestime les tours, comme dans le widget.
    const cur: Vals = { ...BASE };
    let curFit: FitPreference = "normale";
    const update = (patch: Partial<Vals>) => {
      Object.assign(cur, patch);
      if ("h" in patch || "w" in patch) Object.assign(cur, estimateBody(cur.h, cur.w));
      setVal({ ...cur });
    };
    const goTo = (f: Face, s: Step) => setStep((prev) => ({ ...prev, [f]: s }));

    // Faux curseur : la pointe de la flèche est le coin haut gauche de l'élément.
    let cx = 0;
    let cy = 0;
    const place = (x: number, y: number, ms: number) => {
      cx = x;
      cy = y;
      cursor.style.transitionDuration = `${ms}ms, 300ms`;
      cursor.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    };
    const rel = (node: HTMLElement) => {
      const s = stage.getBoundingClientRect();
      const r = node.getBoundingClientRect();
      return { x: r.left - s.left, y: r.top - s.top, w: r.width, h: r.height };
    };
    const moveTo = async (key: string, ms: number) => {
      const node = targets.current[key];
      if (node) {
        const r = rel(node);
        place(r.x + r.w / 2, r.y + r.h / 2, ms);
      }
      await sleep(ms + 60);
    };
    /** Centre du rond d'un curseur de réglage pour la valeur `v` (même calcul que `left` en CSS). */
    const thumbAt = (key: string, k: Key, v: number): [number, number] => {
      const node = targets.current[key];
      if (!node) return [cx, cy];
      const r = rel(node);
      const half = 0.7 * parseFloat(getComputedStyle(node).fontSize);
      const [lo, hi] = RANGE[k];
      return [r.x + half + ((v - lo) / (hi - lo)) * (r.w - 2 * half), r.y + r.h / 2];
    };
    const press = async (key: string, action: () => void) => {
      cursor.classList.add("is-down");
      setDown(key);
      await sleep(150);
      action();
      cursor.classList.remove("is-down");
      setDown(null);
      await sleep(150);
    };
    /** Attrape le rond d'un curseur de réglage, le fait glisser par étapes, puis le relâche. */
    const slide = async (f: Face, k: Key, stops: [number, number][]) => {
      const key = `range-${f}-${k}`;
      const [x, y] = thumbAt(key, k, cur[k]);
      place(x, y, 600);
      await sleep(650);
      cursor.classList.add("is-down");
      setDown(key);
      setActive(k);
      for (const [to, ms] of stops) {
        const from = cur[k];
        await tween(ms, (e) => {
          const v = from + (to - from) * e;
          update({ [k]: v });
          const [px, py] = thumbAt(key, k, v);
          place(px, py, 0);
        });
        await sleep(110);
      }
      cursor.classList.remove("is-down");
      setDown(null);
      setActive(null);
      await sleep(200);
    };
    /** Les trois tours glissent ensemble vers leurs valeurs, comme s'ils se remplissaient tout seuls. */
    const fillBody = async (to: Record<BodyKey, number>, ms: number) => {
      const a = { chest: cur.chest, waist: cur.waist, hips: cur.hips };
      setActive("body");
      await tween(ms, (e) =>
        update({ chest: a.chest + (to.chest - a.chest) * e, waist: a.waist + (to.waist - a.waist) * e, hips: a.hips + (to.hips - a.hips) * e }),
      );
      await sleep(200);
      setActive(null);
      await sleep(200);
    };
    const loading = async (f: Face, ms: number, label: string) => {
      setBusy({ face: f, label, ms });
      await sleep(ms);
      setBusy(null);
    };
    const showResult = (f: Face) => {
      const r = reco(cur, curFit);
      goTo(f, 3);
      setRes(r);
      setChip(r);
    };

    (async () => {
      try {
        for (let loop = 0; ; loop++) {
          await whenVisible();
          if (loop > 0) {
            setScene("off");
            setFace("mesures");
            setStep({ mesures: 1, photo: 1 });
            setRes(null);
            setPhoto(false);
            setScan(false);
            setChip(null);
            curFit = "normale";
            setFit(curFit);
            update(withBody(BASE.h, BASE.w));
            await sleep(600);
            setRound(loop);
            setScene("intro");
          }
          // Le temps que le t-shirt et le bouton fassent leur entrée.
          await sleep(1900);

          // Le curseur entre par le bas et clique : le logo et la modale apparaissent.
          const s = stage.getBoundingClientRect();
          place(s.width * 0.78, s.height * 0.96, 0);
          await sleep(40);
          cursor.style.opacity = "1";
          await moveTo("btn", 850);
          await press("btn", () => {
            setScene("modal");
            setWords(true);
          });
          await sleep(1300);

          // 1. Mes mesures : taille et poids…
          await slide("mesures", "h", [
            [186, 950],
            [166, 950],
          ]);
          await slide("mesures", "w", [
            [84, 950],
            [58, 950],
          ]);
          await moveTo("cta-mesures", 650);
          await press("cta-mesures", () => goTo("mesures", 2));
          await sleep(900);
          // … puis les tours, ajustés à la main, et la coupe préférée.
          await slide("mesures", "chest", [[90, 750]]);
          await slide("mesures", "waist", [[71, 650]]);
          await slide("mesures", "hips", [[93, 700]]);
          await moveTo("fit-mesures-ample", 650);
          await press("fit-mesures-ample", () => {
            curFit = "ample";
            setFit(curFit);
          });
          await sleep(300);
          await moveTo("cta2-mesures", 600);
          await press("cta2-mesures", () => {});
          await loading("mesures", 1000, "Calcul de votre taille…");
          showResult("mesures");
          await sleep(2500);

          // 2. Caméra : nouveau clic sur le bouton, la modale se retourne.
          await moveTo("btn", 1000);
          await press("btn", () => {
            setChip(null);
            curFit = "normale";
            setFit(curFit);
            setFace("photo");
          });
          await sleep(1000);
          await moveTo("drop", 700);
          await press("drop", () => setPhoto(true));
          await sleep(700);
          await moveTo("cta-photo", 650);
          await press("cta-photo", () => setScan(true));
          await loading("photo", 1800, "Analyse de la photo…");
          // La taille et le poids lus sur la photo arrivent dans les curseurs, le mannequin suit…
          const from = { ...cur };
          await tween(900, (e) => update({ h: from.h + (SHOT.h - from.h) * e, w: from.w + (SHOT.w - from.w) * e }));
          await sleep(300);
          goTo("photo", 2);
          await sleep(700);
          // … puis les tours mesurés, tous ensemble.
          await fillBody({ chest: SHOT.chest, waist: SHOT.waist, hips: SHOT.hips }, 1200);
          await moveTo("cta2-photo", 700);
          await press("cta2-photo", () => {});
          await loading("photo", 900, "Calcul de votre taille…");
          showResult("photo");
          await sleep(3000);

          cursor.style.opacity = "0";
          setWords(false);
          setScene("out");
          await sleep(900);
        }
      } catch (e) {
        if (e !== STOP) throw e;
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      cancelAnimationFrame(raf);
      observer.disconnect();
      wake?.();
    };
  }, []);

  const isDown = (key: string) => (down === key ? " is-down" : "");

  const slider = (f: Face, k: Key) => (
    <div className={active === k || (active === "body" && k !== "h" && k !== "w") ? "hd-field is-active" : "hd-field"} key={k}>
      <span className="hd-label">{FIELD[k].label}</span>
      <span className="hd-out">
        {Math.round(val[k])} {FIELD[k].unit}
      </span>
      <span
        ref={target(`range-${f}-${k}`)}
        className={`hd-range${isDown(`range-${f}-${k}`)}`}
        style={{ "--p": ((val[k] - RANGE[k][0]) / (RANGE[k][1] - RANGE[k][0])).toFixed(4) } as CSSProperties}
      >
        <i />
      </span>
    </div>
  );

  const progress = (f: Face) => {
    const load = busy?.face === f ? busy : null;
    return (
      <span className={load ? "hd-progress on" : "hd-progress"} style={{ "--ms": `${load?.ms ?? 0}ms` } as CSSProperties}>
        <i />
      </span>
    );
  };
  const cta = (f: Face, key: string, label: string, off = false) => {
    const load = busy?.face === f ? busy : null;
    return (
      <span ref={target(key)} className={`hd-cta${off ? " is-off" : ""}${load ? " is-busy" : ""}${isDown(key)}`}>
        {load ? load.label : label}
      </span>
    );
  };

  const renderFace = (f: Face) => {
    const s = step[f];
    const done = s === 3 ? res : null;
    return (
      <div className={`hd-face hd-face--${f}`}>
        <div className="hd-top">
          <span className="hd-brand">
            <Star />
            SwiftStyle
          </span>
          <span className="hd-close">
            <svg viewBox="0 0 16 16">
              <path d="M3 3l10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
        </div>
        <p className="hd-title">{TITLES[s]}</p>
        <div className="hd-steps">
          {[1, 2, 3].map((n) => (
            <i key={n} className={n <= s ? "on" : undefined} />
          ))}
        </div>

        <div className="hd-step" key={s}>
          {s === 1 && (
            <>
              <div className="hd-tabs">
                <span className={f === "mesures" ? "on" : undefined}>Mes mesures</span>
                <span className={f === "photo" ? "on" : undefined}>Caméra</span>
              </div>
              {f === "mesures" ? (
                <p className="hd-lead">Deux repères suffisent pour estimer votre morphologie.</p>
              ) : (
                <div ref={target("drop")} className={`hd-drop${isDown("drop")}`}>
                  <svg viewBox="0 0 24 24">
                    <path d="M4 8h3l1.5-2h7L17 8h3v11H4z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                    <circle cx="12" cy="13" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  </svg>
                  <strong>Prendre ou importer une photo</strong>
                  <small>De face, de la tête aux pieds</small>
                  <div className={["hd-shot", photo && "on", scan && "scan"].filter(Boolean).join(" ")}>
                    <div className="hd-shot-img">
                      <svg viewBox="0 60 300 580" dangerouslySetInnerHTML={{ __html: PHOTO }} />
                      <i className="hd-scanline" />
                    </div>
                  </div>
                </div>
              )}
              {slider(f, "h")}
              {slider(f, "w")}
              {f === "mesures" ? cta(f, "cta-mesures", "Continuer") : cta(f, "cta-photo", "Analyser la photo", !photo)}
              {progress(f)}
            </>
          )}

          {s === 2 && (
            <>
              <p className="hd-lead">
                {f === "photo"
                  ? "Mesurées sur votre photo. Ajustez-les si besoin."
                  : "Estimées à partir de votre taille et de votre poids. Ajustez-les si vous les connaissez."}
              </p>
              {BODY.map((k) => slider(f, k))}
              <div className="hd-group">
                <span className="hd-label">Je porte mes vêtements</span>
                <div className="hd-seg">
                  {FITS.map((o) => (
                    <span key={o.value} ref={target(`fit-${f}-${o.value}`)} className={`${fit === o.value ? "on" : ""}${isDown(`fit-${f}-${o.value}`)}`}>
                      {o.label}
                    </span>
                  ))}
                </div>
              </div>
              {cta(f, `cta2-${f}`, "Voir ma taille")}
              {progress(f)}
            </>
          )}

          {done && (
            <div className="hd-result">
              <div className="hd-res">
                <div className="hd-size">
                  <b>{done.size}</b>
                </div>
                <div>
                  <p className="t">Taille {done.size} conseillée</p>
                  <p className="s">{Math.round(done.confidence * 100)} % de correspondance pour cet article</p>
                </div>
              </div>
              <ul className="hd-fit">
                {done.details.map((d) => (
                  <li key={d.key}>
                    <span>{FIELD[d.key].label}</span>
                    <b>{d.feel}</b>
                    <span className="bar">
                      <i style={{ left: `${clamp(50 + d.position * 25, 4, 96).toFixed(1)}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
              <span className="hd-cta">Choisir la taille {done.size}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <h1 id="hero-title" aria-label="SwiftStyle" className={words ? "on" : undefined}>
        <span className="hw hw--top">
          <Letters word="Swift" from={0} />
        </span>
        <span className="hw hw--bottom">
          <Letters word="Style" from={5} />
        </span>
      </h1>

      <div ref={stageRef} className="hd" data-scene={scene}>
        <div className="hd-scene" aria-hidden="true" inert>
          <div className="hd-tee-disc" key={`disc-${round}`} />
          <div className="hd-tee" key={`tee-${round}`}>
            <img src={TEE} alt="" width={720} height={702} />
            <span className="hd-tag">T-shirt SwiftStyle</span>
          </div>

          {/* Le cercle est à part : devant le logo (qu'on devine au travers), derrière le mannequin. */}
          <div className="hd-disc" />
          <div className="hd-model">
            <div ref={mqRef} className="hd-mq" dangerouslySetInnerHTML={{ __html: svg }} />
            {chip && (
              <div className="hd-chip" key={`${chip.size}-${face}`}>
                <img src={TEE} alt="" width={44} height={43} />
                <div>
                  <strong>Taille {chip.size} conseillée</strong>
                  <span>{Math.round(chip.confidence * 100)} % de correspondance</span>
                </div>
                {Array.from({ length: 8 }, (_, i) => (
                  <i key={i} style={{ "--a": `${i * 45 + 20}deg` } as CSSProperties} />
                ))}
              </div>
            )}
          </div>

          <div className="hd-modal">
            <div className={face === "photo" ? "hd-card is-flipped" : "hd-card"}>
              {renderFace("mesures")}
              {renderFace("photo")}
            </div>
          </div>

          <span key={`btn-${round}`} ref={target("btn")} className={`hd-btn${isDown("btn")}`}>
            Trouver ma taille avec SwiftStyle
          </span>

          <div ref={cursorRef} className="hd-cursor">
            <svg viewBox="0 0 22 28">
              <path d="M2 2v20l5.4-5 3.6 8.2 3.6-1.6-3.5-7.9H19z" fill="#0E0E0E" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            <i />
          </div>
        </div>
      </div>
    </>
  );
}
