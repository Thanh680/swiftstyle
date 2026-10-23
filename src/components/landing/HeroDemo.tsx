"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { estimateBody, estimateBodyExact, type BodyKey, type FitPreference, type SizeResult } from "@/lib/recommendation";
import { asset } from "@/lib/asset";
import { personSVG, pointsSVG, recommend } from "./figures";

/**
 * Animation du haut de page : un faux curseur essaie le widget sur un t-shirt.
 * 1. Il importe une photo et règle sa taille, le seul réglage demandé.
 * 2. L'analyse de la photo remplit seule, en décalé, les tours de poitrine, de taille et de hanches :
 *    leurs curseurs sont verrouillés et le faux curseur s'écarte de la modale.
 * 3. La taille conseillée s'affiche et le mannequin enfile le t-shirt.
 * Le mannequin suit chaque valeur (règle de hauteur, rubans de mesure).
 * Le logo « Swift / Style » n'apparaît qu'au clic sur le bouton.
 * La scène est entièrement décorative : aucun vrai contrôle, le bouton compris (seul le faux curseur « clique »).
 * Les tailles viennent du vrai moteur de recommandation, avec le guide d'exemple du t-shirt.
 */

/** Le poids reste interne : c'est la corpulence lue sur la photo, qui élargit le mannequin, sans curseur. */
type Key = "h" | "w" | BodyKey;
type Shown = "h" | BodyKey;
type Vals = Record<Key, number>;
type Step = 1 | 2 | 3;
type Scene = "off" | "intro" | "modal" | "out";

/**
 * Tours non arrondis : le mannequin les compare à chaque image à l'estimation (voir `morph`), et un
 * arrondi au centimètre le ferait trembler pendant l'analyse. L'affichage arrondit de son côté.
 */
const withBody = (h: number, w: number): Vals => ({ h, w, ...estimateBodyExact(h, w) });
/** Taille et poids pour lesquels public/mannequin.svg est dessiné. */
const BASE = withBody(172, 68);
/**
 * Silhouette de départ, mince mais plausible : l'analyse l'étoffe jusqu'à une carrure proche de
 * celle du dessin, pour laquelle le t-shirt porté est ajusté.
 */
const START = withBody(172, 60);
/** Ce que l'analyse « lit » sur la photo. */
const SHOT: Vals = { h: 178, w: 74, chest: 99, waist: 83, hips: 101 };

const RANGE: Record<Shown, [number, number]> = { h: [145, 205], chest: [70, 130], waist: [55, 125], hips: [75, 135] };
const FIELD: Record<Shown, { label: string; unit: string }> = {
  h: { label: "Taille", unit: "cm" },
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
const TITLES: Record<Step, string> = { 1: "Votre photo", 2: "Analyse des mensurations", 3: "Votre taille" };
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
/** Part de chaque tour déjà lue sur la photo, de 0 à 1 ; 1 en dehors de l'analyse. */
type Read = Record<BodyKey, number>;
const READ_ALL: Read = { chest: 1, waist: 1, hips: 1 };
/** Tours en train de se remplir : leur curseur et leur ruban sont mis en avant. */
const filling = (read: Read) => BODY.filter((k) => read[k] > 0 && read[k] < 1);
/**
 * Valeur affichée (curseur et ruban) : pendant l'analyse, chaque tour monte depuis le bas de son
 * curseur jusqu'à la valeur lue. Le mannequin, lui, change de silhouette (voir `blend`).
 */
const shown = (v: Vals, read: Read, k: Shown) => (k === "h" ? v.h : RANGE[k][0] + (v[k] - RANGE[k][0]) * read[k]);

// Le t-shirt SwiftStyle (photo détourée), et la personne « photographiée » (tours arrondis : ils s'affichent sur la photo).
const TEE = asset("/demo/tee-blanc.webp");
const shotBody = { h: SHOT.h, w: SHOT.w, ...estimateBody(SHOT.h, SHOT.w) };
const PHOTO =
  personSVG(shotBody, { skin: "#E8BE9C", hair: "#C9A15E", style: "long", top: "#3A3D42", pants: "#2E4B6E", shoes: "#B3263A" }) +
  pointsSVG(shotBody);

const reco = (v: Vals) => {
  const r = (k: Key) => Math.round(v[k]);
  return recommend("tee", { h: r("h"), w: r("w"), chest: r("chest"), waist: r("waist"), hips: r("hips") }, "normale");
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
  const est = estimateBodyExact(v.h, v.w);
  const k = (key: BodyKey) => clamp(1 + 2.5 * (v[key] / est[key] - 1), 0.85, 1.2);
  return { sx, sy, chest: k("chest"), waist: k("waist"), hips: k("hips") };
}
/**
 * Pendant l'analyse, le mannequin passe de sa silhouette d'avant (`from`) à celle des valeurs lues
 * (`to`) : chaque partie du buste s'élargit quand son tour est lu, bras et jambes suivent l'avancée
 * de l'ensemble. Une partie pas encore lue garde sa largeur, même quand la corpulence augmente.
 */
function blend(from: Vals, to: Vals, read: Read) {
  const a = morph(from);
  const b = morph(to);
  const lerp = (x: number, y: number, t: number) => x + (y - x) * t;
  const all = (read.chest + read.waist + read.hips) / 3;
  const sx = lerp(a.sx, b.sx, all);
  const k = (key: BodyKey) => lerp(a.sx * a[key], b.sx * b[key], read[key]) / sx;
  return { sx, sy: lerp(a.sy, b.sy, all), chest: k("chest"), waist: k("waist"), hips: k("hips") };
}
const around =(ox: number, oy: number, x: number, y: number) =>
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

const Lock = () => (
  <svg className="hd-lock" viewBox="0 0 16 16">
    <path d="M5 7V5a3 3 0 0 1 6 0v2M3.75 7h8.5v6.5h-8.5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
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
  const [val, setVal] = useState<Vals>(START);
  const [read, setRead] = useState<Read>(READ_ALL);
  // Valeurs d'avant l'analyse, d'où part la silhouette du mannequin (voir `blend`).
  const [from, setFrom] = useState<Vals | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [res, setRes] = useState<SizeResult | null>(null);
  const [busy, setBusy] = useState<{ label: string; ms: number } | null>(null);
  const [photo, setPhoto] = useState(false);
  const [scan, setScan] = useState(false);
  const [chip, setChip] = useState<SizeResult | null>(null);
  const [down, setDown] = useState<string | null>(null);
  // Réglage mis en avant (champ, règle ou ruban).
  const [active, setActive] = useState<Shown | null>(null);
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
    const m = from ? blend(from, val, read) : morph(val);
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
      if (text) text.textContent = `${LABEL[key]} ${Math.round(shown(val, read, key))}`;
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
  }, [svg, val, read, from]);

  // Repères affichés : la règle à l'étape 1, les rubans ensuite ; ceux qui bougent sont mis en avant
  // (liste séparée par des espaces, lue en CSS avec [data-active~=…]).
  // Le t-shirt habille le mannequin une fois la taille conseillée (après « Voir ma taille »).
  useEffect(() => {
    const root = mqRef.current?.querySelector("svg");
    if (!root) return;
    root.classList.toggle("hd-show-ruler", scene === "modal" && step === 1);
    root.classList.toggle("hd-show-tapes", scene === "modal" && step > 1);
    root.classList.toggle("hd-dressed", scene === "modal" && step === 3);
    const lit = [...(active ? [active] : []), ...filling(read)];
    if (lit.length) root.dataset.active = lit.join(" ");
    else delete root.dataset.active;
  }, [svg, scene, step, active, read]);

  useEffect(() => {
    const stage = stageRef.current;
    const cursor = cursorRef.current;
    if (!stage || !cursor) return;

    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Pas d'animation : la modale reste ouverte sur la taille conseillée.
      const r = reco(SHOT);
      setScene("modal");
      setWords(true);
      setVal(SHOT);
      setStep(3);
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

    // Valeurs courantes. Changer la taille réestime les tours, jusqu'à ce que l'analyse les lise.
    const cur: Vals = { ...START };
    const update = (patch: Partial<Vals>) => {
      Object.assign(cur, patch);
      if ("h" in patch) Object.assign(cur, estimateBodyExact(cur.h, cur.w));
      setVal({ ...cur });
    };

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
    const thumbAt = (key: string, k: Shown, v: number): [number, number] => {
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
    const slide = async (k: Shown, stops: [number, number][]) => {
      const key = `range-${k}`;
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
    /**
     * L'analyse lit les trois tours sur la photo, en décalé : chaque curseur verrouillé se met à monter
     * seul `gap` ms après le précédent, sans attendre qu'il ait fini, pendant que la partie du
     * mannequin qu'il mesure s'élargit.
     */
    const analyse = async (ms: number, gap: number) => {
      await Promise.all(
        BODY.map(async (key, i) => {
          await sleep(i * gap);
          await tween(ms, (e) => setRead((r) => ({ ...r, [key]: e })));
        }),
      );
      await sleep(350);
    };
    const loading = async (ms: number, label: string) => {
      setBusy({ label, ms });
      await sleep(ms);
      setBusy(null);
    };
    const showResult = () => {
      const r = reco(cur);
      setStep(3);
      setRes(r);
      setChip(r);
    };

    (async () => {
      try {
        for (let loop = 0; ; loop++) {
          await whenVisible();
          if (loop > 0) {
            setScene("off");
            setStep(1);
            setRes(null);
            setPhoto(false);
            setScan(false);
            setChip(null);
            update(START);
            // Tout est déjà effacé : une courte pause suffit avant de rejouer l'entrée.
            await sleep(150);
            setRound(loop);
            setScene("intro");
          }
          // Le temps que le t-shirt et le bouton fassent leur entrée ; aux tours suivants, le curseur
          // part pendant que le bouton finit la sienne (il l'a achevée quand le curseur l'atteint).
          await sleep(loop > 0 ? 1000 : 1900);

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
          await sleep(1100);

          // 1. Une photo de face, puis la taille : le seul réglage que fait le client.
          await moveTo("drop", 700);
          await press("drop", () => setPhoto(true));
          await sleep(600);
          await slide("h", [
            [185, 850],
            [SHOT.h, 700],
          ]);
          await moveTo("cta-photo", 650);
          await press("cta-photo", () => setScan(true));
          await loading(1800, "Analyse de la photo…");

          // 2. Analyse : rien à régler, le curseur s'écarte de la modale et les tours se remplissent seuls.
          // Les valeurs lues (corpulence comprise) sont prises d'emblée ; curseurs et mannequin les rejoignent au fil de la lecture.
          setFrom({ ...cur });
          update({ w: SHOT.w, chest: SHOT.chest, waist: SHOT.waist, hips: SHOT.hips });
          setRead({ chest: 0, waist: 0, hips: 0 });
          setStep(2);
          const modal = targets.current.modal;
          if (modal) {
            const r = rel(modal);
            place(Math.min(r.x + r.w + 48, stage.getBoundingClientRect().width - 32), r.y + r.h * 0.42, 700);
          }
          await sleep(500);
          await analyse(1600, 650);
          await moveTo("cta2", 800);
          await press("cta2", () => {});
          await loading(900, "Calcul de votre taille…");
          showResult();
          await sleep(3200);

          cursor.style.opacity = "0";
          setWords(false);
          setScene("out");
          // Juste le temps que tout s'efface (le mannequin, le plus lent, en 0,65 s).
          await sleep(700);
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

  // Les tours lus sur la photo ont des curseurs verrouillés (rond grisé, cadenas) qui bougent seuls.
  const slider = (k: Shown) => {
    const auto = k !== "h";
    const v = shown(val, read, k);
    const on = active === k || (k !== "h" && filling(read).includes(k));
    return (
      <div className={`hd-field${auto ? " is-auto" : ""}${on ? " is-active" : ""}`} key={k}>
        <span className="hd-label">
          {FIELD[k].label}
          {auto && <Lock />}
        </span>
        <span className="hd-out">
          {Math.round(v)} {FIELD[k].unit}
        </span>
        <span
          ref={target(`range-${k}`)}
          className={`hd-range${isDown(`range-${k}`)}`}
          style={{ "--p": ((v - RANGE[k][0]) / (RANGE[k][1] - RANGE[k][0])).toFixed(4) } as CSSProperties}
        >
          <i />
        </span>
      </div>
    );
  };

  const progress = (
    <span className={busy ? "hd-progress on" : "hd-progress"} style={{ "--ms": `${busy?.ms ?? 0}ms` } as CSSProperties}>
      <i />
    </span>
  );
  const cta = (key: string, label: string, off = false) => (
    <span ref={target(key)} className={`hd-cta${off ? " is-off" : ""}${busy ? " is-busy" : ""}${isDown(key)}`}>
      {busy ? busy.label : label}
    </span>
  );

  const reading = BODY.some((k) => read[k] < 1);
  const done = step === 3 ? res : null;
  const face = (
    <div ref={target("modal")} className="hd-face">
      <div className="hd-top">
        <span className="hd-brand">SwiftStyle</span>
        <span className="hd-close">
          <svg viewBox="0 0 16 16">
            <path d="M3 3l10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
      </div>
      <p className="hd-title">{TITLES[step]}</p>
      <div className="hd-steps">
        {[1, 2, 3].map((n) => (
          <i key={n} className={n <= step ? "on" : undefined} />
        ))}
      </div>

      <div className="hd-step" key={step}>
        {step === 1 && (
          <>
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
            {slider("h")}
            {cta("cta-photo", "Analyser la photo", !photo)}
            {progress}
          </>
        )}

        {step === 2 && (
          <>
            <p className={reading ? "hd-lead hd-read" : "hd-lead hd-read is-done"}>
              {reading ? (
                <i />
              ) : (
                <svg viewBox="0 0 16 16">
                  <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {reading ? "Lecture de vos mensurations sur la photo…" : "Mesurées sur votre photo : rien à régler."}
            </p>
            {BODY.map((k) => slider(k))}
            <div className="hd-group">
              <span className="hd-label">Je porte mes vêtements</span>
              <div className="hd-seg">
                {FITS.map((o) => (
                  <span key={o.value} className={o.value === "normale" ? "on" : undefined}>
                    {o.label}
                  </span>
                ))}
              </div>
            </div>
            {cta("cta2", "Voir ma taille", reading)}
            {progress}
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
              <div className="hd-chip">
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

          <div className="hd-modal">{face}</div>

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
