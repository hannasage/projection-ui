# Package and browser tests

Run `npm ci`, then `npx playwright install chromium` and `npm test`.
The Node test runner builds the library, creates real npm tarballs, and installs them in temporary consumers.
The consumers import public package paths instead of library source files.

The package checks cover:

- Existing exports in ESM, JavaScript's import/export format, and CommonJS, its `require` format.
- Every declared JavaScript, CSS, and type entry, preserved client directives, and the license file.
- Existing theme values and radius presets.
- Server rendering with an existing theme object.
- README and Markdown/MDX TypeScript examples, plus a rejected invalid prop.
- A normal npm installation that supplies package-managed feature dependencies and resolves the combined root entry.
- Core execution without feature modules present, with those modules deliberately omitted from that fixture.
- Strict type resolution with bundler and NodeNext settings.
- A Vite production build and a Next.js App Router production build with server and client components.
- Candidate and stable release tag, version, and changelog verification.

Peer packages are packages supplied by the application.
Most isolated fixtures link the repository's installed packages to avoid another download.
The normal-install check lets npm install the library's runtime dependencies without a peer bypass or symlinks.
It may need registry access.
React 19 and React DOM 19 stay shared application peers.
Core import isolation describes JavaScript imports; it does not remove runtime dependency downloads.

The Chromium browser checks cover:

- Unique field IDs and connected labels, hints, and errors.
- Single switch activation from its track, label, and keyboard.
- Radio arrow keys, disabled choices, and focus order.
- Portal dialogs, nested dismissal, focus confinement and return, and dynamic controls.
- Actual table row ordering, numeric and empty values, and keyboard row activation.
- Sortable keyboard pickup, movement, drop, and announcements.
- Scoped CSS, nested theme focus, and existing CSS variable overrides.
- Toast dismissal and its existing four-second expiry.
- Reduced-motion skeleton and toast rendering.
- Tested accessibility rules from axe, an automated accessibility checker.

Temporary consumers are removed after each test run.
Library output remains in `dist`.
Browser automation supplements application testing; it does not certify accessibility or every browser and assistive device.

# Documentation checks

Run `npm run build:storybook` to compile the stories and build the guides against an installed tarball.
Run `npm run test:storybook` to render the built stories and guides at 390, 768, and 1440 pixels.
The check reports page errors, page overflow, and tested accessibility-rule violations.

Use synthetic data in fixtures and stories.
Keep application records and credentials out of package assets.
Review sourcemaps before publication because they include source content.
