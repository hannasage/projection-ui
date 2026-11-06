import { COASTAL_DAY_THEME, PROJECTION_THEME, THEME_PRESETS } from '@hannasage/projection-ui/core';

// The theme bootstrap script runs before React. Keep its palette through hydration.
export const bootstrapPalette = {
  '--ui-bg': 'var(--color-fd-background)',
  '--ui-surface': 'var(--color-fd-card)',
  '--ui-text': 'var(--color-fd-foreground)',
  '--ui-muted': 'var(--color-fd-muted-foreground)',
  '--ui-border': 'var(--color-fd-border)',
  '--ui-primary': 'var(--color-fd-primary)',
  '--ui-primary-fg': 'var(--color-fd-primary-foreground)',
  '--ui-partner': 'var(--landing-boot-partner)',
  '--ui-accent-end': 'var(--landing-boot-partner)',
  '--ui-accent-text': 'var(--color-fd-foreground)',
  '--ui-gradient-start': 'var(--color-fd-foreground)',
  '--ui-gradient-end': 'color-mix(in srgb, var(--color-fd-foreground) 72%, var(--color-fd-primary))',
};

export const pairs = {
  core: { label: 'Projection / Coastal Day', dark: PROJECTION_THEME, light: COASTAL_DAY_THEME, particles: { dark: '#D8FF87', light: '#086C9E' } },
  ember: { label: 'Ember Tide / Dust & Flame', dark: THEME_PRESETS['ember-tide'], light: THEME_PRESETS['dust-and-flame'], particles: { dark: '#FFB66F', light: '#9B4214' } },
  bloom: { label: 'Noir Bloom / Confetti Studio', dark: THEME_PRESETS['noir-bloom'], light: THEME_PRESETS['confetti-studio'], particles: { dark: '#FF8CCD', light: '#7635A4' } },
};
