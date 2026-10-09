# Contributing

Projection UI accepts bug reports, documentation corrections, and proposals for reusable React components.
A proposal does not guarantee that a change will enter the package.

## Start a change

1. Search the [existing issues](https://github.com/hannasage/projection-ui/issues).
2. If the change adds an API or dependency, open an issue before implementation.
3. Describe the problem, a small example, and the expected result.
4. Fork the repository and create a branch for the change.

A reusable component takes data through props and uses the library's theme values.
Application routes, business data, and custom 3D scenes belong in consuming applications.

## Develop locally

Follow the commands in [the development guide](docs/development.md).
Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before you submit a change.
The package tests install a real tarball in a temporary consumer and check imports, rendering, assets, declarations, and documentation examples.
They do not replace browser interaction or accessibility tests.

For a component change:

- Keep existing exports and theme fields compatible.
- Define and export the public prop types.
- Use named exports and `--ui-*` variables for shared visual values.
- Add a Storybook story for each new state or interaction.
- Test keyboard use, labels, focus, theme overrides, and reduced motion in the preview.
- Add regression tests for behavior changes.
- Update the component guide and examples with the actual API.

A regression test repeats the behavior that a fix must preserve.
For a package or example change, extend the checks in `tests/package-contract.test.mjs`.
If a browser interaction needs a new test tool, include that setup in the proposal.

## Submit a pull request

Explain the problem, the change, and the commands that you ran.
Include screenshots for a visual change and steps to reproduce an interaction change.
State any compatibility change or check that you did not complete.
Keep unrelated changes in separate pull requests.

The maintainer reviews changes as time allows.
This project does not publish a response-time promise.
A pull request is not permission to publish a package version.

## Work respectfully

Discuss the code and the result, not the contributor's identity or intent.
Do not post credentials, private customer data, or private application screenshots.
Use [the security guide](SECURITY.md) for a vulnerability.
