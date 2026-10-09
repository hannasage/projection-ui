export type UIRadius = 'sharp' | 'soft' | 'rounded'

export interface UITheme {
  /** Page / app background */
  bg:        string
  /** Card, panel, elevated surface */
  surface:   string
  /** Border color */
  border:    string
  /** Primary body text */
  text:      string
  /** Secondary / label text */
  muted:     string
  /** Accent color — buttons, focus rings, highlights */
  primary:   string
  /** Text rendered on top of the primary color */
  primaryFg: string
  /** Destructive action color */
  danger:    string
  /** CSS font-family value */
  font:      string
  /** Border-radius preset */
  radius:    UIRadius
  /** Optional roles fall back to font; no font files are loaded. */
  appearance?: 'neon' | 'flat'
  mode?: 'dark' | 'light'
  partner?: string
  fontMono?: string
  /** CSS opacity value for decorative glow. */
  glow?: string
  fontBody?: string
  fontDisplay?: string
  success?: string
  warning?: string
  /** Falls back to primary. */
  focus?: string
  backdrop?: string
}
export { RADIUS_SCALE } from './foundations'
