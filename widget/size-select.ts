/**
 * Sélection de la taille dans le sélecteur existant de la page (§ 8, approche
 * principale). On ne réimplémente pas l'ajout au panier : le marchand garde sa
 * logique de panier, ses stocks, son tracking et ses promotions.
 */

const PRODUCT_FORM = 'form[action*="/cart/add"], form.cart, [data-swiftstyle-form]';

export function findProductForm(): HTMLFormElement | null {
  return document.querySelector<HTMLFormElement>(PRODUCT_FORM);
}

/** « M / Noir - 29,00 € » → ["M", "NOIR", "29,00", "€"] */
const tokens = (label: string) =>
  label
    .toUpperCase()
    .split(/[\s/|,()–-]+/)
    .filter(Boolean);

const matches = (label: string, size: string) => tokens(label).includes(size.trim().toUpperCase());

function labelOf(input: HTMLInputElement): string {
  const label = input.labels?.[0]?.textContent ?? "";
  return `${input.value} ${label}`;
}

export function selectSize(size: string, scope: ParentNode): boolean {
  // Boutons radio (thèmes Shopify récents, WooCommerce avec swatches) : un clic
  // déclenche la mise à jour de variante prévue par le thème.
  for (const input of scope.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
    if (!input.disabled && matches(labelOf(input), size)) {
      input.click();
      return true;
    }
  }

  for (const select of scope.querySelectorAll<HTMLSelectElement>("select")) {
    const option = [...select.options].find((o) => !o.disabled && o.value !== "" && (matches(o.text, size) || matches(o.value, size)));
    if (option) {
      select.value = option.value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
  }

  for (const el of scope.querySelectorAll<HTMLElement>("[data-value], [data-option-value]")) {
    if (matches(el.dataset.value ?? el.dataset.optionValue ?? "", size)) {
      el.click();
      return true;
    }
  }

  return false;
}

/** Libellés proposés par les sélecteurs de la page, découpés en mots. */
export function listSizes(scope: ParentNode): string[] {
  const labels: string[] = [];
  scope.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((i) => labels.push(labelOf(i)));
  scope.querySelectorAll<HTMLSelectElement>("select").forEach((s) => {
    for (const o of s.options) if (o.value !== "" && !o.disabled) labels.push(o.text);
  });
  return [...new Set(labels.flatMap(tokens))].slice(0, 200);
}
