import { trucks } from "./figures";

const TRUCKS = trucks();

export function ReturnsBanner() {
  return (
    <section className="returns" id="retours" aria-labelledby="returns-title">
      <div className="returns-inner">
        <h2 className="display" id="returns-title">
          Réduisez les retours produits.
        </h2>
        <p>
          Dans la mode en ligne, la taille est l&apos;une des premières raisons de retour. Chaque colis renvoyé coûte un transport, un
          contrôle, puis souvent une revente à prix réduit. Une taille juste dès la commande, c&apos;est un colis qui reste chez votre
          client.
        </p>
      </div>
      <div className="road" aria-hidden="true">
        <div className="road-track" dangerouslySetInnerHTML={{ __html: TRUCKS }} />
        <div className="asphalt" />
      </div>
    </section>
  );
}
