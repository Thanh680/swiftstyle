import { asset } from "@/lib/asset";

export function SiteHeader() {
  return (
    <header className="nav">
      <a className="logo" href="#top" aria-label="SwiftStyle, accueil">
        <img src={asset("/logo-swiftstyle.webp")} alt="" width={285} height={173} />
      </a>
      <a className="btn btn--ink" href="#contact">
        Demander un essai
      </a>
    </header>
  );
}
