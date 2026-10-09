import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_THEME, RADIUS_SCALE, UI_FOUNDATIONS } from '../src/foundations.ts';

const variables = { ...Object.fromEntries(Object.entries(DEFAULT_THEME).filter(([key]) => !['radius', 'name', 'mode', 'appearance'].includes(key)).map(([key,value]) => [key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), value])), 'font-body': DEFAULT_THEME.fontBody, 'font-display': DEFAULT_THEME.fontDisplay, 'font-mono': DEFAULT_THEME.fontMono, 'accent-text': DEFAULT_THEME.primary, 'gradient-start': DEFAULT_THEME.primary, 'gradient-end': DEFAULT_THEME.partner, focus: 'var(--ui-primary)', ...UI_FOUNDATIONS.semantic };
for (const [role, value] of Object.entries(RADIUS_SCALE.soft)) variables[`radius-${role}`] = value;
for (const [scale, values] of Object.entries(UI_FOUNDATIONS)) {
  if (scale === 'semantic') continue;
  for (const [role,value] of Object.entries(values)) variables[`${scale.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}-${role}`] = value;
}
const declaration = Object.entries(variables).map(([key,value]) => `  --ui-${key}: ${value};`).join('\n');
const controls = `:where(select, input, textarea, button, a):focus-visible { outline: 2px solid var(--ui-focus, var(--ui-primary, #C9F53A)); outline-offset: 2px; border-radius: 3px; }
input[type="range"] { accent-color: var(--ui-primary, #C9F53A); cursor: pointer; }
input[type="number"] { -moz-appearance: textfield; }
input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }`;
const page = `::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--ui-bg); }
::-webkit-scrollbar-thumb { background: var(--ui-border); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--ui-primary); }
::selection { background: var(--ui-primary); color: var(--ui-primary-fg); }`;
const reduced = `@media (prefers-reduced-motion: reduce) {
  :where([data-ui-theme]) .ui-skeleton, :where([data-ui-theme]) .ui-toast { animation: none !important; }
  :where([data-ui-theme]) :where(button, input, [role="radio"], .ui-toggle-thumb) { transition: none !important; }
}`;
const scopedControls = controls.replace(/^([^@\n].*?)\s*\{/gm, (_, selector) => `:where([data-ui-theme]) ${selector.replace(', input[type="number"]', ', :where([data-ui-theme]) input[type="number"]')} {`);
const prose = `:where([data-ui-theme]) .ui-prose :where(h1,h2,h3,h4,h5,h6) { font-family: var(--ui-font-display, var(--ui-font)); line-height: var(--ui-line-height-tight); }
:where([data-ui-theme]) .ui-prose :where(a) { color: var(--ui-primary); text-underline-offset: 3px; }
:where([data-ui-theme]) .ui-prose :where(pre) { overflow-x: auto; }`;
const glow = `:where([data-ui-theme]) .ui-projection-glow {
  position: relative; width: 100%; height: 18rem; overflow: hidden; isolation: isolate; contain: paint; pointer-events: none;
}
:where([data-ui-theme]) .ui-projection-glow[data-intensity="subtle"] { opacity: 0.45; }
:where([data-ui-theme]) .ui-projection-glow::before, :where([data-ui-theme]) .ui-projection-glow::after {
  content: ""; position: absolute; top: 36%; width: 50%; height: 64%; opacity: 0.6;
  mask-image: linear-gradient(to bottom, black, transparent);
}
:where([data-ui-theme]) .ui-projection-glow::before {
  right: 50%; background: conic-gradient(from 70deg at center top, var(--ui-glow-color), transparent 100deg, transparent);
}
:where([data-ui-theme]) .ui-projection-glow::after {
  left: 50%; background: conic-gradient(from 290deg at center top, transparent, transparent 260deg, var(--ui-glow-color));
}
:where([data-ui-theme]) .ui-projection-glow-halo {
  position: absolute; top: 12%; left: 12%; width: 76%; height: 68%;
  background: radial-gradient(ellipse at center, var(--ui-glow-color), transparent 68%); opacity: 0.4; filter: blur(18px);
}
:where([data-ui-theme]) .ui-projection-glow-line {
  position: absolute; top: 36%; left: 16%; width: 68%; height: 2px; background: var(--ui-glow-color);
  box-shadow: 0 0 18px var(--ui-glow-color);
}
:where([data-ui-theme]) .ui-projection-glow[data-motion="reveal"] .ui-projection-glow-halo,
:where([data-ui-theme]) .ui-projection-glow[data-motion="reveal"] .ui-projection-glow-line {
  animation: ui-projection-glow-reveal 450ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@keyframes ui-projection-glow-reveal { from { opacity: 0; transform: scaleX(0.9); } }
@media (prefers-reduced-motion: reduce) {
  :where([data-ui-theme]) .ui-projection-glow * { animation: none !important; }
}
@media (forced-colors: active) {
  :where([data-ui-theme]) .ui-projection-glow { visibility: hidden; }
}`;
const materials = `:where([data-ui-theme]) .ui-surface {
  position: relative; isolation: isolate; background: var(--ui-surface); color: var(--ui-text);
  border: 1px solid var(--ui-border); border-radius: var(--ui-radius-lg); padding: var(--ui-space-xl);
}
:where([data-ui-theme]) :is(.ui-surface[data-material="glass"], .ui-material-glass) {
  background: var(--ui-surface); background: color-mix(in srgb, var(--ui-surface) 72%, transparent);
  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
}
:where([data-ui-theme]) :is(.ui-surface[data-edge-light], .ui-edge-light) {
  border-top-color: color-mix(in srgb, var(--ui-primary) 65%, var(--ui-border));
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--ui-partner) 20%, transparent);
}
:where([data-ui-theme]) :where(.ui-surface[data-underglow], .ui-underglow)::after {
  content: ""; position: absolute; z-index: -1; pointer-events: none;
  inset: auto 18% -12px; height: 18px; border-radius: 50%;
  background: linear-gradient(90deg, var(--ui-primary), var(--ui-partner));
  filter: blur(14px); opacity: var(--ui-glow, 0.65);
}
:where([data-ui-theme]) .ui-gradient-background {
  position: relative; isolation: isolate; color: var(--ui-text); background-color: var(--ui-bg);
  --ui-wash-primary: color-mix(in srgb, var(--ui-primary) 14%, transparent);
  --ui-wash-partner: color-mix(in srgb, var(--ui-partner) 16%, transparent);
}
:where([data-ui-theme]) .ui-gradient-background[data-variant="wash"] {
  background-image: linear-gradient(125deg, var(--ui-wash-primary), transparent 50%, var(--ui-wash-partner));
}
:where([data-ui-theme]) .ui-gradient-background[data-variant="spotlight"] {
  background-image: radial-gradient(ellipse at 50% 15%, var(--ui-wash-primary), transparent 65%);
}
:where([data-ui-theme]) .ui-gradient-background[data-variant="horizon"] {
  background-image: radial-gradient(ellipse at 50% 110%, var(--ui-wash-primary), transparent 60%), linear-gradient(0deg, var(--ui-wash-partner), transparent 45%);
}
:where([data-ui-theme]) .ui-gradient-background[data-variant="atmosphere"] {
  background-image: radial-gradient(ellipse at 10% 0%, var(--ui-wash-primary), transparent 60%), radial-gradient(ellipse at 95% 90%, var(--ui-wash-partner), transparent 65%);
}
:where([data-ui-theme]) .ui-gradient-text {
  color: var(--ui-text); font-family: var(--ui-font-display); font-size: max(24px, 1.5rem); line-height: 1.2;
}
@supports (background-clip: text) or (-webkit-background-clip: text) {
  :where([data-ui-theme]) .ui-gradient-text {
    background-image: linear-gradient(110deg, var(--ui-gradient-start, var(--ui-primary)), var(--ui-gradient-end, var(--ui-partner)));
    background-clip: text; -webkit-background-clip: text; color: transparent;
  }
}
@media (forced-colors: active) {
  :where([data-ui-theme]) :where(.ui-surface, .ui-material-glass) { background: Canvas !important; color: CanvasText; border-color: CanvasText; box-shadow: none; backdrop-filter: none; }
  :where([data-ui-theme]) :where(.ui-surface[data-underglow], .ui-underglow)::after { display: none; }
  :where([data-ui-theme]) .ui-gradient-background { background: Canvas; color: CanvasText; }
  :where([data-ui-theme]) .ui-gradient-text { color: CanvasText; background: none; }
  :where([data-ui-theme]) .ui-button[data-variant="primary"][data-appearance="gradient"] { background: ButtonFace; color: ButtonText; box-shadow: none; }
}`;
const progress = `:where([data-ui-theme]) .ui-progress:not(:indeterminate) {
  appearance: none; -webkit-appearance: none; background: var(--ui-border); border: 0; border-radius: var(--ui-radius-full); overflow: hidden;
}
:where([data-ui-theme]) .ui-progress:not(:indeterminate)::-webkit-progress-bar { background: var(--ui-border); border-radius: inherit; }
:where([data-ui-theme]) .ui-progress:not(:indeterminate)::-webkit-progress-value { background: var(--ui-primary); border-radius: inherit; }
:where([data-ui-theme]) .ui-progress:not(:indeterminate)::-moz-progress-bar { background: var(--ui-primary); border-radius: inherit; }
@media (forced-colors: active) {
  :where([data-ui-theme]) .ui-progress:not(:indeterminate) { appearance: auto; -webkit-appearance: auto; forced-color-adjust: auto; }
  :where([data-ui-theme]) .ui-progress:not(:indeterminate)::-webkit-progress-bar { background: Canvas; }
  :where([data-ui-theme]) .ui-progress:not(:indeterminate)::-webkit-progress-value { background: Highlight; }
  :where([data-ui-theme]) .ui-progress:not(:indeterminate)::-moz-progress-bar { background: Highlight; }
}`;
const flat = `:where([data-ui-theme]) :where(.ui-material-glass, .ui-underglow) { position: relative; isolation: isolate; }
:where([data-ui-theme]) .ui-button[data-variant="primary"][data-appearance="gradient"] {
  background: var(--ui-primary); background-image: linear-gradient(110deg, var(--ui-primary), var(--ui-partner));
  box-shadow: 0 5px 16px color-mix(in srgb, var(--ui-primary) 35%, transparent);
}
:where([data-ui-theme]) .ui-field:focus-within {
  border-color: var(--ui-focus, var(--ui-primary));
  box-shadow: 0 3px 8px color-mix(in srgb, var(--ui-primary) 20%, transparent);
}


:where([data-ui-theme]) .ui-spinner { animation: ui-spinner-rotate 0.9s linear infinite; }
@keyframes ui-spinner-rotate { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { :where([data-ui-theme]) .ui-spinner { animation: none; } }







@scope ([data-ui-theme][data-ui-appearance="flat"]) to ([data-ui-theme]) {
:scope .ui-button[data-variant="primary"][data-appearance="gradient"] {
  background: var(--ui-primary); background-image: none; box-shadow: none;
}
:scope .ui-field:focus-within { box-shadow: none; }
:scope :is(.ui-surface, .ui-material-glass) {
  background: var(--ui-surface); backdrop-filter: none; -webkit-backdrop-filter: none;
}
:scope :is(.ui-surface, .ui-edge-light, .ui-underglow) {
  box-shadow: none; border-top-color: var(--ui-border);
}
:scope :is(.ui-surface[data-underglow], .ui-underglow)::after { display: none; }
:scope .ui-gradient-background { background-image: none; }
:scope :is(.ui-gradient-text, .ui-heading-gradient) {
  background-image: none; color: var(--ui-text); -webkit-text-fill-color: currentColor;
}
:scope .ui-projection-glow { display: none; }
}
`;
const outputs = {
  'theme.css': `/* Generated from src/foundations.ts. Legacy page rules remain for compatibility. */\n:root {\n${declaration}\n}\n${controls}\n${page}\n${glow}\n${materials}\n${progress}\n${flat}\n${reduced}\n`,
  'scoped.css': `/* Generated from src/foundations.ts. Only themed wrappers and their children are styled. */\n:where([data-ui-theme]) {\n${declaration}\n}\n${scopedControls}\n${prose}\n${glow}\n${materials}\n${progress}\n${flat}\n${reduced}\n`,
  'reset.css': `/* Explicit opt-in page rules; import scoped.css for component tokens. */\n${controls}\n${page}\n`,
};
for (const [name, content] of Object.entries(outputs)) {
  const path = fileURLToPath(new URL(`../src/tokens/${name}`, import.meta.url));
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== content) throw new Error(`${name} is stale; run npm run tokens`);
  } else writeFileSync(path, content);
}
