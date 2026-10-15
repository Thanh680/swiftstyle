# SwiftStyle — Architecture technique

> **Statut** : proposition d'architecture, 13 octobre 2026.
> Aucune implémentation n'existe à ce jour. Ce document cadre *comment* construire le produit décrit dans la soutenance. Il prend position là où une position est nécessaire pour avancer, et liste au § 12 les décisions qui restent ouvertes et relèvent de l'équipe.
> Les chiffres business cités s'alignent sur `SwiftStyle - Soutenance - Startup&IT.pdf`, source de vérité.

---

## 1. Décision structurante préalable

Les supports portent deux mécaniques de recommandation différentes :

- le MVP de la soutenance annonce **OpenCV + TensorFlow**, analyse morphologique sur 3 photos en 5 secondes ;
- la maquette du slide « 3 fonctions core » illustre **l'option 3** du document de mai — recommandation déduite d'un vêtement déjà possédé (« Basé sur votre t-shirt Nike en taille M… »).

Ce ne sont pas deux variantes du même produit, ce sont deux produits :

| | Option 3 — vêtement de référence | Option photos |
|---|---|---|
| Nature du problème | Mapping entre tables de tailles | Vision par ordinateur |
| Langage | TypeScript uniquement | Service Python séparé obligatoire |
| Coût d'inférence | ≈ 0 | GPU ou CPU lourd |
| RGPD | Mensurations (données personnelles) | Images de corps (risque supérieur) |
| Chiffrage doc. de mai | 5–10 k€, « très facile » | 50–200 k€, faisabilité moyenne |

**Recommandation : construire l'option 3 en premier.** Trois raisons.

1. Elle est réalisable intégralement dans la stack que l'équipe maîtrise, sans compétence ML à acquérir.
2. Elle tient la ligne « 3 240 € de coûts directs annuels » du business plan. Avec de l'inférence GPU, ce chiffre n'est plus défendable.
3. Elle produit un widget démontrable sur une vraie fiche produit — exactement ce qui manque aujourd'hui pour engager le jalon 1 de la roadmap.

L'architecture ci-dessous reste valable si l'option photos est ajoutée plus tard : c'est un endpoint supplémentaire, pas une refonte.

---

## 2. Vue d'ensemble

```
   SITE DU MARCHAND (Shopify / WordPress / from scratch)
   ┌──────────────────────────────────────────────┐
   │  Fiche produit                               │
   │                                              │
   │  [ Trouver ma taille avec SwiftStyle ]  ◄──── Custom Element + Shadow DOM
   │                                              │     (le CSS du thème ne peut pas le casser)
   │  ┌────────────────────────────────────┐      │
   │  │  iframe → app.swiftstyle.app       │ ◄──── Next.js + React + shadcn
   │  │  (modale de recommandation)        │      │     chargée au clic uniquement
   │  └────────────────────────────────────┘      │
   └──────────────────┬───────────────────────────┘
                      │  postMessage (dimensions, taille retenue)
                      │  HTTPS
                      ▼
   ┌──────────────────────────────────────────────┐
   │  API SwiftStyle (Next.js Route Handlers)     │
   │  /v1/recommend   /v1/config   /v1/events     │
   └──────────────────┬───────────────────────────┘
                      ▼
   ┌──────────────────────────────────────────────┐
   │  PostgreSQL — tables de tailles,             │
   │  vêtements de référence, télémétrie          │
   └──────────────────────────────────────────────┘
```

Le principe directeur : **ce qui part chez le marchand est minuscule et inerte**. Un script qui injecte un bouton, et une iframe servie depuis notre domaine. Tout le React vit dans l'iframe. On ne peut donc rien casser chez le client — argument technique autant que commercial.

---

## 3. Stack

| Couche | Techno | Justification |
|---|---|---|
| Loader embarqué | TypeScript vanilla, build Vite en IIFE | < 10 ko gz, aucune dépendance, s'exécute chez le client |
| Bouton injecté | Custom Element + Shadow DOM | Isolation CSS vis-à-vis du thème marchand |
| Modale de reco | iframe → Next.js App Router + React + shadcn | Isolation totale, stack connue de l'équipe |
| API | Next.js Route Handlers, même application | Pas de serveur séparé à administrer au stade MVP |
| Base de données | PostgreSQL (Neon ou Supabase) + Drizzle | La base tailles est l'actif principal |
| Dashboard marque | Next.js + shadcn, même application | Tables de tailles, clé publique, snippet, statistiques |
| Hébergement | Vercel | Déploiement CDN inclus pour le loader |
| Vision (phase 2) | FastAPI sur Fly.io ou Railway | Seulement si l'option photos est retenue |

**Librairie de composants.** Depuis juillet 2026, `shadcn init` utilise Base UI par défaut à la place de Radix. Les deux sont MIT, gratuits, sans restriction commerciale. Pour un projet neuf : laisser le défaut. Pour forcer Radix : `pnpm dlx shadcn init -b radix`. Ce choix n'a pas d'impact structurant — ne pas y consacrer de temps.

Librairies à écarter : **MUI, Mantine, Chakra**. Elles imposent une apparence et pèsent lourd, ce qui contredit frontalement le § 9.

---

## 4. Le widget embarqué

### 4.1 Pourquoi pas React dans la page du marchand

Embarquer React chez le client, c'est ajouter une quarantaine de ko gz à une fiche produit qui n'est pas la nôtre, risquer un conflit de version avec un React déjà présent, et hériter de tout le CSS du thème. Un widget qui ralentit une fiche produit se fait désinstaller — et Shopify mesure cet impact dans l'évaluation de son App Store.

### 4.2 Le loader

Un fichier, servi par CDN, versionné dans l'URL (`/v1/widget.js`) pour pouvoir publier une v2 sans casser les installations existantes. Ses responsabilités, et rien d'autre :

1. lire la configuration (`data-shop-key`, `data-product-id`) ;
2. localiser le point d'insertion ;
3. enregistrer le Custom Element du bouton ;
4. au clic, créer l'iframe et ouvrir la modale.

Chargement `async`, jamais bloquant pour le rendu. L'iframe n'est créée qu'au clic : tant que l'utilisateur n'interagit pas, le coût est celui du seul loader.

### 4.3 Le bouton

Rendu dans un Shadow DOM. C'est ce qui garantit qu'un thème WooCommerce agressif ne déforme pas le bouton. Les thèmes WordPress sont beaucoup plus hétérogènes que les thèmes Shopify : cette précaution n'est pas théorique.

### 4.4 La modale

Une iframe pointant vers notre application Next.js, avec le contexte en query string (identifiant marchand, identifiant produit). Isolation parfaite du CSS et du JS, et on développe à l'intérieur exactement comme sur n'importe quelle application React.

### 4.5 Communication

`postMessage` dans les deux sens, avec vérification systématique de `event.origin` :

- iframe → page : hauteur de contenu (redimensionnement), taille retenue par l'utilisateur, demande de fermeture ;
- page → iframe : contexte produit complet, thème du marchand.

---

## 5. L'API

### 5.1 Endpoints

```
POST /v1/recommend    { shopKey, productId, reference|measurements, fitPreference }
                   →  { size, confidence, reason, alternatives[] }

GET  /v1/config       ?shopKey=pk_…
                   →  { theme, locale, enabledCategories }

POST /v1/events       { shopKey, type, recommendationId }
```

`/v1/events` n'est pas accessoire. Les types d'événements — `widget_opened`, `recommendation_shown`, `size_selected`, `added_to_cart` — sont ce qui permettra de produire le **jalon 3 de la roadmap** (« mesurer usage, intérêt marchand, effet sur les retours ou la conversion »). Sans cette instrumentation dès le premier pilote, il n'y aura aucun chiffre à présenter. À construire en même temps que le widget, pas après.

### 5.2 Authentification

Clé **publique** par boutique (`pk_…`), visible dans le navigateur — c'est normal et sans danger, à condition de l'accompagner de :

- une **allowlist de domaines** par boutique, vérifiée côté serveur contre l'en-tête `Origin` ;
- un CORS restreint à ces mêmes domaines ;
- un rate limiting par clé et par IP.

Aucun secret ne transite par le script embarqué. Les opérations privilégiées (édition des tables de tailles) passent par le dashboard, derrière une session authentifiée.

---

## 6. Modèle de données

À concevoir en premier : la soutenance identifie elle-même la donnée comme **risque principal**.

| Table | Rôle |
|---|---|
| `shops` | Marque cliente : clé publique, domaines autorisés, thème, plan |
| `products` | Produit du marchand, lié à son identifiant externe (Shopify / Woo / SKU) |
| `size_charts` | Table de tailles par produit ou par catégorie : libellé, mensurations, coupe |
| `reference_garments` | **L'actif stratégique.** Vêtements du commerce connus (marque, modèle, taille, mensurations réelles) servant de point de comparaison pour l'option 3 |
| `recommendations` | Trace d'une recommandation : entrée, taille sortie, indice de confiance |
| `events` | Télémétrie d'usage (§ 5.1) |

`reference_garments` est ce qui rend l'option 3 possible et ce qui constitue la barrière à l'entrée. Elle se construit progressivement : commencer par quelques dizaines de références très courantes (Levi's 501, t-shirts Nike, basiques Uniqlo) plutôt que de viser l'exhaustivité.

Stocker les mensurations en `jsonb` : les champs pertinents diffèrent selon la catégorie — un pantalon n'a pas de tour de poitrine.

---

## 7. Les trois intégrations

Un seul widget, trois enveloppes fines. Elles ne diffèrent que sur deux points : **comment le script est chargé**, et **comment l'identité du produit est transmise**.

### 7.1 Shopify

Ne pas passer par ScriptTag, qui est la voie héritée. La voie actuelle, et celle qu'attend la review de l'App Store : une **app Shopify + une Theme App Extension** exposant un *app embed block*.

Le marchand installe l'app, active le bloc depuis l'éditeur de thème, et c'est terminé — aucune édition de code de thème, aucune intervention de notre part. Liquid donne accès aux données produit :

```liquid
<div id="swiftstyle-root"
     data-product-id="{{ product.id }}"
     data-shop-key="{{ block.settings.public_key }}"
     data-variants='{{ product.variants | json | escape }}'></div>
<script src="https://cdn.swiftstyle.app/v1/widget.js" async></script>
```

C'est aussi le canal de distribution prévu par le go-to-market du document de mai. **Prévoir du délai** : la publication sur l'App Store suppose une review, qui vérifie notamment l'impact sur les performances de la page.

### 7.2 WordPress / WooCommerce

Un plugin PHP d'environ 150 lignes. Deux hooks suffisent :

```php
add_action('woocommerce_single_product_summary', function () {
    global $product;
    printf(
        '<div id="swiftstyle-root" data-product-id="%d" data-shop-key="%s"></div>',
        $product->get_id(),
        esc_attr(get_option('swiftstyle_public_key'))
    );
}, 35); // 30 = formulaire d'ajout au panier → 35 le place juste en dessous

add_action('wp_enqueue_scripts', function () {
    wp_enqueue_script('swiftstyle', 'https://cdn.swiftstyle.app/v1/widget.js', [], null, true);
});
```

Plus une page de réglages pour saisir la clé publique. **Prévoir un sélecteur CSS de secours configurable** : certains thèmes WooCommerce surchargent le template produit et n'appellent jamais le hook standard.

### 7.3 From scratch et headless

Le snippet brut :

```html
<script src="https://cdn.swiftstyle.app/v1/widget.js"
        data-shop-key="pk_live_xxx" async></script>
<div id="swiftstyle-root" data-product-id="SKU-1234"></div>
```

Et pour les boutiques en React/Next.js, un package `@swiftstyle/react` exposant `<SwiftStyleButton productId={…} />`. C'est une vingtaine de lignes au-dessus du même loader, et c'est ce qui fait la meilleure impression en démonstration devant un développeur.

---

## 8. L'action panier — le point le plus fragile

La fonction core n° 3 est « transformer la recommandation en action ». C'est techniquement la partie la plus risquée, parce que les API panier n'ont rien en commun : Shopify expose `POST /cart/add.js`, WooCommerce la Store API `/wc/store/v1/cart/add-item` avec un nonce, un site from scratch est une inconnue totale.

**Ne pas réimplémenter l'ajout au panier.** Approche retenue :

1. **Principal** — le bouton *sélectionne la taille recommandée dans le sélecteur existant de la page* : trouver le `<select>` ou les boutons radio de taille, positionner la valeur, émettre un événement `change`. Le marchand garde sa logique de panier, ses stocks, son tracking, ses promotions.
2. **Secours** — appel direct à l'API panier, uniquement sur les plateformes où elle est connue et stable (Shopify avant tout).

Au-delà de la robustesse technique, « nous ne touchons pas à votre tunnel de conversion » est un argument de vente face à une marque qui hésite à installer un widget sur sa page la plus sensible.

---

## 9. Theming : le widget porte l'identité du marchand, pas la nôtre

Le widget s'affichera chez Le Slip Français (premium, sobre), chez 1822 Denim et chez Weyz (streetwear). Ces trois marques n'ont aucune esthétique commune.

Imposer un style SwiftStyle revient à dégrader l'identité visuelle du client sur sa page produit. C'est un motif de désinstallation et un argument contre nous en rendez-vous commercial.

Ce qu'il faut n'est donc pas une belle librairie de composants, mais **une couche de theming** exposée en variables CSS, surchargeable depuis le dashboard marque :

```css
:root {
  --ss-font: inherit;      /* hérite de la typographie du site hôte */
  --ss-radius: 0px;
  --ss-accent: #111;
  --ss-bg: #fff;
  --ss-border: #e5e5e5;
}
```

C'est précisément pourquoi le headless (Base UI / Radix) est le bon choix : nous possédons 100 % du CSS, donc nous pouvons le rendre paramétrable. Ce n'est pas un compromis, c'est l'outil adapté au besoin.

Pour l'apparence par défaut, avant personnalisation : typographie héritée du site plutôt qu'une police imposée, rayon de bordure à 0 ou 2 px, palette quasi monochrome, beaucoup de blanc, pas d'ombres portées.

---

## 10. Sécurité, RGPD, performance

**Sécurité.** Clé publique côté navigateur, allowlist de domaines et CORS côté serveur, rate limiting, vérification de `event.origin` sur chaque `postMessage`. Jamais de secret dans le script embarqué.

**RGPD.** Les mensurations sont des données personnelles. Avec l'option 3, il est possible de **ne rien stocker d'identifiant côté serveur** : le profil morphologique reste en `localStorage` chez l'utilisateur, le serveur ne voit qu'une requête anonyme. C'est un argument fort en rendez-vous.

Si l'option photos est retenue, le niveau de risque change de catégorie : images de corps, traitement en mémoire obligatoire, suppression immédiate, mention d'information spécifique, et probablement une analyse d'impact. **Le juriste d'une marque posera la question avant son directeur technique.**

**Performance.** Budget strict : loader < 10 ko gz, chargement `async`, iframe créée au clic seulement. À mesurer à chaque release, pas une fois au lancement.

---

## 11. Coûts d'infrastructure

Ordre de grandeur pour l'année 1 telle que décrite au business plan (10 marques clientes) :

| Poste | Estimation annuelle |
|---|---|
| Hébergement + CDN (Vercel) | ~250 € |
| PostgreSQL managé (Neon) | ~230 € |
| Nom de domaine, divers | ~50 € |
| **Total, option 3** | **~500–800 €** |

Confortablement sous la ligne « 3 240 € de coûts directs » du business plan. **Avec de l'inférence pour l'analyse photo, cette ligne est dépassée** — raison supplémentaire de séquencer comme proposé au § 1.

---

## 12. Décisions ouvertes

Ce document ne tranche volontairement pas :

1. **La mécanique de recommandation définitive.** Le § 1 recommande l'option 3 *en premier*, pour des raisons de faisabilité et de coût. Le choix de la mécanique cible reste renvoyé au jalon 2 de la roadmap, comme annoncé en soutenance. Ce document n'engage pas l'équipe sur l'abandon de l'option photos.
2. **Le périmètre fonctionnel du premier pilote**, qui dépend des échanges du jalon 1 et du niveau de preuve attendu par les marques — c'est précisément la question posée au jury.
3. **Base UI ou Radix** : sans impact structurant, à trancher au moment de l'`init`.

---

## 13. Ordre de construction

1. **Le schéma de la base tailles** (§ 6), sur une seule marque réelle. C'est le risque n° 1 identifié par l'équipe elle-même ; tout le reste en dépend.
2. **L'API de recommandation** en TypeScript, un seul endpoint : `POST /v1/recommend`.
3. **Le loader et l'iframe**, testés sur une boutique Shopify de développement (gratuite) et un WooCommerce local.
4. **La télémétrie** (`/v1/events`), en même temps que le widget — pas après.
5. **Le dashboard marque**, en dernier. Au stade pilote, les tables de tailles peuvent être saisies manuellement par l'équipe.

Les points 1 à 4 produisent une démonstration cliquable sur une vraie fiche produit. C'est le livrable qui manque aujourd'hui pour transformer les échanges du jalon 1 en pilote.
