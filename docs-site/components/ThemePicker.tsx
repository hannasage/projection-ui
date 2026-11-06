'use client';
import type { UITheme } from '@hannasage/projection-ui/core';

export type ThemePair = { label: string; dark: UITheme; light: UITheme; particles: { dark: string; light: string } };

type ThemePickerProps<Key extends string> = {
  pairs: Record<Key, ThemePair>;
  pair: Key;
  onPair: (key: Key) => void;
  light: boolean;
  palette: UITheme;
  themeName: string;
  mode: string;
  nextMode: string;
  onMode: (next: string) => void;
};

/** The palette menu in the landing nav. The landing and the Armature page share it. */
export function ThemePicker<Key extends string>({ pairs, pair, onPair, light, palette, themeName, mode, nextMode, onMode }: ThemePickerProps<Key>) {
  return <details className="landing-theme-picker" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
    <summary aria-label="Choose theme" title="Themes" style={{ backgroundImage: `linear-gradient(135deg, ${palette.primary}, ${palette.partner})`, color: palette.primaryFg }}><PaletteIcon /></summary>
    <div className="landing-theme-menu">
      <p>Flexing on you with our themes lol</p>
      <div className="landing-theme-grid" role="group" aria-label="Theme palettes">
        {(Object.keys(pairs) as Key[]).map(key => {
          const value = pairs[key];
          const swatch = light ? value.light : value.dark;
          const active = pair === key;
          const gradient = key === 'core'
            ? `linear-gradient(135deg, ${value.dark.primary}, ${value.dark.partner} 50%, ${value.light.primary} 50%, ${value.light.partner})`
            : `linear-gradient(135deg, ${swatch.primary}, ${swatch.partner})`;
          return <button key={key} type="button" className="landing-theme-swatch" aria-label={value.label} title={value.label} aria-pressed={active} style={{ backgroundImage: gradient, color: swatch.primaryFg }} onClick={() => onPair(key)}>
            {active && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg>}
          </button>;
        })}
      </div>
      <div className="landing-theme-footer"><span className="landing-theme-current">{themeName}</span><button type="button" className="landing-mode-control" data-color-mode={mode} aria-label={`Color mode: ${mode}. Switch to ${nextMode}.`} title={`Color mode: ${mode}. Switch to ${nextMode}.`} onClick={() => onMode(nextMode)}><ModeIcon mode={mode} /></button></div>
    </div>
  </details>;
}

function PaletteIcon() { return <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M10 2a8 8 0 1 0 0 16h1a2 2 0 0 0 1-3.7 1.5 1.5 0 0 1 1-2.6H15a3 3 0 0 0 3-3.2A8 8 0 0 0 10 2Z" /><path d="M6 6h.01M10 5h.01M14 7h.01M5 10h.01" strokeLinecap="round" strokeWidth="2.5" /></svg>; }

function ModeIcon({ mode }: { mode: string }) { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">{mode === 'system' ? <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></> : mode === 'light' ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z" />}</svg>; }
