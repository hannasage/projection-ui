# Changelog

## 0.2.0-next.1 unpublished alpha

- Add 14 theme presets, with Projection as the default dark theme and Projection Light as its silver white pair.
- Add flat modes that retain the v0.1 palettes for the core pair.
- Add Surface, GradientBackground, and GradientText with scoped glass, edge light, and underglow styles.
- Add Avatar, Checkbox, RadioGroup, Tabs, Accordion, Alert, Notification, Progress, Spinner, Tooltip, and Carousel.
- Add material choices to Card and gradient or solid appearance to Button.
- Use Syne for titles, IBM Plex Sans for reading and controls, and IBM Plex Mono for labels and code.
- Add the paired 49-category gallery, theme explorer, and packed stories to the documentation preview.
- Export DEFAULT_CHART_COLORS from the chart and root entries. The first color follows the theme primary color.
- Add mouse proximity glow to area, bar, donut, and line marks. Reduced motion, forced colors, touch, and pen skip the decorative effect.
- Keep chart labels in the theme text color and show series colors in swatches.
- Keep nonempty custom chart colors unchanged; empty strings use the shared palette.
- Give each area chart its own gradient IDs.

### Package foundations

This entry describes the local alpha before npm publication.
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

### Interaction fixes

- Add unique field identifiers and associated labels, hints, and errors.
- Use one native switch control for pointer and keyboard activation.
- Add radio-group arrow keys and focus management.
- Add sortable keyboard pickup, movement, drop, cancellation, and position announcements.
- Contain dialog focus, dismiss the top dialog, and return focus to its opener.
- Order table rows during sorting and preserve keyboard row activation.
- Add sortValue and compare column options and an accessible table label.
- Respect reduced motion for skeletons, notifications, and control transitions.

### Compatibility

The package retains the required feature peers for npm installation.
Subpaths isolate bundle imports without changing that install contract.
The core and foundation entries exclude chart, drag, and toast implementations.
Optional font roles fall back to the existing font field.
The `/tokens` entry retains legacy page rules.
The candidate adds no 3D runtime dependency.
The default gains the approved neon design values. Flat presets retain the earlier core palettes.

### Release status

The candidate does not establish a 1.0 stability promise.
Publication and stable promotion require maintainer authorization.
No stable 0.2 release is declared here.

## 0.2.0-next.0 candidate

Initial candidate with shared foundations, split entry points, scoped CSS, interaction fixes, and packed consumer tests.
