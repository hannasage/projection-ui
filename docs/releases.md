# Release requirements

A release must give consumers a package whose exports, examples, and compatibility claims agree.
The current package version is `0.1.5`.
The repository includes packed-package contract tests.
It does not currently include a release workflow or changelog.

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
The release must also add browser interaction, accessibility, and framework-consumer checks.
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

Use [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) from an approved GitHub Actions workflow.
Trusted publishing authenticates a workflow without a long-lived npm write token.
The package owner configures the exact repository, workflow filename, and optional release environment on npm.

For explicit owner approval before a package goes live, use [npm staged publishing](https://docs.npmjs.com/staged-publishing/).
Staged publishing requires npm 11.15.0 or later and Node 22.14.0 or later.
The owner reviews the staged artifact and approves it with two-factor authentication.
Recheck these requirements before implementing the workflow.

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
