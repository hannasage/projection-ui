/** Projection's existing dark fallback values. Fonts are supplied by the consumer. */
export const DEFAULT_THEME = {
  bg: '#07090C', surface: '#0D1117', border: '#1B2535', text: '#DDE3EE',
  muted: '#8396AB', primary: '#C9F53A', primaryFg: '#07090C', danger: '#FF5252',
  font: "'IBM Plex Mono', monospace", radius: 'soft',
} as const

export const RADIUS_SCALE = {
  sharp: { sm: '0px', md: '2px', lg: '4px', full: '4px' },
  soft: { sm: '4px', md: '6px', lg: '10px', full: '9999px' },
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
  semantic: { success: '#51CF66', warning: '#FFB347', backdrop: 'rgba(0,0,0,0.55)' },
} as const
