import { DEMO_ARTICLES, recommendSize, type Body, type DemoArticle, type FitPreference } from "@/lib/recommendation";

/**
 * Dessins de la page d'accueil : mannequin en papier journal, vêtements, règle,
 * camions, personnes de la section photo. Fonctions pures qui renvoient du SVG
 * en texte, rendues avec dangerouslySetInnerHTML. Reprises telles quelles du site v0.2.
 */

export interface Measures {
  h: number;
  w: number;
  chest: number;
  waist: number;
  hips: number;
}

type Point = [number, number];
type Part =
  | { t: "l"; a: Point; b: Point; w: number; fill?: string }
  | { t: "p"; d: string; fill?: string }
  | { t: "e"; cx: number; cy: number; rx: number; ry: number; fill?: string }
  | { t: "c"; cx: number; cy: number; r: number; fill?: string };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const f1 = (n: number) => n.toFixed(1);
const PPC = 520 / 175;
const BASE = 620;
const FONT = 'style="font-family:var(--text)"';

/* ---------- Motifs partagés : papier journal, tissus, ombre « collée » ---------- */

function newsColumns() {
  const fake =
    "La maison présente cette saison une collection pensée pour durer. Les ateliers ont revu chaque patron, du col aux ourlets, afin que chaque pièce tombe juste. Dans les boutiques, les vendeuses notent que les clientes reviennent moins souvent échanger leurs achats. La coupe droite domine les défilés, portée par des matières plus lourdes et des teintes de terre. Les créateurs parlent de silhouettes calmes, loin des excès des saisons passées. Le lin revient, le coton se fait plus dense, et la laine bouillie habille les vestes courtes.";
  const lines: string[] = [];
  let cur = "";
  for (const w of fake.split(" ")) {
    if ((cur + " " + w).length > 30) {
      lines.push(cur.trim());
      cur = w;
    } else cur += " " + w;
  }
  lines.push(cur.trim());
  let li = 0;
  const next = () => lines[li++ % lines.length];
  let col1 = "";
  let col2 = "";
  for (let y = 30; y < 146; y += 6.2) col1 += `<text x="6" y="${f1(y)}" textLength="60" lengthAdjust="spacingAndGlyphs">${next()}</text>`;
  for (let y = 74; y < 146; y += 6.2) col2 += `<text x="74" y="${f1(y)}" textLength="60" lengthAdjust="spacingAndGlyphs">${next()}</text>`;
  return col1 + col2;
}

const knit = (id: string, base: string) =>
  `<pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="${base}"/><circle cx="2.5" cy="2.5" r=".9" fill="rgba(0,0,0,.09)"/></pattern>`;

export const SVG_DEFS = `
  <pattern id="ht" width="2.6" height="2.6" patternUnits="userSpaceOnUse"><rect width="2.6" height="2.6" fill="#D6D3C8"/><circle cx="1.3" cy="1.3" r=".8" fill="#3a3a3a"/></pattern>
  <pattern id="news" width="140" height="150" patternUnits="userSpaceOnUse" patternTransform="rotate(-4)">
    <rect width="140" height="150" fill="#F2F0E7"/>
    <text x="6" y="15" font-family="Georgia,serif" font-weight="700" font-size="12" fill="#1c1c1c" textLength="128" lengthAdjust="spacingAndGlyphs">Le Courrier de la Mode</text>
    <line x1="6" y1="20" x2="134" y2="20" stroke="#1c1c1c" stroke-width=".7"/>
    <rect x="74" y="25" width="60" height="40" fill="url(#ht)"/>
    <ellipse cx="104" cy="52" rx="12" ry="16" fill="rgba(20,20,20,.35)"/>
    <g font-family="Georgia,serif" font-size="4.6" fill="#2b2b2b">${newsColumns()}</g>
  </pattern>
  <pattern id="denim" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="6" height="6" fill="#4F6F95"/><rect width="2" height="6" fill="#6283A8"/></pattern>
  <pattern id="wool" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#B5613E"/><path d="M0 7h14M7 0v14" stroke="rgba(255,255,255,.14)" stroke-width="2"/></pattern>
  ${knit("knitLime", "#E3EB66")}${knit("knitCoral", "#FF6B4A")}
  <filter id="cut" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="3" dy="5" stdDeviation=".2" flood-color="#000" flood-opacity=".22"/></filter>
  <linearGradient id="snapWall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E2DCCF"/><stop offset="1" stop-color="#C9C1B0"/></linearGradient>
  <linearGradient id="snapLight" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".16"/></linearGradient>
  <radialGradient id="snapVignette" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient>
  <filter id="snapGrain" x="0" y="0" width="100%" height="100%"><feGaussianBlur stdDeviation=".6" result="b"/><feTurbulence type="fractalNoise" baseFrequency=".95" numOctaves="2" seed="3" result="n"/><feColorMatrix in="n" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .28 0" result="g"/><feMerge><feMergeNode in="b"/><feMergeNode in="g"/></feMerge></filter>`;

/* ---------- Papier froissé en facettes (motif raccordable, graine fixe) ---------- */

export function crumpleBackground(): string {
  let a = 20261014;
  const rnd = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const S = 640;
  const N = 5;
  const c = S / N;
  const J = c * 0.38;
  const jit: Point[][] = [];
  for (let i = 0; i < N; i++) {
    jit[i] = [];
    for (let j = 0; j < N; j++) jit[i]![j] = [(rnd() * 2 - 1) * J, (rnd() * 2 - 1) * J];
  }
  const tris: { t: Point[]; v: number }[] = [];
  // Facettes dessinées aussi sur une couronne autour de la tuile pour un raccord sans couture
  for (let i = -1; i <= N; i++)
    for (let j = -1; j <= N; j++) {
      const ii = (i + N) % N;
      const jj = (j + N) % N;
      const q = ([[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]] as Point[]).map(([x, y]): Point => {
        const d = jit[(x + N) % N]![(y + N) % N]!;
        return [x * c + d[0], y * c + d[1]];
      }) as [Point, Point, Point, Point];
      const diag = (ii * 7 + jj * 13) % 2 === 0;
      const pair = diag
        ? [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]
        : [[q[0], q[1], q[3]], [q[1], q[2], q[3]]];
      pair.forEach((t, k) => tris.push({ t, v: Math.sin((ii * 12.9898 + jj * 78.233 + k * 37.719) * 43.7585) }));
    }
  const fill = (v: number) => (v > 0 ? `rgba(255,255,255,${(v * 0.42).toFixed(3)})` : `rgba(0,0,0,${(-v * 0.055).toFixed(3)})`);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">` +
    tris
      .map(({ t, v }) => `<path d="M${t.map((p) => p.map((n) => n.toFixed(1)).join(",")).join("L")}Z" fill="${fill(v)}" stroke="rgba(0,0,0,.035)" stroke-width=".8"/>`)
      .join("") +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/* ---------- Géométrie du mannequin ---------- */

export function geo(m: Measures, cx: number) {
  const H = (520 * m.h) / 175;
  const top = BASE - H;
  const Y = (f: number) => top + f * H;
  const half = (c: number) => c * 0.16 * PPC;
  const chestH = half(m.chest);
  const waistH = half(m.waist);
  const hipH = half(m.hips);
  const bmi = m.w / (m.h / 100) ** 2;
  const ls = clamp(0.8 + (bmi - 22) * 0.03, 0.72, 1.35);
  const shoulderH = chestH * 1.1 + 7;
  const neckH = 8 * ls + 1.5;
  const armW = 13 * ls;
  const thighW = clamp(hipH * 0.72, 20, 58);
  const calfW = thighW * 0.56;
  const arm = (s: number) => ({
    S: [cx + s * (shoulderH - armW * 0.35), Y(0.18)] as Point,
    E: [cx + s * (chestH + armW * 0.55 + 5), Y(0.39)] as Point,
    W: [cx + s * (chestH + armW * 0.5 + 11), Y(0.555)] as Point,
  });
  const leg = (s: number) => ({
    Hj: [cx + s * hipH * 0.52, Y(0.535)] as Point,
    K: [cx + s * (hipH * 0.46 + 3), Y(0.75)] as Point,
    A: [cx + s * (hipH * 0.42 + 4), Y(0.955)] as Point,
    F: [cx + s * (hipH * 0.42 + 16), Y(0.988)] as Point,
  });
  return { H, top, Y, half, chestH, waistH, hipH, shoulderH, neckH, armW, thighW, calfW, cx, arm, leg };
}
type Geo = ReturnType<typeof geo>;

const lerp = (a: Point, b: Point, t: number): Point => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const L = (a: Point, b: Point, w: number): Part => ({ t: "l", a, b, w });

function smooth(p: Point[]): string {
  const n = p.length;
  const at = (i: number) => p[(i + n) % n]!;
  let d = `M${f1(p[0]![0])},${f1(p[0]![1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)},${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)},${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return d + "Z";
}

const poly = (p: Point[]) => "M" + p.map((q) => `${f1(q[0])},${f1(q[1])}`).join(" L") + "Z";

const mirror = (R: [number, number][], cx: number, Y: (f: number) => number) => ({
  right: R.map(([x, f]): Point => [cx + x, Y(f)]),
  left: R.slice()
    .reverse()
    .map(([x, f]): Point => [cx - x, Y(f)]),
});

function draw(parts: Part[], fill: string, border = 9, extra = ""): string {
  const shape = (p: Part, under: boolean) => {
    if (p.t === "l")
      return `<line x1="${f1(p.a[0])}" y1="${f1(p.a[1])}" x2="${f1(p.b[0])}" y2="${f1(p.b[1])}" stroke="${under ? "#fff" : p.fill || fill}" stroke-width="${f1(p.w + (under ? border : 0))}" stroke-linecap="round"/>`;
    const paint = under ? `fill="#fff" stroke="#fff" stroke-width="${border}" stroke-linejoin="round"` : `fill="${p.fill || fill}"`;
    if (p.t === "p") return `<path d="${p.d}" ${paint}/>`;
    if (p.t === "e") return `<ellipse cx="${f1(p.cx)}" cy="${f1(p.cy)}" rx="${f1(p.rx)}" ry="${f1(p.ry)}" ${paint}/>`;
    return `<circle cx="${f1(p.cx)}" cy="${f1(p.cy)}" r="${f1(p.r)}" ${paint}/>`;
  };
  return `<g filter="url(#cut)"><g>${parts.map((p) => shape(p, true)).join("")}</g><g>${parts.map((p) => shape(p, false)).join("")}</g>${extra}</g>`;
}

export function body(g: Geo): string {
  const { cx, Y } = g;
  const R: [number, number][] = [
    [g.neckH, 0.122],
    [g.shoulderH, 0.168],
    [g.chestH * 1.03, 0.225],
    [g.chestH, 0.29],
    [(g.chestH + g.waistH) / 2, 0.345],
    [g.waistH, 0.4],
    [(g.waistH + g.hipH) / 2 + 1, 0.455],
    [g.hipH, 0.505],
    [g.hipH * 0.94, 0.548],
  ];
  const { right, left } = mirror(R, cx, Y);
  const parts: Part[] = [];
  [-1, 1].forEach((s) => {
    const l = g.leg(s);
    parts.push(L(l.Hj, l.K, g.thighW), L(l.K, l.A, g.calfW), L(l.A, l.F, 9));
  });
  parts.push({ t: "p", d: smooth([...right, [cx, Y(0.565)], ...left]) });
  parts.push(L([cx, Y(0.095)], [cx, Y(0.14)], g.neckH * 2));
  parts.push({ t: "e", cx, cy: Y(0.066), rx: g.H * 0.046, ry: g.H * 0.063 });
  [-1, 1].forEach((s) => {
    const a = g.arm(s);
    parts.push(L(a.S, a.E, g.armW), L(a.E, a.W, g.armW * 0.82), { t: "c", cx: a.W[0], cy: a.W[1] + 4, r: g.armW * 0.5 });
  });
  return draw(parts, "url(#news)");
}

export function garment(art: DemoArticle, g: Geo, sz: Body, fillOverride?: string): string {
  const { cx, Y, half } = g;
  if (art === "jean") {
    const gw = half(sz.waist!) + 4;
    const gh = half(sz.hips!) + 5;
    const ax = g.leg(1).A[0] - cx;
    const hem = Math.min(g.calfW * 0.75 + 6, ax - 4);
    const R: [number, number][] = [
      [gw, 0.392],
      [gh + 1, 0.505],
      [ax + hem, 0.972],
      [ax - hem, 0.972],
    ];
    const { right, left } = mirror(R, cx, Y);
    const extra = `<path d="M${f1(cx - gw + 3)},${f1(Y(0.418))} L${f1(cx + gw - 3)},${f1(Y(0.418))} M${f1(cx)},${f1(Y(0.418))} L${f1(cx)},${f1(Y(0.5))}" stroke="rgba(255,255,255,.5)" stroke-width="1.6" stroke-dasharray="4 3" fill="none"/>
        <rect x="${f1(cx + gw - 30)}" y="${f1(Y(0.392) - 9)}" width="34" height="12" fill="rgba(232,240,106,.85)" transform="rotate(-18 ${f1(cx + gw - 13)} ${f1(Y(0.392) - 3)})"/>`;
    return draw([{ t: "p", d: poly([...right, [cx, Y(0.585)], ...left]) }], fillOverride || "url(#denim)", 8, extra);
  }
  const v = art === "veste";
  const gc = half(sz.chest!) + (v ? 8 : 5);
  const gw = Math.max(half(sz.waist!) + (v ? 8 : 6), gc * 0.9);
  const gs = gc * 1.1 + 7;
  const hemY = v ? 0.59 : 0.505;
  const R: [number, number][] = [
    [g.neckH + 6, 0.116],
    [gs + 2, 0.162],
    [gc + 3, 0.235],
    [gc + 2, 0.31],
    [gw, 0.43],
    [gw + (v ? 4 : 2), hemY],
  ];
  const { right, left } = mirror(R, cx, Y);
  const fill = fillOverride || (v ? "url(#wool)" : "url(#knitLime)");
  const parts: Part[] = [];
  const ease = Math.max(0, gc - g.chestH) * 0.45;
  [-1, 1].forEach((s) => {
    const a = g.arm(s);
    if (v) parts.push(L(a.S, a.E, g.armW + 12 + ease), L(a.E, lerp(a.E, a.W, 0.92), g.armW + 9 + ease));
    else parts.push(L(a.S, lerp(a.S, a.E, 0.42), g.armW + 15 + ease));
  });
  parts.push({ t: "p", d: poly([[cx, Y(v ? 0.2 : 0.145)], ...right, [cx, Y(hemY + 0.004)], ...left]) });
  let extra = `<rect x="${f1(cx - gs - 4)}" y="${f1(Y(0.162) - 10)}" width="36" height="12" fill="rgba(232,240,106,.85)" transform="rotate(-28 ${f1(cx - gs + 14)} ${f1(Y(0.162) - 4)})"/>`;
  if (v) {
    const n = g.neckH + 6;
    extra +=
      `<path d="M${f1(cx - n)},${f1(Y(0.116))} L${f1(cx - 2)},${f1(Y(0.34))} M${f1(cx + n)},${f1(Y(0.116))} L${f1(cx + 2)},${f1(Y(0.34))} M${f1(cx)},${f1(Y(0.34))} L${f1(cx)},${f1(Y(0.59))}" stroke="rgba(0,0,0,.35)" stroke-width="1.6" fill="none"/>` +
      [0.39, 0.45, 0.51].map((f) => `<circle cx="${f1(cx + 6)}" cy="${f1(Y(f))}" r="2.6" fill="#2a1a10"/>`).join("");
  }
  return draw(parts, fill, 8, extra);
}

export function ruler(h: number): string {
  const yAt = (c: number) => BASE - c * PPC;
  let s = `<g fill="currentColor" ${FONT} font-size="11"><line x1="44" y1="${BASE}" x2="44" y2="${f1(yAt(205))}" stroke="currentColor" stroke-width="1.5"/>`;
  for (let c = 0; c <= 200; c += 10) {
    const y = f1(yAt(c));
    const long = c % 50 === 0;
    s += `<line x1="${long ? 30 : 36}" y1="${y}" x2="44" y2="${y}" stroke="currentColor" stroke-width="1.2"/>`;
    if (long && c) s += `<text x="26" y="${f1(yAt(c) + 4)}" text-anchor="end">${c}</text>`;
  }
  const y = f1(yAt(h));
  s += `<line x1="44" y1="${y}" x2="300" y2="${y}" stroke="currentColor" stroke-width="1.2" stroke-dasharray="5 4"/>
      <rect x="50" y="${f1(yAt(h) - 22)}" width="64" height="18" rx="9" fill="#E8F06A" stroke="#0E0E0E" stroke-width="1.5"/>
      <text x="82" y="${f1(yAt(h) - 9)}" text-anchor="middle" fill="#0E0E0E" font-weight="700">${h} cm</text></g>`;
  return s;
}

/** Mensurations du milieu de la taille `i` du guide, pour dessiner le vêtement porté. */
export function sizeDims(art: DemoArticle, i: number, m: Measures): Body {
  const r = DEMO_ARTICLES[art].chart.ranges;
  const mid = (k: "chest" | "waist" | "hips") => {
    const range = r[k]?.[i];
    return range ? (range[0] + range[1]) / 2 : m[k];
  };
  return { chest: mid("chest"), waist: mid("waist"), hips: mid("hips") };
}

export const recommend = (art: DemoArticle, m: Measures, fit: FitPreference) => recommendSize(DEMO_ARTICLES[art].chart, m, fit);

/* ---------- Camions de la bannière « retours » ---------- */

const REASONS = ["Trop petit", "Trop grand", "Trop serré", "Trop long", "Mauvaise taille", "Trop ample"];
const CABS = ["#E8F06A", "#F8F9F3", "#FF6B4A"];

function truck(label: string, i: number): string {
  // Décalages et vitesses différents pour que les camions ne rebondissent pas en même temps
  const d = -(i * 0.17 + (i % 2) * 0.09);
  const t = 0.52 + (i % 3) * 0.08;
  const wheel = (x: number) =>
    `<g class="t-wheel"><circle cx="${x}" cy="118" r="19.5" fill="#fff"/><circle cx="${x}" cy="118" r="15" fill="#0E0E0E"/><circle cx="${x}" cy="118" r="5.5" fill="#9AA08F"/><rect x="${x - 1.5}" y="105" width="3" height="26" rx="1.5" fill="#9AA08F"/></g>`;
  return `<svg viewBox="0 0 280 150" style="--d:${d.toFixed(2)}s;--t:${t.toFixed(2)}s">
    <g>${[0, 1, 2].map((k) => `<circle class="t-puff" cx="280" cy="103" r="7" style="animation-delay:${(d - k * 0.4).toFixed(2)}s"/>`).join("")}</g>
    <g filter="url(#cut)">
    <g class="t-body">
      <g fill="#fff" stroke="#fff" stroke-width="9" stroke-linejoin="round">
        <rect x="80" y="14" width="188" height="96" rx="4"/><path d="M18,112 L18,64 Q20,50 34,46 L60,40 Q68,38 73,45 L84,60 L84,112 Z"/>
      </g>
      <rect x="266" y="99" width="14" height="6" rx="2" fill="#0E0E0E"/>
      <rect x="80" y="14" width="188" height="96" rx="4" fill="url(#news)"/>
      <path d="M18,112 L18,64 Q20,50 34,46 L60,40 Q68,38 73,45 L84,60 L84,112 Z" fill="${CABS[i % 3]}" stroke="#0E0E0E" stroke-width="2"/>
      <path d="M30,56 L58,49 Q63,48 66,53 L72,63 L30,63 Z" fill="#B9CBD3" stroke="#0E0E0E" stroke-width="2"/>
      <rect x="78" y="106" width="192" height="9" fill="#0E0E0E"/>
      <g transform="rotate(-7 174 62)"><rect x="${174 - label.length * 4.6}" y="46" width="${label.length * 9.2}" height="30" rx="3" fill="#FF6B4A" stroke="#0E0E0E" stroke-width="2"/>
      <text x="174" y="67" text-anchor="middle" ${FONT} font-weight="800" font-size="15" fill="#0E0E0E">${label}</text></g>
    </g>
      ${[52, 205, 240].map(wheel).join("")}
    </g></svg>`;
}

/** Deux rangées identiques pour un défilement en boucle sans à-coup. */
export function trucks(): string {
  const row = REASONS.map(truck).join("");
  return row + row;
}

/* ---------- Section photo : personnes « photographiées » ---------- */

export interface Look {
  skin: string;
  hair: string;
  style: "long" | "short" | "puff";
  top: string;
  pants: string;
  shoes: string;
}

const ln = (a: Point, b: Point, w: number, c: string) =>
  `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${c}" stroke-width="${f1(w)}" stroke-linecap="round"/>`;

export function personSVG(m: Measures, look: Look): string {
  const g = geo(m, 150);
  const { cx, Y } = g;
  const hy = Y(0.066);
  const rx = g.H * 0.046;
  const ry = g.H * 0.063;
  let s = `<rect x="0" y="60" width="300" height="580" fill="url(#snapWall)"/>
        <rect x="0" y="${f1(Y(0.93))}" width="300" height="200" fill="#B9AF9C"/>
        <ellipse cx="${cx}" cy="${f1(Y(0.995))}" rx="${f1(g.hipH * 1.4)}" ry="9" fill="rgba(0,0,0,.22)"/>`;
  if (look.style === "long") s += `<rect x="${f1(cx - rx * 1.18)}" y="${f1(hy - ry * 0.4)}" width="${f1(rx * 2.36)}" height="${f1(ry * 2.5)}" rx="${f1(rx)}" fill="${look.hair}"/>`;
  if (look.style === "puff") s += `<circle cx="${cx}" cy="${f1(hy - ry * 0.7)}" r="${f1(rx * 1.15)}" fill="${look.hair}"/>`;
  [-1, 1].forEach((k) => {
    const l = g.leg(k);
    s += ln(l.Hj, l.K, g.thighW + 3, look.pants) + ln(l.K, l.A, g.calfW + 5, look.pants) + ln(l.A, l.F, 12, look.shoes);
  });
  const hp = mirror(
    [
      [g.waistH, 0.4],
      [g.hipH, 0.505],
      [g.hipH * 0.94, 0.55],
    ],
    cx,
    Y,
  );
  s += `<path d="${poly([...hp.right, [cx, Y(0.57)], ...hp.left])}" fill="${look.pants}"/>`;
  [-1, 1].forEach((k) => {
    const a = g.arm(k);
    const mid = lerp(a.S, a.E, 0.45);
    s += ln(mid, a.E, g.armW, look.skin) + ln(a.E, a.W, g.armW * 0.82, look.skin) + `<circle cx="${f1(a.W[0])}" cy="${f1(a.W[1] + 4)}" r="${f1(g.armW * 0.5)}" fill="${look.skin}"/>`;
  });
  const tp = mirror(
    [
      [g.neckH + 2, 0.124],
      [g.shoulderH + 2, 0.168],
      [g.chestH * 1.04 + 2, 0.225],
      [g.chestH + 2, 0.29],
      [(g.chestH + g.waistH) / 2 + 3, 0.345],
      [g.waistH + 4, 0.4],
      [g.waistH + 5, 0.47],
    ],
    cx,
    Y,
  );
  s += ln([cx, Y(0.095)], [cx, Y(0.14)], g.neckH * 2, look.skin);
  [-1, 1].forEach((k) => {
    const a = g.arm(k);
    s += ln(a.S, lerp(a.S, a.E, 0.45), g.armW + 5, look.top);
  });
  s += `<path d="${smooth([...tp.right, [cx, Y(0.475)], ...tp.left])}" fill="${look.top}"/>`;
  s += `<ellipse cx="${cx}" cy="${f1(hy)}" rx="${f1(rx)}" ry="${f1(ry)}" fill="${look.skin}"/>`;
  s += `<path d="M${f1(cx - rx * 1.04)},${f1(hy - ry * 0.05)} A${f1(rx * 1.04)},${f1(ry * 1.04)} 0 0 1 ${f1(cx + rx * 1.04)},${f1(hy - ry * 0.05)} Q${f1(cx)},${f1(hy - ry * 0.55)} ${f1(cx - rx * 1.04)},${f1(hy - ry * 0.05)}Z" fill="${look.hair}"/>`;
  return `<g filter="url(#snapGrain)">${s}<rect x="0" y="60" width="300" height="580" fill="url(#snapLight)"/><rect x="0" y="60" width="300" height="580" fill="url(#snapVignette)"/></g>`;
}

export function pointsSVG(m: Measures): string {
  const g = geo(m, 150);
  const { cx, Y } = g;
  const dot = (x: number, y: number) => `<circle cx="${f1(x)}" cy="${f1(y)}" r="5" fill="#E8F06A" stroke="#0E0E0E" stroke-width="2"/>`;
  const row = (i: number, w: number, y: number, label: string) =>
    `<g class="pt" style="--i:${i}"><line x1="${f1(cx - w - 4)}" y1="${f1(y)}" x2="${f1(cx + w + 4)}" y2="${f1(y)}" stroke="#E8F06A" stroke-width="2.5" stroke-dasharray="6 4"/>${dot(cx - w, y)}${dot(cx + w, y)}
        <rect x="${f1(cx + w + 10)}" y="${f1(y - 11)}" width="${label.length * 7.6 + 14}" height="22" rx="11" fill="#0E0E0E"/><text x="${f1(cx + w + 17)}" y="${f1(y + 5)}" ${FONT} font-size="13" font-weight="700" fill="#E8F06A">${label}</text></g>`;
  const top = Y(0);
  const foot = Y(0.99);
  return (
    `<g class="pt" style="--i:0"><line x1="26" y1="${f1(top)}" x2="26" y2="${f1(foot)}" stroke="#E8F06A" stroke-width="2.5"/><line x1="18" y1="${f1(top)}" x2="34" y2="${f1(top)}" stroke="#E8F06A" stroke-width="2.5"/><line x1="18" y1="${f1(foot)}" x2="34" y2="${f1(foot)}" stroke="#E8F06A" stroke-width="2.5"/></g>
        <g class="pt" style="--i:1">${dot(cx - g.shoulderH, Y(0.168))}${dot(cx + g.shoulderH, Y(0.168))}</g>` +
    row(2, g.chestH, Y(0.29), `Poitrine ${m.chest}`) +
    row(3, g.waistH, Y(0.4), `Taille ${m.waist}`) +
    row(4, g.hipH, Y(0.505), `Hanches ${m.hips}`)
  );
}
