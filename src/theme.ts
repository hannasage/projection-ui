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
}

export const RADIUS_SCALE: Record<UIRadius, {
  sm:   string
  md:   string
  lg:   string
  full: string
}> = {
  sharp: {
    sm:   '0px',
    md:   '2px',
    lg:   '4px',
    full: '4px',    // no pill in sharp mode — stays angular
  },
  soft: {
    sm:   '4px',
    md:   '6px',
    lg:   '10px',
    full: '9999px',
  },
  rounded: {
    sm:   '10px',
    md:   '16px',
    lg:   '24px',
    full: '9999px',
  },
}
