# Projection UI editable design kit

This kit contains native Figma components, editable text, variables, styles, and reusable instances.
The version in `design-manifest.json` matches the React package version.

## Import the kit

1. Extract the ZIP archive.
2. Open a design file in the Figma desktop app.
3. Open Plugins → Development → New plugin.
4. Create a Figma design plugin without a user interface.
5. Save the generated files in a new directory.
6. Replace its generated `code.js` with `plugin/code.js` from the kit.
7. Copy the fields from `plugin/manifest.template.json` into its generated `manifest.json`.
8. Keep the `id` field that Figma generated.
9. Run the local plugin from Plugins → Development.

Figma assigns the plugin ID.
The template omits that ID and cannot be imported as a complete manifest.
Read the [Figma manifest reference](https://developers.figma.com/docs/plugins/manifest/) for the supported fields.

The plugin creates a separate page and versioned collections.
The plugin preserves existing pages and stops if its release page already exists.
Install Syne, IBM Plex Sans, and IBM Plex Mono before you import the kit.
The plugin stops before edits if a required font is unavailable.
The plugin makes no network requests.

## Build a mockup

Use the component sets on the imported page to create instances.
Change the Theme property to select the light or dark variant.
Edit instance text with the text tool.
Use the Modern collection for the current Projection and Coastal Day palettes.
Change the Appearance property to select Modern or Flat.
The Flat variants use the matching flat palettes without gradient fills or glow effects.
Both collections use Dark and Light modes.

The design categories are static mockups.
They do not reproduce React behavior or guarantee the same component properties.
Read `design-manifest.json` for the category inventory and the React contracts without a matching design category.
Use the docs and Storybook to test keyboard behavior, focus, motion, and responsive layouts.

## Files

| File | Content |
| --- | --- |
| `plugin/` | Local importer with embedded scene data and a manifest template |
| `source/figma-scene.json` | Original editable scene from the design file |
| `tokens.json` | Current code palettes, spacing, radii, and typography roles |
| `design-manifest.json` | Version, source, coverage, and release cadence |
| `LICENSE` | MIT license for the kit |

The importer retains the original geometry and creates current color bindings for the release.
Groups become editable frames.
The ZIP is an importer package, not a `.fig` file.

## Release cadence

Each alpha minor visual release includes a matching kit.
Each visual revision of an alpha release also includes a matching kit.
Each production major visual release includes a matching kit.
A production minor visual release includes a kit when its release notes specify one.
Keep former kits with their matching versions.
