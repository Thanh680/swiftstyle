"use client";

import { useEffect, useRef, type CSSProperties, type RefObject } from "react";

interface Stat {
  value: string;
  text: string;
  source: string;
  color: string;
  string: string;
  /** Position et longueur du fil : x, longueur bureau, longueur mobile, inclinaison. */
  hang: [string, string, string, string];
  long?: boolean;
}

const STATS: Stat[] = [
  { value: "24,4 %", text: "des vêtements achetés en ligne sont renvoyés.", source: "Coresight Research, 2023, États-Unis", color: "lime", string: "black", hang: ["9%", "90px", "28px", "-2deg"] },
  { value: "70 %", text: "des retours mode viennent d'une coupe ou d'un style qui ne va pas.", source: "McKinsey, 2021", color: "kraft", string: "twine", hang: ["25.5%", "250px", "60px", "2deg"] },
  { value: "53 %", text: "des marques de mode citent la taille comme première cause de retour.", source: "Coresight Research, 2023, États-Unis", color: "card", string: "red", hang: ["42%", "140px", "34px", "-1deg"] },
  { value: "66 %", text: "du prix d'un vêtement peut partir dans le traitement de son retour.", source: "Estimation Optoro, citée par Coresight Research", color: "coral", string: "black", hang: ["58.5%", "300px", "64px", "1.5deg"] },
  { value: "62 %", text: "des acheteurs mode en ligne commandent plusieurs tailles ou couleurs, ou l'envisagent, pour en renvoyer une partie.", source: "fulfilmentcrowd, 2025, Royaume-Uni", color: "mint", string: "green", hang: ["75%", "60px", "30px", "-2.5deg"] },
  { value: "849,9 Md$", text: "de marchandises retournées par les consommateurs américains en 2025.", source: "NRF et Happy Returns, 2025", color: "news", string: "twine", hang: ["91%", "210px", "58px", "2deg"], long: true },
];

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Les étiquettes tombent au premier passage, puis se balancent selon la vitesse du scroll. */
function useHangingTags(rackRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const rack = rackRef.current;
    if (!rack || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const mobile = matchMedia("(max-width:760px)");

    const items = [...rack.querySelectorAll<HTMLElement>(".hang")].map((el, i) => ({
      el,
      string: el.querySelector<HTMLElement>(".string")!,
      wrap: el.querySelector<HTMLElement>(".tag-wrap")!,
      tag: el.querySelector<HTMLElement>(".tag")!,
      th: 0,
      w: 0,
      y: 0,
      vy: 0,
      dir: i % 2 ? 1 : -1,
      m: 0.75 + ((i * 37) % 10) / 20,
      delay: i * 60,
      active: false,
    }));
    type Item = (typeof items)[number];
    const lenOf = (it: Item) => parseFloat(getComputedStyle(it.string).height) || 80;
    const paint = (it: Item) => {
      const L = lenOf(it);
      const base = mobile.matches ? "" : "translateX(-50%) ";
      it.el.style.transform = `${base}rotate(${it.th.toFixed(4)}rad)`;
      it.string.style.transform = `scaleY(${Math.max(0.08, (L + it.y) / L).toFixed(4)})`;
      it.wrap.style.transform = `translateY(${it.y.toFixed(2)}px)`;
    };

    const listeners = new AbortController();
    const signal = listeners.signal;
    items.forEach((it) => {
      // Coup de main : on attrape l'étiquette (clic maintenu) et on la pousse en bougeant.
      // Le simple survol ne la fait pas bouger.
      it.tag.addEventListener("pointermove", (e) => {
        if (it.tag.hasPointerCapture(e.pointerId)) it.w -= (clamp(e.movementX, -30, 30) * 0.0016) / it.m;
      }, { signal });
      it.tag.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        // Capture : on garde la main même si le pointeur sort de l'étiquette
        it.tag.setPointerCapture(e.pointerId);
        it.w += it.dir * 0.05;
        it.vy += 4;
      }, { signal });
    });
    mobile.addEventListener("change", () => items.forEach(paint), { signal });

    // Les étiquettes attendent hors de l'écran, remontées contre le rail : elles ne
    // sont jamais vues immobiles avant leur chute.
    items.forEach((it) => {
      it.y = -lenOf(it) * 0.9;
      it.vy = 0;
      it.w = it.dir * 0.012;
      paint(it);
    });

    let running = false;
    let dropped = false;
    let lastY = scrollY;
    let lastV = 0;
    let lastT = 0;
    let startT = 0;
    let raf = 0;

    const frame = (t: number) => {
      if (!running) return;
      const dt = Math.min(2, (t - (lastT || t)) / 16.67 || 1);
      lastT = t;
      const y = scrollY;
      const v = (y - lastY) / dt;
      const a = v - lastV;
      lastY = y;
      lastV = v;
      items.forEach((it) => {
        if (!it.active) {
          if (t - startT >= it.delay) it.active = true;
          else {
            paint(it);
            return;
          }
        }
        const L = lenOf(it) + 150;
        const s = 2.4 / L;
        it.w += (-s * Math.sin(it.th) - 0.075 * it.w + it.dir * it.m * (a * 0.0011 + v * 0.00005)) * dt;
        it.th = clamp(it.th + it.w * dt, -0.7, 0.7);
        it.vy += (-0.09 * it.y - 0.24 * it.vy + a * 0.3 * it.m) * dt;
        it.y = clamp(it.y + it.vy * dt, -lenOf(it) * 0.92, 70);
        paint(it);
      });
      raf = requestAnimationFrame(frame);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !running) {
          running = true;
          lastT = 0;
          lastY = scrollY;
          lastV = 0;
          startT = performance.now();
          // Première apparition : les étiquettes tombent l'une après l'autre et rebondissent au
          // bout de leur fil. Ensuite, elles reprennent leur balancement là où elles l'ont laissé.
          if (dropped) items.forEach((it) => (it.active = true));
          dropped = true;
          raf = requestAnimationFrame(frame);
        } else if (!entry?.isIntersecting) running = false;
      },
      // La chute commence un peu avant que le rail n'entre à l'écran : quand il apparaît,
      // les étiquettes tombent déjà.
      { threshold: 0, rootMargin: "0px 0px 150px 0px" },
    );
    observer.observe(rack);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      listeners.abort();
      items.forEach((it) => {
        it.el.style.transform = "";
        it.string.style.transform = "";
        it.wrap.style.transform = "";
      });
    };
  }, [rackRef]);
}

export function ReturnCosts() {
  const rackRef = useRef<HTMLDivElement>(null);
  useHangingTags(rackRef);

  return (
    <section className="costs crumple" id="chiffres" aria-labelledby="costs-title">
      <div className="costs-head">
        <h2 className="display" id="costs-title">
          Ce que coûtent les retours.
        </h2>
        <p>
          Chiffres publiés par des cabinets d&apos;études et des fédérations du commerce. La plupart portent sur les États-Unis et le
          Royaume-Uni, où les données sont les plus détaillées.
        </p>
      </div>
      <div className="rack" ref={rackRef}>
        <div className="rail" aria-hidden="true" />
        {STATS.map((s) => {
          const [x, len, lenMobile, r] = s.hang;
          return (
            <div key={s.value} className="hang" style={{ "--x": x, "--len": len, "--len-m": lenMobile, "--r": r } as CSSProperties}>
              <div className={`string string--${s.string}`} />
              <div className="tag-wrap">
                <div className={`tag tag--${s.color}`}>
                  <span className={s.long ? "tag-num tag-num--long" : "tag-num"}>{s.value}</span>
                  <p>{s.text}</p>
                  <small>{s.source}</small>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
