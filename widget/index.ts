import type { Theme } from "../src/lib/recommendation/types";
import { isMessage, MESSAGE_SOURCE, type EventType, type HostMessage } from "../src/lib/widget-protocol";
import { BUTTON_CSS, MODAL_CSS } from "./styles";
import { findProductForm, listSizes, selectSize } from "./size-select";

/**
 * Script du widget, collé par les marchands sur leurs fiches produit. C'est le
 * « loader » de ARCHITECTURE-TECHNIQUE.md § 4.2. Pas de React ici : il doit peser
 * quelques ko et ne rien casser chez le marchand. Compilé dans public/v1/widget.js
 * par `npm run widget:build`. Ses responsabilités, et rien d'autre :
 *   1. lire la configuration (data-shop-key, data-product-id) ;
 *   2. localiser le point d'insertion ;
 *   3. enregistrer le Custom Element du bouton ;
 *   4. au clic, créer l'iframe et ouvrir la modale.
 * Aucune dépendance, aucun secret. L'origine de l'application est celle du script lui-même.
 */

const script = document.currentScript as HTMLScriptElement | null;
const APP = script ? new URL(script.src).origin : location.origin;
const SCRIPT_KEY = script?.dataset.shopKey ?? null;

interface Config {
  theme: Theme;
  product: { id: string; enabled: boolean } | null;
}

const configs = new Map<string, Promise<Config | null>>();

function loadConfig(shopKey: string, productId: string): Promise<Config | null> {
  const key = `${shopKey}|${productId}`;
  let p = configs.get(key);
  if (!p) {
    const url = `${APP}/api/v1/config?shopKey=${encodeURIComponent(shopKey)}&productId=${encodeURIComponent(productId)}`;
    p = fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<Config>) : null))
      .catch(() => null);
    configs.set(key, p);
  }
  return p;
}

function sendEvent(shopKey: string, type: EventType, productId: string, recommendationId: string | null = null) {
  // text/plain : pas de requête preflight depuis la page du marchand.
  const body = new Blob([JSON.stringify({ shopKey, type, productId, recommendationId })], { type: "text/plain" });
  try {
    navigator.sendBeacon(`${APP}/api/v1/events`, body);
  } catch {
    // la télémétrie ne doit jamais casser la page
  }
}

function themeStyle(theme: Theme): string {
  const vars: [string, string | undefined][] = [
    ["--ss-accent", theme.accent],
    ["--ss-bg", theme.bg],
    ["--ss-text", theme.text],
    ["--ss-radius", theme.radius],
    ["--ss-border", theme.border],
  ];
  return vars
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

class SwiftStyleButton extends HTMLElement {
  private hint: HTMLParagraphElement | null = null;
  private theme: Theme = {};
  private changes = 0;

  get shopKey(): string | null {
    return this.dataset.shopKey ?? this.closest<HTMLElement>("[data-shop-key]")?.dataset.shopKey ?? SCRIPT_KEY;
  }

  get productId(): string | null {
    return this.dataset.productId ?? this.closest<HTMLElement>("[data-product-id]")?.dataset.productId ?? null;
  }

  connectedCallback() {
    if (this.shadowRoot) return;
    const shopKey = this.shopKey;
    const productId = this.productId;
    this.hidden = true;
    if (!shopKey || !productId) return;

    const root = this.attachShadow({ mode: "open" });
    root.innerHTML =
      `<style>${BUTTON_CSS}</style>` +
      `<button type="button" part="button">` +
      `<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M2 7h16v6H2zM6 7v3M10 7v3M14 7v3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>` +
      `<span>Trouver ma taille</span></button>` +
      `<p part="hint" aria-live="polite"></p>`;
    this.hint = root.querySelector("p");
    root.querySelector("button")!.addEventListener("click", () => this.open(shopKey, productId));

    // Le bouton n'apparaît que si la boutique autorise ce domaine et que le produit a un guide des tailles.
    loadConfig(shopKey, productId).then((config) => {
      if (!config?.product?.enabled) return;
      this.theme = config.theme ?? {};
      this.setAttribute("style", themeStyle(this.theme));
      this.hidden = false;
      this.watchHesitation();
    });
  }

  /** Fonction core n° 1 : se signaler quand l'utilisateur change plusieurs fois de taille. */
  private watchHesitation() {
    const scope = findProductForm() ?? document;
    scope.addEventListener("change", (e) => {
      const t = e.target as Element | null;
      if (!t || selecting || !t.matches("select, input[type=radio]")) return;
      this.changes += 1;
      if (this.changes >= 2 && !this.hasAttribute("hesitating")) {
        this.setAttribute("hesitating", "");
        this.say("Vous hésitez entre deux tailles ? SwiftStyle vous conseille.");
      }
    });
  }

  say(text: string) {
    if (this.hint) this.hint.textContent = text;
  }

  private open(shopKey: string, productId: string) {
    this.removeAttribute("hesitating");
    // Compté ici, au clic, et non au chargement de l'iframe : un rechargement ne fausse pas l'entonnoir.
    if (openModal(this, shopKey, productId, this.theme)) sendEvent(shopKey, "widget_opened", productId);
  }
}

let selecting = false;
let modalOpen = false;

function openModal(button: SwiftStyleButton, shopKey: string, productId: string, theme: Theme): boolean {
  if (modalOpen) return false;
  modalOpen = true;

  const host = document.createElement("div");
  host.setAttribute("data-swiftstyle-modal", "");
  host.setAttribute("style", themeStyle(theme));
  const root = host.attachShadow({ mode: "open" });
  const src = `${APP}/embed?shopKey=${encodeURIComponent(shopKey)}&productId=${encodeURIComponent(productId)}`;
  root.innerHTML =
    `<style>${MODAL_CSS}</style><div class="backdrop"></div>` +
    `<div class="dialog" role="dialog" aria-modal="true" aria-label="Trouver ma taille">` +
    `<iframe title="Trouver ma taille avec SwiftStyle" src="${src}"></iframe></div>`;
  const iframe = root.querySelector("iframe")!;
  const previousOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = "hidden";
  document.body.appendChild(host);

  const close = () => {
    window.removeEventListener("message", onMessage);
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("focusin", onFocus);
    host.remove();
    document.documentElement.style.overflow = previousOverflow;
    modalOpen = false;
    button.shadowRoot?.querySelector("button")?.focus();
  };

  const onMessage = (e: MessageEvent) => {
    if (e.source !== iframe.contentWindow || e.origin !== APP || !isMessage(e.data)) return;
    const msg = e.data as { type: string; height?: unknown; size?: unknown; recommendationId?: unknown };

    if (msg.type === "ready") {
      const context: HostMessage = {
        source: MESSAGE_SOURCE,
        type: "context",
        font: getComputedStyle(button).fontFamily || null,
        sizes: listSizes(findProductForm() ?? document),
      };
      iframe.contentWindow?.postMessage(context, APP);
      iframe.focus();
    } else if (msg.type === "resize" && typeof msg.height === "number") {
      iframe.style.height = `${Math.min(Math.max(msg.height, 120), 2000)}px`;
    } else if (msg.type === "close") {
      close();
    } else if (msg.type === "size-selected" && typeof msg.size === "string") {
      const size = msg.size;
      const recommendationId = typeof msg.recommendationId === "string" ? msg.recommendationId : null;
      selecting = true;
      const done = selectSize(size, findProductForm() ?? document);
      selecting = false;
      button.say(done ? `Taille ${size} sélectionnée.` : `Taille conseillée : ${size}. Sélectionnez-la dans la liste des tailles.`);
      trackAddToCart(shopKey, productId, recommendationId);
      close();
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };

  // Le focus ne quitte pas la modale tant qu'elle est ouverte.
  const onFocus = (e: FocusEvent) => {
    if (e.target !== host) iframe.focus();
  };

  root.querySelector(".backdrop")!.addEventListener("click", close);
  window.addEventListener("message", onMessage);
  document.addEventListener("keydown", onKey);
  document.addEventListener("focusin", onFocus);
  return true;
}

/**
 * Fonction core n° 3 : l'ajout au panier reste celui du marchand (§ 8). On note
 * seulement s'il suit une recommandation, pour mesurer le jalon 3.
 */
let lastSelection: { shopKey: string; productId: string; recommendationId: string | null } | null = null;
let listening = false;

function trackAddToCart(shopKey: string, productId: string, recommendationId: string | null) {
  if (!listening) {
    listening = true;
    document.addEventListener(
      "submit",
      (e) => {
        if (lastSelection && e.target === findProductForm()) {
          sendEvent(lastSelection.shopKey, "added_to_cart", lastSelection.productId, lastSelection.recommendationId);
          lastSelection = null;
        }
      },
      true,
    );
  }
  lastSelection = { shopKey, productId, recommendationId };
}

/** Place un bouton dans chaque point d'insertion de la page. */
function mount() {
  document.querySelectorAll<HTMLElement>("#swiftstyle-root, [data-swiftstyle-root]").forEach((root) => {
    // Sélecteur de secours (thèmes qui n'appellent pas le hook standard, app embed Shopify).
    const target = root.dataset.target ? document.querySelector(root.dataset.target) : null;
    if (target && root.previousElementSibling !== target) target.insertAdjacentElement("afterend", root);
    if (!root.querySelector("swiftstyle-button")) root.appendChild(document.createElement("swiftstyle-button"));
  });
}

if (!customElements.get("swiftstyle-button")) customElements.define("swiftstyle-button", SwiftStyleButton);

(window as unknown as { SwiftStyle: object }).SwiftStyle = { version: "1", mount };

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
else mount();
