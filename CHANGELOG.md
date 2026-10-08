# Changelog

## 0.2.0-next.1 candidate

This entry describes the local candidate before npm publication.
Existing root imports, required theme fields, CSS variable meanings, and radius presets remain available.
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
The candidate adds no 3D runtime dependency or new default palette.

### Release status

The candidate does not establish a 1.0 stability promise.
Publication and stable promotion require maintainer authorization.
No stable 0.2 release is declared here.

## 0.2.0-next.0 candidate

Initial candidate with shared foundations, split entry points, scoped CSS, interaction fixes, and packed consumer tests.
