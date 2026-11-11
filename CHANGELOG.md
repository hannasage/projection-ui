# Changelog

## Unreleased

- Add a Stability page that lists the frozen items, the items that are not frozen, the prerelease rule, and the change policy. The `./motion` entry is frozen by name and arrives with the motion milestone.
- Complete the Migration page with a step for each change since 0.1.5: the soft panel radius, the Modal heading id and styling, the ButtonGroup role, Toggle accessibility, Toast announcements and timing, the larger `/tokens` output, and the client boundary.
- Fix the Migration page wording to match the `1.0.0-beta` line.
- Add an export snapshot test that compares each entry's named exports with the packed package. It also snapshots declaration exports, the required `UITheme` fields, and the `UIRadius` values.
- Add a migration-list test that requires a Migration heading for each listed breaking change.
- Add the Stability page to the docs navigation and the docs route checks.

## 1.0.0-beta.0 first beta

This is the first beta of v1.
It moves the prerelease channel from `next` to `beta` and sets the version line to 1.0.0.

- Publish prereleases under the npm `beta` tag instead of `next`.
- Name prerelease versions `1.0.0-beta.N`, and stable v1 versions `1.x.y` under `latest`.
- Accept the `v1.0.0` and `v1.0.0-beta.*` release tags.
- Name the matching design kit `projection-ui-design-1.0.0-beta.0.zip`.
- Label the current documentation edition `1.0.0`, marked Beta.
- Keep the `0.1.x` line on the `legacy` channel.
- The `0.2.0-next.*` entries below stay as history. Only `0.2.0-next.2` reached npm, on 2026-10-09 under the `next` tag. It is now deprecated and the `next` tag is removed.

## 0.2.0-next.2 alpha candidate

This candidate includes the earlier unpublished alpha work and the final review changes.

- Add theme presets, with Projection as the default dark theme and Coastal Day as its blue light pair.
- Keep Fernwood as the green light preset and preserve the original flat palettes.
- Add Coastal Day Flat with the original coastal base colors and a solid neon blue accent.
- Retain the original Projection Flat and Fernwood Flat palettes.
- Add Surface, GradientBackground, and GradientText with scoped glass, edge light, and underglow styles.
- Add Avatar, Checkbox, RadioGroup, Tabs, Accordion, Alert, Notification, Progress, Spinner, Tooltip, and Carousel.
- Add material choices to Card and gradient or solid appearance to Button.
- Add an optional gradient appearance to LinkButton. Existing links keep their solid appearance.
- Add navbar underglow and falling 2D sparkles to the landing preview, with theme colors, pause controls, and motion safeguards.
- Put the AI prompt first on the landing, with button proximity light and a restrained scroll composition.
- Add three gradient palette swatches and a dark, light, or system mode control for the landing.
- Add four musical appearance cues to the landing, with random pairs, repeat prevention, mute controls, and cancellation when the selected style changes.
- Use Syne for titles, IBM Plex Sans for reading and controls, and IBM Plex Mono for labels and code.
- Add the paired 49-category gallery, theme explorer, and packed stories to the documentation preview.
- Export DEFAULT_CHART_COLORS from the chart and root entries. The first color follows the theme primary color.
- Add mouse proximity glow to area, bar, donut, and line marks. Reduced motion, forced colors, touch, and pen skip the decorative effect.
- Keep chart labels in the theme text color and show series colors in swatches.
- Keep nonempty custom chart colors unchanged; empty strings use the shared palette.
- Give each area chart its own gradient IDs.
- Install chart, sorting, and toast dependencies automatically while sharing React with the application.
- Test consumer installations with empty npm caches.
- Add rendered component examples and themed visual elements to the README.
- Keep underglow outside the surface so that it does not wash across glass or content.
- Use subtler core gradients across surfaces, fields, and active controls.
- Lighten Coastal Day's blue partner and shift Projection's partner toward yellow-green.

### Package foundations

This entry describes the alpha candidate.
Existing root imports, required theme fields, and CSS variable meanings remain available.
The soft panel radius changes from 10px to 16px. Control radii remain unchanged.
Read [Migration](docs/pages/Migration.mdx) before an upgrade.

### Additions

- Add `/core`, `/charts`, `/sortable`, `/toast`, and `/foundations` entry points.
- Add Container, Stack, Prose, LinkButton, Separator, and VisuallyHidden to the core entry.
- Add ProjectionGlow as a decorative light field with an inherited accent and a still default.
- Offer one opt-in reveal that respects reduced motion and hides decorative light in forced colors.
- Export DEFAULT_THEME and UI_FOUNDATIONS from the shared foundation source.
- Add optional fontBody, fontDisplay, success, warning, focus, and backdrop theme fields.
- Add `/styles` for scoped component rules and `/reset` for explicit page rules.
- Add authored Storybook guides and stories for every public React component.
- Build documentation and consumer fixtures against a packed candidate.
- Add a Fumadocs static reader with local search, plain Markdown, and a text index.
- Share guide content and component contracts between the reader and component explorer.
- Verify reader navigation, code copying, links, and accessibility at three screen widths.
- Add a documentation version switcher and preserve the published 0.1.5 source and guides.
- Match reader examples and Storybook previews to the selected light or dark theme.
- Add Storybook Controls, Actions, Interactions, accessibility scans, viewport choices, and layout tools.
- Add a versioned Figma kit with 49 editable component sets and Modern, Flat, Dark, and Light choices.
- Preserve matching design downloads on GitHub Releases after approved npm publication.
- Group alpha documentation under one evolving 0.2.0 edition with an Alpha badge.
- Document npm installation, exact alpha pins, and a separate 0.1 patch range.
- Keep alpha publication on next and reserve a separate legacy channel for reviewed 0.1 patches.
- Add themed gradient headings and light trails to the landing page, with quiet gradient headings in the docs.
- Keep the selected palette during theme startup and remove decorative trails in Flat mode.

### Interaction fixes

- Add unique field identifiers and associated labels, hints, and errors.
- Use one native switch control for pointer and keyboard activation.
- Add radio-group arrow keys and focus management.
- Add sortable keyboard pickup, movement, drop, cancellation, and position announcements.
- Contain dialog focus, dismiss the top dialog, and return focus to its opener.
- Order table rows during sorting and preserve keyboard row activation.
- Add sortValue and compare column options and an accessible table label.
- Respect reduced motion for skeletons, notifications, and control transitions.
- Improve light danger text on actions and field errors while preserving the original danger palettes and borders.

### Compatibility

The package manages Recharts, react-is, dnd-kit, and Zustand as runtime dependencies.
npm installs them automatically with Projection UI.
React 19 and React DOM 19 remain shared application peers.
Subpaths isolate JavaScript imports without removing dependency downloads.
The core and foundation entries exclude chart, drag, and toast implementations.
Optional font roles fall back to the existing font field.
The `/tokens` entry retains legacy page rules.
The candidate adds no 3D runtime dependency.
The default gains the neon design values.
Projection Flat and Fernwood Flat retain the earlier core palettes.
Coastal Day Flat uses the earlier coastal base colors with a neon blue accent.

### Release status

The candidate does not establish a 1.0 stability promise.
Publication and stable promotion require maintainer authorization.
No stable 0.2 release is declared here.

## 0.2.0-next.1 source checkpoint

Unpublished checkpoint for the Fumadocs reader, ProjectionGlow, and the initial alpha package.
The existing source tag remains unchanged.

## 0.2.0-next.0 candidate

Initial candidate with shared foundations, split entry points, scoped CSS, interaction fixes, and packed consumer tests.
