# Release requirements

A release must give consumers a package whose exports, examples, and compatibility claims agree.
The published baseline is `0.1.5`.
This work prepares `0.2.0-next.2` before stable `0.2.0`.
The [changelog](../CHANGELOG.md) describes the candidate.
The repository includes packed-package contract tests.

## Version scope

For new compatible foundations and components, prepare a `0.2.0` release candidate.
A release candidate is a package version that receives final consumer checks.
Use a prerelease version such as `0.2.0-next.2` under the `next` distribution tag.
A distribution tag is a name that selects a version on npm.
Keep `latest` on the existing release until the final package passes its gates.

## Choose a registry version

To stay on the 0.1 patch line, save a bounded version range:

```bash
npm install --save '@hannasage/projection-ui@~0.1.5'
```

`~0.1.5` accepts stable patches from `0.1.5` up to, but not including, `0.2.0`.
It does not select the 0.2 alpha.
The lockfile records the installed version; an existing installation does not update itself.
After a reviewed 0.1 patch appears in the registry, update within that range:

```bash
npm update @hannasage/projection-ui
```

To hold one exact version instead, use `npm install --save-exact @hannasage/projection-ui@0.1.5`.
An exact pin does not accept newer patches until the application changes it.

After the preview is published, inspect the registry channels and install `next` explicitly:

```bash
npm view @hannasage/projection-ui dist-tags
npm install --save-exact @hannasage/projection-ui@next
```

When the registry lists `next`, that label selects the published preview.
Until then, the preview install command is not available.
It does not select an unpublished source version.
This source prepares `0.2.0-next.2`; its release still needs maintainer approval and publication.
Saving the preview exactly keeps later preview changes under the application's control.

The channel policy is separate from permission to publish:

| Package version | npm channel | Publishing path |
| --- | --- | --- |
| Stable `0.1.x` | `legacy` | Reviewed maintenance backport required |
| `0.2.0-next.N` | `next` | Current approved release workflow |
| Stable `0.2.x` | `latest` | Current workflow covers `0.2.0`; later patches need their release gates reviewed |

A channel is a movable registry label, not a version range.
Future 0.1 patches use `legacy` and must never move `latest` back from 0.2.
The bounded 0.1 range finds those patches by version even when `latest` points elsewhere.
Existing `latest` stays on `0.1.5` until an approved stable 0.2 release changes it.

A complete 0.2 release does not establish a 1.0 stability promise.
Before a breaking change, agree on its version boundary and publish exact migration steps.
Preserve existing exports, required theme fields, and CSS variable meanings for compatible changes.

## Maintenance branches

Keep the 0.2 candidate on its feature branch through review.
After the reviewed release merges, `main` holds the current development line.
Create a separate 0.1 maintenance branch when a patch is needed.
A backport applies a current fix to an earlier version.
Use separate pull requests for backports and test each packed version.
Keep new themes and components on the current line.

The published `0.1.5` package identifies [this exact source commit](https://github.com/hannasage/projection-ui/commit/8362d8b36b8d4928525aac16ebf5cc382e862f2c).
Start the maintenance branch from that commit, not the current candidate.
Release a correction as a new `0.1.x` patch version.
The current publishing workflow accepts only the reviewed `0.2.0` release line.
Its verifier rejects 0.1 packages before calling npm, even when the requested action is publication.
The channel classifier recognizes legacy versions but does not authorize their release.

Before publishing the first 0.1 patch:

1. Create the maintenance branch from the exact published commit above.
2. Apply only the compatible fix, its regression tests, and the new patch version and changelog entry.
3. Backport the release-channel helper. Review a maintenance verification path against the historical API, exports, peer requirements, and packed artifact.
4. Review the workflow change that accepts the maintenance tags and publishes only its checked tarball under `legacy`.
5. Keep the existing `publish.yml` workflow identity, protected `npm-publish` environment, provenance, and owner approval. Check the npm trusted-publisher settings before enabling the path.

The historical source has no test command or current docs/design-kit pipeline.
Do not route a legacy tag through the modern docs or design-kit gates.
Do not bypass the current verifier to publish a renamed modern package as a legacy patch.
These steps prepare a future backport; this change does not create a maintenance checkout or publish a 0.1 patch.

Existing source tags stay unchanged.
The older `v0.2.0-next.1` tag does not identify this candidate.
The reviewed candidate needs a fresh `v0.2.0-next.2` tag after maintainer approval.
This project does not promise a support deadline or release schedule.

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
It uses Node 24.11.0 and uploads the checked Fumadocs static site, including its component explorer.
A release candidate must pass:

- Effective TypeScript, lint, unit, interaction, and library-build checks.
- The static docs build and its accessibility and responsive checks.
- The Fumadocs reader, local search, plain Markdown, and embedded packed examples.
- A tarball inventory with every declared export target present.
- ESM, CommonJS, token CSS, and declaration-resolution tests against the tarball.
- A Vite consumer build and a Next.js consumer build with server and client boundaries.
- Existing-theme and nested-provider compatibility tests.
- A bundle check that keeps shared React peers and package-managed runtime dependencies external.
- Security and license reviews of dependencies, assets, workflows, and public artifacts.

Do not substitute source imports for tarball imports in consumer fixtures.
If a gate fails, fix the candidate before publication.

## Publishing identity

The [publish workflow](../.github/workflows/publish.yml) accepts `v0.2.0` and `v0.2.0-next.*` tags.
The tag must match the package version and its changelog entry.
Its verification job runs the package, consumer, browser, and docs gates before packing the candidate.
The final artifact check compares its integrity with the documentation package, then repeats consumer tests without rebuilding the library.
It checks the reviewed package files and rejects declarations that import local `node_modules` paths.
The checked versioned archive appears in `release-artifacts`.
Its separate publish job downloads that exact tarball; it does not rebuild it.

The publish job uses Node 24.11.0 and npm 11.6.1.
It requires the protected `npm-publish` GitHub environment and [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
Trusted publishing uses OpenID Connect (OIDC), which gives the approved workflow a short-lived identity instead of a stored npm write token.
The package owner must configure the exact repository, workflow filename, and `npm-publish` environment on npm.
The owner must also set the required environment reviewers on GitHub before any release tag is pushed.

The workflow publishes directly after environment approval.
It records provenance, which links the package to its build.
The shared channel classifier selects `next` for the accepted prerelease versions and `latest` for stable `0.2.0`.
Legacy publication remains blocked until its separate maintenance gates receive review.
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
