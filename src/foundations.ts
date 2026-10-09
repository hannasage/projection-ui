import type { UITheme } from './theme'

const fonts = { font: "'IBM Plex Sans', sans-serif", fontBody: "'IBM Plex Sans', sans-serif", fontDisplay: "'Syne', sans-serif", fontMono: "'IBM Plex Mono', monospace", radius: 'soft', glow: '0.65', appearance: 'neon' } as const

/** Native Figma palettes with the approved core theme refinements. */
export const THEME_PRESETS = {
  "projection": { ...fonts, bg: "#07090C", surface: "#0D1117", text: "#DDE3EE", muted: "#8396AB", border: "#1B2535", primary: "#C9F53A", primaryFg: "#17202A", partner: "#A1F55B", cyan: "#38D9FF", violet: "#B56AFF", pink: "#FF39AB", amber: "#FFD219", mint: "#35F5AA", success: "#35F5AA", warning: "#FFD219", danger: "#FF3D6A", mode: "dark", name: "Projection" },
  "midnight-reef": { ...fonts, bg: "#021721", surface: "#062535", text: "#e2f2fa", muted: "#7abcd4", border: "#0e3c52", primary: "#FFD219", primaryFg: "#17202A", partner: "#00C8FF", cyan: "#38D9FF", violet: "#B56AFF", pink: "#FF39AB", amber: "#FFD219", mint: "#35F5AA", success: "#35F5AA", warning: "#FFD219", danger: "#FF3D6A", mode: "dark", name: "Midnight Reef" },
  "neon-arcade": { ...fonts, bg: "#0f0f23", surface: "#16162f", text: "#f4f4ff", muted: "#9aa1d8", border: "#2c2c58", primary: "#00F5D4", primaryFg: "#17202A", partner: "#B56AFF", cyan: "#38D9FF", violet: "#B56AFF", pink: "#FF39AB", amber: "#FFD219", mint: "#35F5AA", success: "#35F5AA", warning: "#FFD219", danger: "#FF3D6A", mode: "dark", name: "Neon Arcade" },
  "deep-forest": { ...fonts, bg: "#0d1612", surface: "#13211a", text: "#e8f6ee", muted: "#8ab89c", border: "#264133", primary: "#39FF88", primaryFg: "#17202A", partner: "#A4F53A", cyan: "#38D9FF", violet: "#B56AFF", pink: "#FF39AB", amber: "#FFD219", mint: "#35F5AA", success: "#35F5AA", warning: "#FFD219", danger: "#FF3D6A", mode: "dark", name: "Deep Forest" },
  "ember-tide": { ...fonts, bg: "#14111a", surface: "#1f1a29", text: "#f8f1ff", muted: "#b4a7c7", border: "#3a2f4d", primary: "#FF8C2B", primaryFg: "#17202A", partner: "#FF479E", cyan: "#38D9FF", violet: "#B56AFF", pink: "#FF39AB", amber: "#FFD219", mint: "#35F5AA", success: "#35F5AA", warning: "#FFD219", danger: "#FF3D6A", mode: "dark", name: "Ember Tide" },
  "noir-bloom": { ...fonts, bg: "#0e0620", surface: "#180d38", text: "#f5eaff", muted: "#a080cc", border: "#2e1060", primary: "#FF39AB", primaryFg: "#17202A", partner: "#B56AFF", cyan: "#38D9FF", violet: "#B56AFF", pink: "#FF39AB", amber: "#FFD219", mint: "#35F5AA", success: "#35F5AA", warning: "#FFD219", danger: "#FF3D6A", mode: "dark", name: "Noir Bloom" },
  "dusk-protocol": { ...fonts, bg: "#1b1f2a", surface: "#242b3a", text: "#e5e9f0", muted: "#a7b0c0", border: "#3a435a", primary: "#35D9FF", primaryFg: "#17202A", partner: "#397BFF", cyan: "#38D9FF", violet: "#B56AFF", pink: "#FF39AB", amber: "#FFD219", mint: "#35F5AA", success: "#35F5AA", warning: "#FFD219", danger: "#FF3D6A", mode: "dark", name: "Dusk Protocol" },
  "pillow-fort": { ...fonts, bg: "#241529", surface: "#2e1d34", text: "#fdebf6", muted: "#c7a9c4", border: "#4b3155", primary: "#FF65D6", primaryFg: "#17202A", partner: "#FF39AB", cyan: "#38D9FF", violet: "#B56AFF", pink: "#FF39AB", amber: "#FFD219", mint: "#35F5AA", success: "#35F5AA", warning: "#FFD219", danger: "#FF3D6A", mode: "dark", name: "Pillow Fort" },
  "coastal-day": { ...fonts, bg: "#F6FBFF", surface: "#FFFFFF", text: "#17202A", muted: "#485463", border: "#BFCBD8", primary: "#00C8FF", primaryFg: "#101820", partner: "#369FFF", cyan: "#38D9FF", violet: "#B56AFF", pink: "#FF39AB", amber: "#FFD219", mint: "#35F5AA", success: "#35F5AA", warning: "#FFD219", danger: "#FF3D6A", mode: "light", name: "Coastal Day" },
  "projection-light": { ...fonts, bg: "#F3F6F5", surface: "#FAFBFB", text: "#17202A", muted: "#485463", border: "#BFCBD8", primary: "#A4F53A", primaryFg: "#17202A", partner: "#35EB88", cyan: "#38D9FF", violet: "#B56AFF", pink: "#FF39AB", amber: "#FFD219", mint: "#35F5AA", success: "#35F5AA", warning: "#FFD219", danger: "#FF3D6A", mode: "light", name: "Fernwood" },
  "dust-and-flame": { ...fonts, bg: "#FFF9F3", surface: "#FFFFFF", text: "#17202A", muted: "#485463", border: "#BFCBD8", primary: "#FF842B", primaryFg: "#17202A", partner: "#FF479E", cyan: "#38D9FF", violet: "#B56AFF", pink: "#FF39AB", amber: "#FFD219", mint: "#35F5AA", success: "#35F5AA", warning: "#FFD219", danger: "#FF3D6A", mode: "light", name: "Dust & Flame" },
  "confetti-studio": { ...fonts, bg: "#FCF8FF", surface: "#FFFFFF", text: "#17202A", muted: "#485463", border: "#BFCBD8", primary: "#B56AFF", primaryFg: "#17202A", partner: "#FF47B7", cyan: "#38D9FF", violet: "#B56AFF", pink: "#FF39AB", amber: "#FFD219", mint: "#35F5AA", success: "#35F5AA", warning: "#FFD219", danger: "#FF3D6A", mode: "light", name: "Confetti Studio" },
  "party": { ...fonts, bg: "#07090C", surface: "#0D1117", text: "#DDE3EE", muted: "#8396AB", border: "#1B2535", primary: "#C9F53A", primaryFg: "#17202A", partner: "#FF39AB", cyan: "#38D9FF", violet: "#B56AFF", pink: "#FF39AB", amber: "#FFD219", mint: "#35F5AA", success: "#35F5AA", warning: "#FFD219", danger: "#FF3D6A", mode: "dark", name: "Party / Dark" },
  "party-light": { ...fonts, bg: "#FAFCFF", surface: "#FFFFFF", text: "#17202A", muted: "#485463", border: "#BFCBD8", primary: "#C9F53A", primaryFg: "#17202A", partner: "#38D9FF", cyan: "#38D9FF", violet: "#B56AFF", pink: "#FF39AB", amber: "#FFD219", mint: "#35F5AA", success: "#35F5AA", warning: "#FFD219", danger: "#FF3D6A", mode: "light", name: "Party / Light" },
} as const satisfies Record<string, UITheme & { name: string; cyan: string; violet: string; pink: string; amber: string; mint: string }>

export const PROJECTION_THEME = THEME_PRESETS.projection
export const COASTAL_DAY_THEME = THEME_PRESETS['coastal-day']
/** Compatibility export for the primary light theme. */
export const PROJECTION_LIGHT_THEME = COASTAL_DAY_THEME
/** The legacy preset key keeps the green light palette available. */
export const FERNWOOD_THEME = THEME_PRESETS['projection-light']
/** Released core palettes with flat material and current typography roles. */
export const PROJECTION_FLAT_THEME = {
  ...PROJECTION_THEME, name: 'Projection Flat', appearance: 'flat',
  primaryFg: '#07090C', danger: '#FF5252',
  font: "'IBM Plex Mono', monospace",
} as const satisfies UITheme & { name: string }
export const FERNWOOD_FLAT_THEME = {
  ...FERNWOOD_THEME, name: 'Fernwood Flat', appearance: 'flat',
  bg: '#fdf6e3', surface: '#fffbf1', border: '#d8c8a4', text: '#3b2f2f', muted: '#7a6a55',
  primary: '#859900', primaryFg: '#ffffff', danger: '#dc322f',
  font: "'IBM Plex Mono', monospace",
} as const satisfies UITheme & { name: string }
/** Original Coastal Day neutral palette with a solid neon-blue accent. */
export const COASTAL_DAY_FLAT_THEME = {
  ...COASTAL_DAY_THEME, name: 'Coastal Day Flat', appearance: 'flat',
  bg: '#f6f8fa', surface: '#ffffff', border: '#d0d7de', text: '#24292f', muted: '#57606a',
  primary: '#00C8FF', primaryFg: '#101820', danger: '#cf222e', font: "'IBM Plex Mono', monospace",
} as const satisfies UITheme & { name: string }
/** Compatibility export for the canonical blue light flat theme. */
export const PROJECTION_LIGHT_FLAT_THEME = COASTAL_DAY_FLAT_THEME
/** Fonts remain consumer supplied; this preset loads no font files. */
export const DEFAULT_THEME = { ...PROJECTION_THEME, font: "'IBM Plex Mono', monospace" } as const

export const RADIUS_SCALE = {
  sharp: { sm: '0px', md: '2px', lg: '4px', full: '4px' },
  soft: { sm: '4px', md: '6px', lg: '16px', full: '9999px' },
  rounded: { sm: '10px', md: '16px', lg: '24px', full: '9999px' },
}

/** Named scales collect values already used by Projection's controls. */
export const UI_FOUNDATIONS = {
  fontSize: { xs: '10px', sm: '12px', md: '13px', lg: '16px', xl: '20px' },
  lineHeight: { tight: '1.25', body: '1.55' },
  space: { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', '2xl': '32px' },
  borderWidth: { default: '1px', focus: '2px' },
  elevation: { toast: '0 8px 32px rgba(0,0,0,0.35)', modal: '0 24px 80px rgba(0,0,0,0.45)' },
  motion: { fast: '0.12s', normal: '0.18s', shimmer: '1.4s' },
  semantic: { success: '#35F5AA', warning: '#FFD219', backdrop: 'rgba(0,0,0,0.55)' },
} as const
