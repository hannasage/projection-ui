# Projection UI repository guide

Projection UI provides consumer-themed React components and design tokens.
This repository is public.
The source, package declarations, and executable tests define the current API.

## Read first

Read `README.md`, `CONTRIBUTING.md`, and the guide that matches the change.
The component reference is `docs/components.md`.
Theme behavior is in `docs/theming.md`.
Compatibility is in `docs/compatibility.md`.
The release contract is in `docs/releases.md`.

## Package scope

Keep application routes, career content, and 3D scenes in consuming applications.
Keep React and feature peers external to the library bundle.
Preserve existing exports, required theme fields, and CSS variable meanings unless an approved migration replaces them.
Use scoped theme values for new component styling.

## Claims and examples

Make sure that every example compiles against the package artifact.
Describe implemented behavior rather than intended behavior.
Do not claim accessibility compliance, focus containment, contrast enforcement, or framework support without passing evidence.
The current interaction limits are documented in the component reference.
Keep private records, credentials, and internal operating notes out of every public file.

## Changes

Work on a feature branch and open a draft pull request.
Run the commands in `docs/development.md` before a commit.
New runtime behavior needs tests.
A public API change needs a documented compatibility path and release note.
Package publication requires maintainer authorization.

Use the issue forms for reproducible bugs and bounded requests.
Use `FEEDBACK.md` for design feedback and `SECURITY.md` for private disclosure.
