"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { DEMO_ARTICLES, estimateBody, type DemoArticle } from "@/lib/recommendation";
import { asset } from "@/lib/asset";
import { body, garment, geo, pointsSVG, recommend, sizeDims, type Marks } from "./figures";

/**
 * Photos de face, de la tête aux pieds. Les repères sont relevés en pixels sur l'original
 * (`size`) : haut de la tête, plante des pieds, axe du corps, et pour chaque niveau mesuré
 * [hauteur, demi-largeur]. Le fichier servi peut être plus petit s'il garde les proportions.
 */
interface Photo {
  src: string;
  size: [number, number];
  head: number;
  feet: number;
  cx: number;
  wall: string;
  marks: Marks;
}

const PEOPLE: { name: string; h: number; w: number; article: DemoArticle; photo: Photo }[] = [
  {
    name: "Aurélien",
    h: 178,
    w: 80,
    article: "jean",
    photo: {
      src: asset("/photos/aurelien.webp"),
      size: [611, 1024],
      head: 85,
      feet: 925,
      cx: 307,
      wall: "#F3F3EF",
      marks: { shoulder: [255, 93], chest: [330, 82], waist: [470, 79], hips: [545, 80] },
    },
  },
  {
    name: "Léa",
    h: 166,
    w: 57,
    article: "tee",
    photo: {
      src: asset("/photos/lea.webp"),
      size: [1194, 2000],
      head: 173,
      feet: 1915,
      cx: 600,
      wall: "#F3F2F0",
      marks: { shoulder: [500, 197], chest: [700, 165], waist: [900, 160], hips: [1080, 182] },
    },
  },
];

const SCENES = PEOPLE.map((p) => {
  const m = { h: p.h, w: p.w, ...estimateBody(p.h, p.w) };
  const g = geo(m, 150);
  // La photo est mise à l'échelle du mannequin : tête en haut du dessin, pieds au sol, axe au centre.
  const ph = p.photo;
  const k = (g.Y(1) - g.Y(0)) / (ph.feet - ph.head);
  const x = 150 - ph.cx * k;
  const y = g.Y(0) - ph.head * k;
  const marks = Object.fromEntries(
    Object.entries(ph.marks).map(([key, [my, half]]) => [key, [y + my * k, half * k]]),
  ) as Marks;
  const photo =
    `<rect x="0" y="60" width="300" height="580" fill="${ph.wall}"/>` +
    `<image href="${ph.src}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(ph.size[0] * k).toFixed(1)}" height="${(ph.size[1] * k).toFixed(1)}" preserveAspectRatio="none"/>`;
  const r = recommend(p.article, m, "normale");
  return {
    ...p,
    photo: photo + pointsSVG(m, marks),
    figure: body(g) + `<g class="snap-garment">${garment(p.article, g, sizeDims(p.article, r.index, m))}</g>`,
    size: r.size,
    score: Math.round(r.confidence * 100),
    articleName: DEMO_ARTICLES[p.article].name,
  };
});

const STEPS = [
  "Le client prend quelques photos de la tête aux pieds : de face, puis de profil.",
  "Le widget repère les épaules, la poitrine, la taille et les hanches.",
  "Il conseille la bonne taille pour l'article affiché.",
];
const ALL_STEPS = STEPS.length + 1;
const FINAL = ["in", "points", "shift", "reveal", "dress", "stamp"];

/**
 * Boucle d'essayages, une personne après l'autre : photo, repérage des mesures, habillage du mannequin.
 * Chaque étape ajoute une classe CSS à la scène ; l'animation elle-même est dans landing.css.
 */
function useSnapLoop(stageRef: RefObject<HTMLDivElement | null>) {
  const [person, setPerson] = useState(0);
  const [phases, setPhases] = useState<string[]>([]);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhases(FINAL);
      setStep(ALL_STEPS);
      return;
    }

    let cancelled = false;
    let visible = false;
    let timer: number | undefined;
    let wake: (() => void) | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = Boolean(entry?.isIntersecting);
        if (visible && wake) {
          wake();
          wake = null;
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(stage);

    const sleep = (ms: number) => new Promise<void>((resolve) => (timer = window.setTimeout(resolve, ms)));
    const whenVisible = () => (visible ? Promise.resolve() : new Promise<void>((resolve) => (wake = resolve)));
    const add = (...classes: string[]) => setPhases((p) => [...p, ...classes]);

    (async () => {
      for (let k = 0; ; k++) {
        await whenVisible();
        if (cancelled) return;
        setPhases(["reset"]);
        setStep(0);
        setPerson(k % SCENES.length);
        const timeline: [number, () => void][] = [
          [60, () => setPhases([])],
          [40, () => add("in")],
          [800, () => { setStep(1); add("aim"); }],
          [700, () => add("flash")],
          [650, () => { setStep(2); add("scan"); }],
          [350, () => add("points")],
          [1300, () => { setStep(3); add("shift", "reveal"); }],
          [750, () => add("dress")],
          [600, () => add("stamp")],
          [2900, () => add("out")],
          [650, () => {}],
        ];
        for (const [ms, action] of timeline) {
          await sleep(ms);
          if (cancelled) return;
          action();
        }
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer.disconnect();
      wake?.();
    };
  }, [stageRef]);

  return { scene: SCENES[person]!, phases, step };
}

export function PhotoSteps() {
  const stageRef = useRef<HTMLDivElement>(null);
  const { scene, phases, step } = useSnapLoop(stageRef);

  return (
    <section className="snap crumple" id="photo-fonction" aria-labelledby="snap-title">
      <div>
        <h2 className="display" id="snap-title">
          Quelques photos suffisent.
        </h2>
        <p className="snap-lead">
          Votre client se prend en photo de face et de profil, puis indique sa taille. Le widget en déduit ses mensurations, puis conseille
          la taille pour l&apos;article qu&apos;il regarde.
        </p>
        <ol className="snap-steps">
          {STEPS.map((text, i) => (
            <li key={text} className={step === ALL_STEPS || step === i + 1 ? "on" : undefined}>
              {text}
            </li>
          ))}
        </ol>
      </div>
      <div ref={stageRef} className={["snap-stage", ...phases].join(" ")} aria-hidden="true">
        <div className="snap-body">
          <svg viewBox="0 92 300 534" dangerouslySetInnerHTML={{ __html: scene.figure }} />
        </div>
        <figure className="snap-card" style={{ margin: 0 }}>
          <div className="snap-photo">
            <svg viewBox="0 60 300 580" dangerouslySetInnerHTML={{ __html: scene.photo }} />
            <div className="snap-corners">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="snap-scan" />
            <div className="snap-flashfx" />
          </div>
          <figcaption className="snap-cap">
            {scene.name}, {scene.h} cm
          </figcaption>
        </figure>
        <div className="snap-height">
          Taille saisie : {scene.h} cm<span>{scene.w} kg</span>
        </div>
        <div className="snap-stamp">
          <strong>Taille {scene.size}</strong>
          <span>
            {scene.articleName}, {scene.score} % de correspondance
          </span>
        </div>
      </div>
    </section>
  );
}
