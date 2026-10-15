export function SiteHeader() {
  return (
    <header className="nav">
      <a className="logo" href="#top" aria-label="SwiftStyle, accueil">
        <svg viewBox="0 0 30 30" aria-hidden="true">
          <rect x="1" y="7" width="28" height="16" rx="3" fill="#7BA05B" stroke="currentColor" strokeWidth="2" />
          <path d="M7 7v6M12 7v4M17 7v6M22 7v4" stroke="currentColor" strokeWidth="2" />
        </svg>
        SwiftStyle
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
