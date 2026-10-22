export function SiteHeader() {
  return (
    <header className="nav">
      <a className="logo" href="#top" aria-label="SwiftStyle, accueil">
        <img src="/logo-swiftstyle.webp" alt="" width={285} height={173} />
      </a>
      <nav aria-label="Navigation principale">
        <ul>
          <li>
            <a href="#retours">Le problème</a>
          </li>
          <li>
            <a href="#demo">Démo</a>
          </li>
          <li>
            <a href="#contact">Contact</a>
          </li>
        </ul>
      </nav>
      <a className="btn btn--ink" href="#contact">
        Demander un essai
      </a>
    </header>
  );
}
