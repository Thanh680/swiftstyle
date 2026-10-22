import { HeroDemo } from "./HeroDemo";

export function Hero() {
  return (
    <section className="hero crumple" aria-labelledby="hero-title">
      {/* Le logo « Swift / Style » (h1) est dans HeroDemo : il n'apparaît qu'au clic sur le bouton. */}
      <HeroDemo />
      {/* La démo animée est décorative : ce texte dit aux lecteurs d'écran ce qu'elle montre. */}
      <p className="sr">
        SwiftStyle ajoute à vos fiches produit un widget qui conseille la bonne taille, à partir d&apos;une photo ou de quelques mesures. Vos
        clients commandent juste, et le colis ne revient pas.
      </p>
    </section>
  );
}
