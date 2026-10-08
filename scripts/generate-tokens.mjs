import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULT_THEME, RADIUS_SCALE, UI_FOUNDATIONS } from '../src/foundations.ts';

const variables = { ...Object.fromEntries(Object.entries(DEFAULT_THEME).filter(([key]) => key !== 'radius').map(([key,value]) => [key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`), value])), 'font-body': 'var(--ui-font)', 'font-display': 'var(--ui-font)', focus: 'var(--ui-primary)', ...UI_FOUNDATIONS.semantic };
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
const outputs = {
  'theme.css': `/* Generated from src/foundations.ts. Legacy page rules remain for compatibility. */\n:root {\n${declaration}\n}\n${controls}\n${page}\n${glow}\n${reduced}\n`,
  'scoped.css': `/* Generated from src/foundations.ts. Only themed wrappers and their children are styled. */\n:where([data-ui-theme]) {\n${declaration}\n}\n${scopedControls}\n${prose}\n${glow}\n${reduced}\n`,
  'reset.css': `/* Explicit opt-in page rules; import scoped.css for component tokens. */\n${controls}\n${page}\n`,
};
for (const [name, content] of Object.entries(outputs)) {
  const path = fileURLToPath(new URL(`../src/tokens/${name}`, import.meta.url));
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== content) throw new Error(`${name} is stale; run npm run tokens`);
  } else writeFileSync(path, content);
}
