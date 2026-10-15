"use client";

import { useEffect, type DetailedHTMLProps, type HTMLAttributes } from "react";

// À copier dans une boutique en React ou Next.js (ARCHITECTURE-TECHNIQUE.md § 7.3).
// Le script /v1/widget.js enregistre le Custom Element <swiftstyle-button> : React n'a qu'à le
// rendre, le navigateur l'active dès que le script est chargé.

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "swiftstyle-button": DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { "data-shop-key"?: string; "data-product-id"?: string };
    }
  }
}

const DEFAULT_SRC = "https://cdn.swiftstyle.app/v1/widget.js";

export interface SwiftStyleButtonProps {
  shopKey: string;
  productId: string;
  /** URL du script, à changer seulement pour pointer vers un environnement de test. */
  src?: string;
}

export function SwiftStyleButton({ shopKey, productId, src = DEFAULT_SRC }: SwiftStyleButtonProps) {
  useEffect(() => {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    document.head.appendChild(script);
  }, [src]);

  // key : un nouveau produit (navigation SPA) recrée l'élément, donc relit sa configuration.
  return <swiftstyle-button key={`${shopKey}:${productId}`} data-shop-key={shopKey} data-product-id={productId} />;
}
