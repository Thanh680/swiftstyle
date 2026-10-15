// Styles confinés au Shadow DOM : le CSS du thème marchand ne peut pas les casser (§ 4.3).
// Apparence par défaut du § 9 : typographie héritée, quasi monochrome, rayon faible, pas d'ombre.

export const BUTTON_CSS = `
:host{display:block;margin:12px 0;--ss-accent:#111;--ss-bg:#fff;--ss-radius:2px}
:host([hidden]){display:none!important}
button{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:12px 16px;border:1px solid var(--ss-accent);border-radius:var(--ss-radius);background:var(--ss-bg);color:var(--ss-accent);font:inherit;font-weight:600;text-align:center;cursor:pointer}
button:hover{background:var(--ss-accent);color:var(--ss-bg)}
button:focus-visible{outline:2px solid var(--ss-accent);outline-offset:2px}
p{margin:6px 0 0;font-size:.875em}
p:empty{display:none}
:host([hesitating]) button{animation:ss-nudge .9s ease 2}
@keyframes ss-nudge{50%{transform:translateY(-3px)}}
@media (prefers-reduced-motion:reduce){:host([hesitating]) button{animation:none}}
`;

export const MODAL_CSS = `
:host{all:initial}
.backdrop{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.45)}
.dialog{position:fixed;z-index:2147483647;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;background:var(--ss-bg,#fff);border-radius:var(--ss-radius,2px)}
iframe{display:block;width:100%;height:440px;border:0}
@media (max-width:520px){.dialog{top:auto;bottom:0;transform:translateX(-50%);width:100vw;max-height:92vh;border-radius:var(--ss-radius,2px) var(--ss-radius,2px) 0 0}}
`;
