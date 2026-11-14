import React from 'react'

const SOFT_FILL = 'var(--ui-accent-soft, color-mix(in srgb, var(--ui-primary) 13%, transparent))'

/**
 * The one stylesheet of the motion surfaces. It is drawn only inside a MotionProvider. React hoists it into the document head
 * and keeps one copy, however many surfaces render, because every copy has the same `href`.
 *
 * The lens writes its box as `--pui-lens-*` variables, and each indicator shows that box with clip-path, so no layout property and
 * no transform moves. Until the lens is ready (and on the server) the active option keeps its own static line or fill.
 */
export const MOTION_CSS = `
[data-pui-motion="tabs"] > .ui-lens {
  position: absolute; left: 0; right: 0; bottom: 0; height: 2px; pointer-events: none; opacity: 0; background: var(--ui-primary);
  clip-path: inset(0 calc(100% - var(--pui-lens-x, 0px) - var(--pui-lens-w, 0px)) 0 var(--pui-lens-x, 0px));
}
[data-pui-motion="tabs"][data-pui-lens="ready"] > .ui-lens { opacity: 1; }
[data-pui-motion="tabs"]:not([data-pui-lens="ready"]) > [aria-selected="true"] { --pui-static-line: var(--ui-primary); }
:is([data-pui-motion="chip"], [data-pui-motion="segmented"]) > .ui-lens {
  position: absolute; inset: 0; pointer-events: none; opacity: 0; background: ${SOFT_FILL};
  clip-path: inset(var(--pui-lens-y, 0px) calc(100% - var(--pui-lens-x, 0px) - var(--pui-lens-w, 0px)) calc(100% - var(--pui-lens-y, 0px) - var(--pui-lens-h, 0px)) var(--pui-lens-x, 0px) round var(--pui-lens-round, 0px));
}
[data-pui-motion="chip"] > .ui-lens { --pui-lens-round: var(--ui-radius-md); }
:is([data-pui-motion="chip"], [data-pui-motion="segmented"])[data-pui-lens="ready"] > .ui-lens { opacity: 1; }
:is([data-pui-motion="chip"], [data-pui-motion="segmented"]):not([data-pui-lens="ready"]) > [aria-checked="true"] { --pui-static-fill: ${SOFT_FILL}; }
@media (forced-colors: active) {
  [data-pui-motion] > .ui-lens { background: Highlight; forced-color-adjust: none; }
  :is([data-pui-motion="chip"], [data-pui-motion="segmented"])[data-pui-lens="ready"] > [aria-checked="true"] { color: HighlightText !important; }
}
@media (prefers-reduced-motion: reduce) {
  .ui-button[data-pui-motion], [data-pui-motion] > button, .ui-toggle[data-pui-motion] .ui-toggle-thumb { transition: none !important; }
}
`

/** Renders the shared motion stylesheet. Call it only when a MotionProvider is present. */
export function MotionStyle(): React.ReactElement {
  return <style href="pui-motion" precedence="pui-motion">{MOTION_CSS}</style>
}
