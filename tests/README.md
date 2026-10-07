# Package contract tests

Run `npm test` after `npm ci`.
The tests build the library, create an npm tarball, and install that tarball in a temporary consumer.
The consumer links existing peer packages from the repository's installation.
It does not import the library's source files or download dependencies.

The tests cover:

- The documented ESM and CommonJS exports.
- The token stylesheet and declaration files in the tarball.
- Server rendering of the documented theme and component composition.
- Every TSX code block in README.md and the Markdown guides under docs.
- A rejected invalid prop that proves the example compiler runs.

The temporary consumer is removed after the test run.
The library build output stays in dist.
These checks cover the package contract. They do not establish browser or accessibility coverage.
