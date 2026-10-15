"use client";

import { useState, type FormEvent } from "react";
import { EMAIL_RE } from "@/lib/email";
import { useHydrated } from "@/lib/use-hydrated";

// Formulaire « Demander un essai ». Envoi vers /api/demande-essai, qui transmet au Google Sheet.

const PLATFORMS = ["Shopify", "WooCommerce", "PrestaShop", "Magento / Adobe Commerce", "Salesforce Commerce Cloud", "Autre"];
const VOLUMES = ["Moins de 1 000", "1 000 à 10 000", "10 000 à 50 000", "Plus de 50 000"];

const STEPS = [
  { title: "Un appel de 30 minutes", text: "Pour comprendre votre catalogue, vos coupes et vos motifs de retour." },
  { title: "L'installation sur quelques fiches produit", text: "Le widget est habillé à vos couleurs et branché sur vos guides des tailles." },
  { title: "Trente jours de test, puis un bilan", text: "Vous comparez vos retours liés à la taille avec et sans le widget." },
];

export function TrialSignup() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [sentTo, setSentTo] = useState("");
  const hydrated = useHydrated();

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = form.elements.namedItem("email") as HTMLInputElement;
    email.setCustomValidity(EMAIL_RE.test(email.value.trim()) ? "" : "Cette adresse e-mail ne semble pas valide.");
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const fields = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setStatus("sending");
    try {
      const res = await fetch("/api/demande-essai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...fields, source: location.href, referrer: document.referrer }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSentTo(email.value.trim());
      setStatus("sent");
    } catch (err) {
      console.error("[SwiftStyle] Envoi impossible :", err);
      setStatus("error");
    }
  }

  return (
    <section className="signup crumple" id="contact" aria-labelledby="signup-title">
      <div>
        <h2 className="display" id="signup-title">
          Testez-le sur votre boutique.
        </h2>
        <p className="signup-lead">
          Laissez-nous vos coordonnées. On étudie votre catalogue et vos guides des tailles, puis on vous propose un essai sur une sélection
          de produits.
        </p>
        <ol className="steps">
          {STEPS.map((s) => (
            <li key={s.title}>
              <div>
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className={status === "sent" ? "form sent" : "form"}>
        <form noValidate onSubmit={onSubmit}>
          <h3>Demander un essai</h3>
          <div className="f2">
            <div className="f">
              <label htmlFor="f-name">Prénom et nom</label>
              <input id="f-name" name="name" autoComplete="name" required />
            </div>
            <div className="f">
              <label htmlFor="f-mail">E-mail professionnel</label>
              <input id="f-mail" name="email" type="email" autoComplete="email" required onInput={(e) => e.currentTarget.setCustomValidity("")} />
            </div>
          </div>
          <div className="f2">
            <div className="f">
              <label htmlFor="f-brand">Marque</label>
              <input id="f-brand" name="brand" autoComplete="organization" required />
            </div>
            <div className="f">
              <label htmlFor="f-site">Site de la boutique</label>
              <input id="f-site" name="site" type="url" placeholder="https://" required />
            </div>
          </div>
          <div className="f2">
            <div className="f">
              <label htmlFor="f-platform">Plateforme</label>
              <select id="f-platform" name="platform" required defaultValue="">
                <option value="">Choisir</option>
                {PLATFORMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="f">
              <label htmlFor="f-volume">Commandes par mois</label>
              <select id="f-volume" name="volume" required defaultValue="">
                <option value="">Choisir</option>
                {VOLUMES.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="f">
            <label htmlFor="f-msg">
              Votre besoin <small>(facultatif)</small>
            </label>
            <textarea id="f-msg" name="message" placeholder="Ex. beaucoup de retours sur les jeans" />
          </div>
          {/* Piège à robots : invisible pour les humains, rempli par les robots. */}
          <div className="hp" aria-hidden="true">
            <label>
              Société <input name="societe" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <label className="consent">
            <input type="checkbox" name="consent" required /> J&apos;accepte que SwiftStyle me recontacte au sujet de cette demande.
          </label>
          {status === "error" && (
            <p className="form-error" role="alert">
              L&apos;envoi a échoué. Vérifiez votre connexion et réessayez, ou écrivez-nous directement.
            </p>
          )}
          <button className="btn btn--ink" type="submit" disabled={!hydrated || status === "sending"}>
            {status === "sending" ? "Envoi…" : "Envoyer ma demande"}
          </button>
        </form>
        <div className="form-ok" role="status">
          <h3>Demande envoyée.</h3>
          <p>Nous vous écrivons sous 48 heures à {sentTo}.</p>
        </div>
      </div>
    </section>
  );
}
