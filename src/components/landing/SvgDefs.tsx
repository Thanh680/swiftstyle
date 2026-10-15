import { SVG_DEFS } from "./figures";

/** Motifs SVG partagés par tous les dessins de la page (papier journal, tissus, ombre « collée »). */
export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
      <defs dangerouslySetInnerHTML={{ __html: SVG_DEFS }} />
    </svg>
  );
}
