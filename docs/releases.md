# Release requirements

A release must give consumers a package whose exports, examples, and compatibility claims agree.
The published baseline is `0.1.5`.
This work prepares `0.2.0-next.0` before stable `0.2.0`.
The [changelog](../CHANGELOG.md) describes the candidate.
The repository includes packed-package contract tests.

## Version scope

For new compatible foundations and components, prepare a `0.2.0` release candidate.
A release candidate is a package version that receives final consumer checks.
Use a prerelease version such as `0.2.0-next.0` under the `next` distribution tag.
A distribution tag is a name that selects a version on npm.
Keep `latest` on the existing release until the final package passes its gates.

A complete 0.2 release does not establish a 1.0 stability promise.
Before a breaking change, agree on its version boundary and publish exact migration steps.
Preserve existing exports, required theme fields, and CSS variable meanings for compatible changes.

## Release artifacts

The release requires:

- A changelog with additions, fixes, compatibility changes, and migration instructions.
- A versioned npm tarball with JavaScript, declarations, token CSS, README, and LICENSE.
- A Git tag and GitHub release that name the source commit and package version.
- A docs build that uses the same release candidate as the consumer tests.
- A recorded supported runtime and framework matrix based on passing checks.

Do not include private application data, credentials, or unrelated development files in the package.
Review sourcemaps before publication because they can include source content.

## Prerelease gates

Run `npm test` to exercise the current package contract.
The current tests include browser interactions, accessibility checks, and framework consumers.
The [CI workflow](../.github/workflows/ci.yml) runs these checks on pull requests and pushes to `main`.
It uses Node 24.11.0 and uploads the checked Storybook build.
A release candidate must pass:

- Effective TypeScript, lint, unit, interaction, and library-build checks.
- The static docs build and its accessibility and responsive checks.
- A tarball inventory with every declared export target present.
- ESM, CommonJS, token CSS, and declaration-resolution tests against the tarball.
- A Vite consumer build and a Next.js consumer build with server and client boundaries.
- Existing-theme and nested-provider compatibility tests.
- A bundle check that keeps declared peers external.
- Security and license reviews of dependencies, assets, workflows, and public artifacts.

Do not substitute source imports for tarball imports in consumer fixtures.
If a gate fails, fix the candidate before publication.

## Publishing identity

The [publish workflow](../.github/workflows/publish.yml) accepts `v0.2.0` and `v0.2.0-next.*` tags.
The tag must match the package version and its changelog entry.
Its verification job runs the package, consumer, browser, and docs gates before packing the candidate.
Its separate publish job downloads that exact tarball; it does not rebuild it.

The publish job uses Node 24.11.0 and npm 11.6.1.
It requires the protected `npm-publish` GitHub environment and [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
Trusted publishing uses OpenID Connect (OIDC), which gives the approved workflow a short-lived identity instead of a stored npm write token.
The package owner must configure the exact repository, workflow filename, and `npm-publish` environment on npm.
The owner must also set the required environment reviewers on GitHub before any release tag is pushed.

The workflow publishes directly after environment approval.
It records provenance, which links the package to its build.
Prerelease versions use `next`; stable `0.2.0` uses `latest`.
The workflow checks that exactly one tarball matches the approved package version.

[npm staged publishing](https://docs.npmjs.com/staged-publishing/) remains an owner option for a separate release process.
It is not used by this workflow.
Do not put npm tokens in examples, issue reports, or workflow logs.
Package publication requires maintainer authorization.

## After publication

1. Make sure that the registry serves the intended version and distribution tag.
2. Download and inspect the published artifact.
3. Install the published version in the consumer fixtures.
4. Make sure that the npm README and package metadata match the release.
5. Make sure that the GitHub release, provenance, and docs deployment match that version.

Provenance records where and how a package was built.
If a released package needs a correction, publish a corrected version and explain the change.
Do not remove an existing version as routine cleanup.
