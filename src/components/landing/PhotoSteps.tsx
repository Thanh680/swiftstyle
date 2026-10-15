"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { DEMO_ARTICLES, estimateBody, type DemoArticle } from "@/lib/recommendation";
import { body, garment, geo, personSVG, pointsSVG, recommend, sizeDims, type Look } from "./figures";

// Pour afficher une vraie photo (de face, de la tête aux pieds), renseigner `img` avec son URL.
const PEOPLE: { name: string; h: number; w: number; article: DemoArticle; img: string | null; look: Look }[] = [
  { name: "Léa", h: 166, w: 57, article: "tee", img: null, look: { skin: "#E3B591", hair: "#3B2A20", style: "long", top: "#F1ECE2", pants: "#2F3A4A", shoes: "#1B1B1B" } },
  { name: "Karim", h: 181, w: 82, article: "veste", img: null, look: { skin: "#A8714E", hair: "#17120F", style: "short", top: "#5B6B78", pants: "#CBB998", shoes: "#3A2A20" } },
  { name: "Inès", h: 172, w: 66, article: "jean", img: null, look: { skin: "#6E4A35", hair: "#1C1410", style: "puff", top: "#E9D8C2", pants: "#8B6A94", shoes: "#F4F1EA" } },
];

const SCENES = PEOPLE.map((p) => {
  const m = { h: p.h, w: p.w, ...estimateBody(p.h, p.w) };
  const photo = p.img ? `<image href="${p.img}" x="0" y="60" width="300" height="580" preserveAspectRatio="xMidYMid slice"/>` : personSVG(m, p.look);
  const r = recommend(p.article, m, "normale");
  const g = geo(m, 150);
  return {
    ...p,
    photo: photo + pointsSVG(m),
    figure: body(g) + `<g class="snap-garment">${garment(p.article, g, sizeDims(p.article, r.index, m))}</g>`,
    size: r.size,
    score: Math.round(r.confidence * 100),
    articleName: DEMO_ARTICLES[p.article].name,
  };
});

const STEPS = [
  "Le client prend une photo de face, de la tête aux pieds.",
  "Le widget repère les épaules, la poitrine, la taille et les hanches.",
  "Il conseille la bonne taille pour l'article affiché.",
];
const ALL_STEPS = STEPS.length + 1;
const FINAL = ["in", "points", "shift", "reveal", "dress", "stamp"];

/**
 * Boucle de trois essayages : photo, repérage des mesures, habillage du mannequin.
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
          Une photo suffit.
        </h2>
        <p className="snap-lead">
          Votre client se prend en photo de face et indique sa taille. Le widget en déduit ses mensurations, puis conseille la taille pour
          l&apos;article qu&apos;il regarde.
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
