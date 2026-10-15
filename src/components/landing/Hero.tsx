import { estimateBody } from "@/lib/recommendation";
import { body, garment, geo, recommend, sizeDims } from "./figures";

// Mannequin du haut de page : silhouette moyenne habillée dans les tailles que donne le moteur.
const model = { h: 174, w: 66, ...estimateBody(174, 66) };
const g = geo(model, 150);

const FIGURE =
  body(g) +
  garment("jean", g, sizeDims("jean", recommend("jean", model, "normale").index, model)) +
  garment("tee", g, sizeDims("tee", recommend("tee", model, "normale").index, model));

// Pull trop grand de la vignette « Taille L : trop ample aux épaules » (veste sans boutons ni revers).
const CARD = garment("veste", geo(model, 150), sizeDims("tee", 3, model), "url(#knitCoral)")
  .replace(/<circle[^>]*fill="#2a1a10"\/>/g, "")
  .replace(/<path d="M[^"]*" stroke="rgba\(0,0,0,.35\)"[^>]*\/>/, "");

export function Hero() {
  return (
    <section className="hero crumple" aria-labelledby="hero-title">
      <h1 id="hero-title">
        <span className="hw hw--top">La bonne</span>
        <span className="hw hw--bottom">taille.</span>
      </h1>

      <div className="hero-figure" aria-hidden="true">
        <svg viewBox="0 92 300 534" dangerouslySetInnerHTML={{ __html: FIGURE }} />
      </div>

      <div className="intro">
        <p>
          SwiftStyle ajoute à vos fiches produit un widget qui conseille la bonne taille, à partir d&apos;une photo ou de quelques mesures.
          Vos clients commandent juste, et le colis ne revient pas.
        </p>
        <div className="actions">
          <a className="btn btn--ink" href="#demo">
            Tester le widget
          </a>
          <a className="btn btn--ghost" href="#contact">
            Demander un essai
          </a>
        </div>
      </div>

      <div className="chip chip--size" aria-hidden="true">
        <strong>Taille M conseillée</strong>
        <span>94 % de correspondance</span>
      </div>
      <div className="chip chip--slider" aria-hidden="true">
        <div className="row">
          <span>Taille</span>
          <span>174 cm</span>
        </div>
        <div className="track" />
      </div>
      <div className="chip chip--photo" aria-hidden="true">
        <svg viewBox="0 0 34 34">
          <rect x="2" y="8" width="30" height="21" rx="4" fill="#7BA05B" stroke="#0E0E0E" strokeWidth="2" />
          <circle cx="17" cy="18.5" r="6" fill="#E8F06A" stroke="#0E0E0E" strokeWidth="2" />
          <path d="M11 8l2-4h8l2 4" fill="none" stroke="#0E0E0E" strokeWidth="2" />
        </svg>
        <div>
          <strong>Photo analysée</strong>
          <span>en 8 secondes</span>
        </div>
      </div>
      <div className="collage" aria-hidden="true">
        <svg viewBox="40 140 220 270" dangerouslySetInnerHTML={{ __html: CARD }} />
        <p>Taille L : trop ample aux épaules</p>
      </div>
    </section>
  );
}
