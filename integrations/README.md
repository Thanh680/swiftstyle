# Intégrations

Le code de ce dossier ne tourne pas dans notre application : il s'installe chez Shopify, dans
WordPress, dans une boutique React ou dans Google Sheets. Il n'est pas compilé par `npm run build`.

Les trois premières sont des enveloppes autour du même script (`/v1/widget.js`,
ARCHITECTURE-TECHNIQUE.md § 7). Elles ne diffèrent que par la façon de charger ce script et de
transmettre l'identifiant du produit. Aucune n'a encore tourné sur une vraie boutique.

## Shopify : `shopify/extensions/swiftstyle-embed`

Theme App Extension avec un *app embed block*. Le marchand l'active dans l'éditeur de thème,
saisit sa clé `pk_…`, et le bouton se place après le formulaire d'ajout au panier.

Une extension ne se publie pas seule : elle vit dans une app Shopify.

1. Créer un compte partenaire Shopify et une boutique de développement (gratuits).
2. `npx @shopify/cli@latest app init`, puis copier `extensions/swiftstyle-embed` dans le dossier
   `extensions/` de l'app générée.
3. `npx @shopify/cli@latest app dev` pour l'essayer sur la boutique de développement.

L'identifiant transmis est `product.id` : c'est lui qu'il faut saisir dans `products.external_id`.
La publication sur l'App Store passe par une review qui mesure l'impact sur les performances
de la page (§ 7.1) : prévoir du délai.

## WordPress / WooCommerce : `woocommerce/swiftstyle`

Extension WordPress d'un seul fichier. Zipper le dossier `swiftstyle`, puis dans WordPress :
**Extensions → Ajouter → Téléverser**. Réglages dans **Réglages → SwiftStyle**.

- Le bouton s'insère sous le formulaire d'ajout au panier (hook `woocommerce_single_product_summary`, priorité 35).
- Si le thème n'appelle pas ce hook, le bouton est ajouté en fin de page puis déplacé après le
  sélecteur de secours (`form.cart` par défaut).
- L'identifiant transmis est l'ID WordPress du produit.

Pour essayer en local : [wp-env](https://www.npmjs.com/package/@wordpress/env) ou LocalWP, avec WooCommerce.

## Boutiques React ou Next.js : `react/SwiftStyleButton.tsx`

Un composant à copier dans la boutique du marchand :

```tsx
<SwiftStyleButton shopKey="pk_…" productId="SKU-1234" />
```

Il rend l'élément `<swiftstyle-button>` et charge le script une seule fois.

## Tout autre site

```html
<div id="swiftstyle-root" data-product-id="SKU-1234"></div>
<script src="https://cdn.swiftstyle.app/v1/widget.js" data-shop-key="pk_live_xxx" async></script>
```

`data-target="<sélecteur CSS>"` sur la `div` déplace le bouton juste après l'élément visé.

## Google Sheets : `google-sheets/apps-script.gs`

Reçoit les demandes du formulaire de la page d'accueil (`/api/demande-essai`) et les range dans
l'onglet `Marques` d'un Google Sheet : dédoublonnage par e-mail, refus des e-mails invalides,
notification par mail possible (renseigner `DESTINATAIRE` dans `notify_`).

**Le Sheet actuel** (celui de l'ancienne landing) : son script doit être mis à jour pour enregistrer
les colonnes Plateforme et Commandes par mois.

1. Ouvrir le Google Sheet, **Extensions → Apps Script**.
2. Remplacer le code par celui de `apps-script.gs`, enregistrer.
3. **Déployer → Gérer les déploiements → crayon → Version : Nouvelle version**.

Son URL `/exec` est dans `.env.example`. La mettre dans `GOOGLE_SHEETS_WEBHOOK_URL`.

**Un Sheet neuf** :

1. `sheets.new`, puis **Extensions → Apps Script**, coller `apps-script.gs`, enregistrer.
2. **Déployer → Nouveau déploiement**, type **Application web**, exécuter en tant que **Moi**,
   accès **Tout le monde**. Autoriser l'accès quand Google le demande.
3. Copier l'URL qui finit par `/exec` dans `GOOGLE_SHEETS_WEBHOOK_URL`.

Vérification : ouvrir l'URL `/exec` dans un navigateur, elle répond `{"ok":true,"service":"SwiftStyle pilotes"}`.
Chaque modification du script demande un redéploiement (étape 3 ci-dessus), sinon l'ancienne version reste en ligne.
