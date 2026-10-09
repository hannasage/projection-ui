import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as foundations from '../src/foundations.ts';

test('approved presets keep all fourteen palettes and paired accents', () => {
  assert.equal(Object.keys(foundations.THEME_PRESETS ?? {}).length, 14);
  assert.equal(foundations.DEFAULT_THEME.font, "'IBM Plex Mono', monospace");
  assert.equal(foundations.PROJECTION_THEME.primaryFg, '#17202A');
  assert.equal(foundations.PROJECTION_THEME.partner, '#35F5AA');
  assert.equal(foundations.FERNWOOD_THEME.bg, '#F3F6F5');
  assert.equal(foundations.FERNWOOD_THEME.partner, '#35EB88');
  for (const theme of Object.values(foundations.THEME_PRESETS)) {
    assert.equal(theme.danger, '#FF3D6A');
    assert.equal(theme.success, '#35F5AA');
    assert.match(theme.fontBody, /IBM Plex Sans/);
    assert.match(theme.fontDisplay, /Syne/);
    assert.match(theme.fontMono, /IBM Plex Mono/);
  }
});
test('soft separates panel and control radii', () => {
  assert.equal(foundations.RADIUS_SCALE.soft.md, '6px');
  assert.equal(foundations.RADIUS_SCALE.soft.lg, '16px');
});
test('flat core themes preserve the released palettes', () => {
  assert.equal(foundations.PROJECTION_FLAT_THEME.primaryFg, '#07090C');
  assert.equal(foundations.PROJECTION_FLAT_THEME.danger, '#FF5252');
  assert.equal(foundations.FERNWOOD_FLAT_THEME.bg, '#fdf6e3');
  assert.equal(foundations.FERNWOOD_FLAT_THEME.primary, '#859900');
  assert.equal(foundations.FERNWOOD_FLAT_THEME.primaryFg, '#ffffff');
  assert.equal(foundations.FERNWOOD_FLAT_THEME.font, "'IBM Plex Mono', monospace");
  assert.equal(foundations.PROJECTION_THEME.partner, '#35F5AA');
});
test('Coastal Day is the primary light theme and Fernwood remains available', () => {
  assert.equal(foundations.COASTAL_DAY_THEME, foundations.THEME_PRESETS['coastal-day']);
  assert.equal(foundations.PROJECTION_LIGHT_THEME, foundations.COASTAL_DAY_THEME);
  assert.equal(foundations.PROJECTION_LIGHT_THEME.name, 'Coastal Day');
  assert.equal(foundations.PROJECTION_LIGHT_THEME.primary, '#00C8FF');
  assert.equal(foundations.PROJECTION_LIGHT_THEME.partner, '#397BFF');
  assert.equal(foundations.PROJECTION_LIGHT_THEME.bg, '#F6FBFF');
  assert.equal(foundations.PROJECTION_LIGHT_THEME.surface, '#FFFFFF');
  assert.equal(foundations.FERNWOOD_THEME.name, 'Fernwood');
  assert.equal(foundations.THEME_PRESETS['projection-light'], foundations.FERNWOOD_THEME);
  assert.notEqual(foundations.FERNWOOD_THEME, foundations.PROJECTION_LIGHT_THEME);
  assert.equal(foundations.PROJECTION_LIGHT_FLAT_THEME, foundations.FERNWOOD_FLAT_THEME);
  assert.equal(foundations.FERNWOOD_FLAT_THEME.name, 'Fernwood Flat');
  assert.equal(foundations.THEME_PRESETS.projection, foundations.PROJECTION_THEME);
  assert.equal(foundations.DEFAULT_THEME.mode, 'dark');
  assert.equal(new Set(Object.values(foundations.THEME_PRESETS).map(theme => theme.name)).size, 14);
});
