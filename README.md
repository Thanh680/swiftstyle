# SwiftStyle

Widget de recommandation de taille pour les fiches produit des marques e-commerce de mode.

C'est **une seule application Next.js** (App Router, TypeScript). Elle sert à la fois la page
d'accueil destinée aux marques, la fenêtre « Trouver ma taille » affichée chez les marchands,
et l'API qui calcule la taille.

Équipe : Matteo HEIB, Balla DIAKITE, Thanh Danh NGUYEN, Idriss QARQABI.

## Démarrer

Node 22 ou plus récent. Aucune base à installer.

```bash
npm install
```

```bash
npm run dev
```

- http://localhost:3000 : la page d'accueil
- http://localhost:3000/boutique-demo.html : une fausse fiche produit de marchand, avec le widget

## Ce que sert l'application

| URL | Fichier | Rôle |
|---|---|---|
| `/` | `src/app/page.tsx` | page d'accueil pour les marques (site v0.2) |
| `/embed` | `src/app/embed/page.tsx` | fenêtre « Trouver ma taille », ouverte en iframe sur le site du marchand |
| `/api/v1/config` | `src/app/api/v1/config/route.ts` | le widget demande s'il peut s'afficher sur ce site et ce produit |
| `/api/v1/recommend` | `src/app/api/v1/recommend/route.ts` | calcule la taille conseillée |
| `/api/v1/events` | `src/app/api/v1/events/route.ts` | enregistre l'usage du widget (ouvertures, tailles choisies, ajouts au panier) |
| `/api/demande-essai` | `src/app/api/demande-essai/route.ts` | formulaire de la page d'accueil, transmis au Google Sheet |
| `/v1/widget.js` | `widget/` | le script que les marchands collent sur leur site |
| `/boutique-demo.html` | `public/boutique-demo.html` | fausse boutique pour tester le widget de bout en bout |

## Les dossiers

```
src/
├── app/                      routes Next.js (pages et API), voir le tableau ci-dessus
├── components/
│   ├── landing/              sections de la page d'accueil (Hero, WidgetDemo, TrialSignup…)
│   └── size-finder/          contenu de la fenêtre « Trouver ma taille »
└── lib/
    ├── recommendation/       moteur de recommandation, TypeScript pur, testé
    ├── db/                   base de données : schéma Drizzle, connexion, requêtes, données de démo
    ├── widget-protocol.ts    messages échangés entre le widget et la fenêtre
    └── http.ts               CORS, domaines autorisés, limite de requêtes

widget/                       script embarqué chez le marchand (pas du React, 3 ko)
drizzle/                      migrations SQL
integrations/                 code qui tourne ailleurs que chez nous : Shopify, WordPress, React, Google Sheets
docs/                         ARCHITECTURE-TECHNIQUE.md
```

### Pourquoi `widget/` est à part

Le script collé chez le marchand s'exécute sur un site qui n'est pas le nôtre. Il doit peser
quelques ko et ne rien casser : pas de React, pas de Next. Il est écrit en TypeScript simple,
compilé par Vite dans `public/v1/widget.js` (`npm run widget:build`, lancé automatiquement par
`npm run dev` et `npm run build`). Il se contente d'afficher un bouton et, au clic, d'ouvrir
`/embed` dans une iframe. Tout le React est dans cette iframe.

### Le parcours

1. Le marchand colle le script (ou active l'extension Shopify, WordPress). Le script appelle
   `/api/v1/config` et n'affiche le bouton que si le domaine est autorisé et le produit relié à un
   guide des tailles.
2. Quand le client change deux fois de taille dans le menu de la page, le bouton le lui signale.
3. Au clic, l'iframe `/embed` s'ouvre. Le client donne sa taille et son poids, ses tours s'il les
   connaît, ou un vêtement qu'il possède. `SizeFinder` appelle `/api/v1/recommend`.
4. « Choisir la taille M » sélectionne M dans le menu de la page du marchand. L'ajout au panier
   reste celui du marchand.
5. Chaque étape est enregistrée par `/api/v1/events`.

La page d'accueil a sa propre démo (`components/landing/WidgetDemo.tsx`) : elle appelle le même
moteur que l'API, directement dans le navigateur, avec des guides des tailles d'exemple.

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | prépare la base locale, compile le widget, lance Next.js |
| `npm run build` | compile le widget puis l'application |
| `npm test` | tests du moteur de recommandation (Vitest) |
| `npm run typecheck` | vérification des types |
| `npm run db:generate` | écrit une migration après une modification de `src/lib/db/schema.ts` |
| `npm run db:setup` | applique les migrations et insère les données de démo |
| `npm run widget:watch` | recompile le widget à chaque modification |

Le build échoue si le widget dépasse 10 ko compressés.

## Configuration

Copier `.env.example` en `.env.local`. Tout est facultatif en local.

| Variable | Sans elle |
|---|---|
| `DATABASE_URL` | base locale [PGlite](https://pglite.dev) (un PostgreSQL en WebAssembly) dans `.data/pglite` |
| `GOOGLE_SHEETS_WEBHOOK_URL` | le formulaire d'essai affiche « Demande envoyée » mais n'envoie rien ; la demande apparaît seulement dans le terminal. En production, il renvoie une erreur. |

PGlite n'accepte qu'un processus à la fois : arrêter `npm run dev` avant un `npm run db:setup` manuel.

## Ce qui est fictif

- La boutique démo, ses guides des tailles et les vêtements de référence (marque « Exemple »).
- L'estimation des tours à partir de la taille et du poids : formule de la démo du site, jamais
  comparée à des mesures réelles.
- Le pourcentage « correspondance avec le guide » : il mesure l'écart avec le guide des tailles,
  ce n'est pas un taux de bonnes recommandations.
- L'analyse de photo : la démo de la page d'accueil la simule, elle n'est pas faite (phase 2).

## Page d'accueil : points à trancher

Le texte du site v0.2 est repris tel quel, à la demande de l'équipe. Il s'écarte de la soutenance
sur plusieurs points :

- **Chiffres** : 70 % (McKinsey) au lieu de 50 à 70 %, 849,9 Md$ (retours américains 2025) au
  lieu de 890 Md$. Le 53 % vient de la même étude Coresight que le 53 % retiré du document de mai,
  formulé autrement (part des marques, pas part des retours).
- **Promesses non mesurées** : « le colis ne revient pas », « photo analysée en 8 secondes »,
  « 94 % de correspondance ».
- **Section « Une photo suffit »** : présente l'analyse d'image comme si elle existait.
- **Mentions de démonstration** : il n'en reste qu'une, sous l'onglet photo de la démo.
- **Mentions légales et confidentialité** : liens vides, alors que le formulaire collecte des
  données personnelles.

## Écarts avec ARCHITECTURE-TECHNIQUE.md

- L'API est sous `/api/v1/…` (convention Next.js) et non `/v1/…`. Le script reste à `/v1/widget.js`.
- Les deux mécaniques coexistent : le moteur accepte des mesures ou un vêtement de référence. Le
  choix définitif reste celui du jalon 2.
- shadcn n'est pas installé : le choix Base UI ou Radix reste ouvert (§ 12.3). La fenêtre utilise
  du CSS simple et les variables `--ss-*` du § 9.
- Pas de dashboard marque (prévu en dernier, § 13).

## Avant un premier pilote

- Saisir le vrai guide des tailles de la marque pilote et mesurer quelques dizaines de vêtements
  de référence courants, en notant la provenance dans la colonne `source`.
- Restreindre `frame-ancestors` de `/embed` aux domaines de la boutique (`next.config.ts`, il vaut `*`).
- Remplacer la limite de requêtes en mémoire (`src/lib/http.ts`) par un stockage partagé : sur
  Vercel, chaque instance garde son propre compteur.
- Ajouter le secours du § 8 : appel à `/cart/add.js` sur Shopify quand aucun menu de taille n'est trouvé.
- Essayer les extensions Shopify et WordPress sur une boutique de développement : elles n'ont jamais tourné.
- Écrire les pages mentions légales et confidentialité.

## Déployer

Vercel et Neon (§ 3). La page d'accueil part avec l'application, il n'y a plus de site séparé.

1. Créer une base Neon et lancer, en local, `npm run db:setup` avec `DATABASE_URL` pointant dessus.
2. Importer le dépôt sur Vercel. Variables : `DATABASE_URL`, `GOOGLE_SHEETS_WEBHOOK_URL`.
3. Le script est alors servi à `https://<domaine>/v1/widget.js`. Les extensions pointent vers
   `cdn.swiftstyle.app` : faire pointer ce domaine vers le déploiement, ou changer l'adresse.

## Ajouter une boutique

Sans dashboard, l'équipe saisit les données elle-même, en SQL ou en adaptant `src/lib/db/seed.ts` :

1. une ligne `shops` avec une clé `pk_…` et les domaines autorisés (`https://www.marque.fr`) ;
2. un `size_charts` par guide des tailles, au format `SizeChart` (`src/lib/recommendation/types.ts`) ;
3. un `products` par produit, avec son identifiant Shopify ou WordPress dans `external_id`.
