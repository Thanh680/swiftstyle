/**
 * Messages échangés par postMessage entre le script du widget (page du marchand) et
 * l'iframe de la modale (ARCHITECTURE-TECHNIQUE.md § 4.5). Chaque côté vérifie
 * `event.origin` avant de lire un message.
 */

export const MESSAGE_SOURCE = "swiftstyle";

type Msg<T extends string, P = object> = { source: typeof MESSAGE_SOURCE; type: T } & P;

/** iframe -> page */
export type FrameMessage =
  | Msg<"ready">
  | Msg<"resize", { height: number }>
  | Msg<"close">
  | Msg<"size-selected", { size: string; recommendationId: string | null }>;

/** page -> iframe */
export type HostMessage = Msg<
  "context",
  {
    /** Police calculée sur la page hôte, pour que la modale reprenne la typographie du site. */
    font: string | null;
    /** Tailles proposées par le sélecteur natif de la page. */
    sizes: string[];
  }
>;

export function isMessage(data: unknown): data is { source: typeof MESSAGE_SOURCE; type: string } {
  return typeof data === "object" && data !== null && (data as { source?: unknown }).source === MESSAGE_SOURCE;
}

/** Télémétrie (§ 5.1) : de quoi mesurer le jalon 3 de la roadmap. */
export const EVENT_TYPES = ["widget_opened", "recommendation_shown", "size_selected", "added_to_cart"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
