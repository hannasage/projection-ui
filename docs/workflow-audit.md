# Workflow audit

This page lists the steps that people and agents repeat in this repository.
For each one it says whether a script should do the work or an agent should keep doing it.

## The test for a script

A step should become a script when all three of these are true:

- It runs in the same order every time.
- It needs no judgment. The result is pass or fail.
- Its inputs are known before it starts.

If the next step depends on what the last step found, or if a person must choose, the step stays an agent task.
An agent can run a script, read its output, and try another approach. The script never decides for the agent.

## Words used on this page

- A token is a small piece of text that a language model reads or writes. One token is about four characters of English.
- A safety class says what a script may change. There are four.
  - `read-only` reads files, git, or the network. It changes nothing.
  - `local-write` changes files in the working tree, in the git folder, or in a clone tree.
  - `remote-write` pushes, comments, labels, or opens a pull request.
  - `human-only` publishes, deploys, spends money, logs in, pushes a release tag, or handles a secret. An agent never runs it.
- A gate is a check that must pass before work moves on. Here the gates are the list in `release.config.json`: tokens:check, typecheck, lint, test, build, build:docs, test:docs, and test:artifact.
- A clone tree is a separate folder with its own checkout of a branch. A task works in one so that it does not disturb other work.
- A draft pull request is a pull request that cannot be merged until someone marks it ready.
- A release tag is a git tag such as `v1.0.0-beta.0`. In this repository, pushing a matching tag starts `.github/workflows/publish.yml`, and that workflow publishes the package.
- A design kit is the zip file of editable Figma components that ships with each release.

## The table

All token figures are estimates. They are ranges, not measurements. See "How the estimates were made" below.

| Name | Steps | How often | Estimated tokens saved per run | Safety class | Inputs | Outputs | Decision |
|---|---|---|---|---|---|---|---|
| Full gate run | Run the gates listed in `release.config.json`: tokens:check, typecheck, lint, test, build, build:docs, test:docs, and test:artifact. Read each result. Report the exit code of each. | Before every commit and every pull request. Several times per task. | 2,000 to 9,000 | local-write | The top folder of a work tree of this package. Optional flag to run `npm ci` first. | One PASS or FAIL line per gate with the real exit code. Optional JSON. | script. Built as `tools/gates.mjs`, which runs the same gate list as `release gates` and reports the real exit code of each. |
| PR open with the standard body | Check the title and the body rules. Run `gh pr create --draft`. Read the result. | Once per task, plus a retry when the body breaks a rule. | 500 to 2,000 | remote-write | A title, a body file, and a base branch. | The pull request URL, or a list of text problems. | script. Built as `tools/pr-open.mjs`, which checks fixed rules, prints the gh identity, and opens only drafts. |
| Tree cleanliness check | Run `git status`, look for stash entries and for ignored files that a build does not recreate, compare every local branch with the remotes, and look for processes inside the folder. | Once per clone tree, before it is removed. | 800 to 2,000 | read-only | The top folder of a clone tree. | Three lines (clean, pushed, idle) and an exit code. | script. Built as `tools/tree-clean.mjs`, which removes nothing, because removal stays in the factory-tree finish step of the workbench scripts. |
| Release preflight, verify, and claims | Check the branch, the tree, the version rules, and the publish workflow. Read the registry. Install the package into a clean project. Load every entry. Search the docs for stale claims. | Once per release, plus a rerun after each fix. | 8,000 to 25,000 per release | local-write for preflight and verify. read-only for claims and status. | `release.config.json` and the repository. | One result per step, with an exit code. Optional JSON. | script. Built as `scripts/release.mjs`, which checks that the workflow agrees with the config and never pushes a tag or publishes. |
| Release gates and dry run | Run the gates from the config, then `npm publish --dry-run`. Check the file count, the size, and the tag. | Once per release, plus a rerun after each fix. | 3,000 to 10,000 per release | local-write | `release.config.json` and a clean tree. | One result per step, with an exit code. | script. Built into `scripts/release.mjs`, which records a result only when the tree is clean before and after. |
| Release tag and publish | Push the release tag. Approve the protected environment on GitHub. Watch the workflow. | Once per release. | 0. A person decides. | human-only | A verified commit. | A pushed tag and a published package. | keep as agent task. An agent only prepares it, because a person must push the tag that starts the real publish. |
| Design kit zip check | Find the zip, check that its name has the release version, check that it is the only zip, and compare its size and SHA-256 with the metadata file. | Once per release. | 800 to 2,000 | local-write | The built docs folder. | A pass, or the first problem. | script. Built into the release dry run and verify steps, and it reads the zip entries and compares them with the source scene. |
| Docs edition check | Check that the docs edition in the source and the built docs show the release version. | Once per release. | 500 to 1,500 | local-write | `docs-site/lib/versions.mjs` and the built docs folder. | A pass, or the first problem. | script. Built into the release preflight, dry run, and verify steps, and it compares the built changelog with the source. |
| Version move across files | Change the version in `package.json`, the lock file, the docs, the badges, the tests, and the publish workflow filters. Run the tests. | Once per release line. The move to 1.0.0-beta.0 touched about 30 files. | 3,000 to 8,000 | local-write | The new version. | A list of changed files and a test result. | script. Not built yet, because the replacements need review, so a script would print the edits and a person would approve them. |
| Retire the old alpha | Deprecate the old alpha and remove the next tag, after verify passes. Do not touch latest. | Once, after the first beta is verified. | 500 to 1,500 | human-only | The registry state. | A deprecation notice and a removed tag. | keep as agent task. The script prints the commands and a person decides, because what happens to the old alpha and to latest is the choice of the owner. |
| Docs-site three-viewport screenshots | Build the docs. Open each page at 390, 768, and 1440 pixels. Look at the pictures. Judge the result. | When a page or a style changes. | 0. The judgment is the work. | read-only | The built docs site. | Pictures and a verdict. | keep as agent task. `npm run test:docs` already checks overflow at the three widths, but deciding whether a page looks right needs judgment. |
| Release-publish-path test failure in the full local run | Run `npm test`. See `tests/release-publish-path.test.mjs` fail. Run that file alone and see it pass. Notice that CI is green. | Now and then, on this machine only. | 0. The cause is found and fixed. | local-write | The test logs. | A diagnosis and a fix. | keep as agent task. The test ran `npm publish --dry-run`, which asks the registry once, so with the registry unreachable it waited 70 seconds past its 30 second limit, and it now points at a closed local port with no retries. |
| Token file refresh | Run the token generator and commit the result. | When a theme value changes. | 0 new. Already scripted. | local-write | The foundation source. | The generated token files. | script. Already built as `npm run tokens`, with `npm run tokens:check` in CI. |

## How the estimates were made

The ranges are rough guesses and they are not measured.
The low end assumes an agent reads a short log and makes no mistake.
The high end assumes it reads a long log, such as a full test run, and retries once.
A script replaces that reading with a few lines of output.
The saving is the reading and the retries, minus the cost of the few lines.
The release rows are larger because one release has about 30 commands, and an agent would read the output of each.
To replace these guesses with facts, sum the token usage of a few real runs before and after.

## What is built in this lane

- `scripts/release.mjs` and `release.config.json`. Run `npm run release -- status` to see what is left.
- `tools/gates.mjs`. Run `npm run gates`.
- `tools/pr-open.mjs`. Run `npm run pr-open -- --title ... --body-file ... --base ...`.
- `tools/tree-clean.mjs`. Run `npm run tree-clean -- <tree>`.
- `tools/manifest.json` lists every script with its arguments, its output shape, its safety class, whether it is destructive, and what it writes. Its `mcp_exposure` field says whether a later MCP server may list the tool: only `release status`, `release claims`, and `tree-clean` are `expose`, every other tool is `hidden`, and a tool with no field counts as hidden.
  A test checks that each listed file exists, that every `tools/*.mjs` file is listed, and that each class matches what the script does when it runs.

## Rules that every script follows

- It prints the exact command before it runs it.
- Exit code 0 means pass, 1 means a check failed, and 2 means the script was used the wrong way.
- It can run again. A finished release step prints `already done`.
- It stops at the first failed step and prints the first failing line.
- It never reads, stores, or prints a token, a password, or a one-time code. The commands it starts do not receive registry or GitHub tokens.
- Every path argument is resolved first. A path that does not exist, or that is not the top of a work tree of this package, is refused.
- Tests use a temporary repository and a fake `npm` and `gh`. They never reach a real registry or a real remote.

## Safety notes

- The release tag is human-only here. A tag push starts the publish workflow, which is a real publish. The script prints the exact `git tag` and `git push` commands, refuses without a terminal, and runs nothing even with one. The decision is recorded for this repository.
- The script does not replace `.github/workflows/publish.yml`. It reads the workflow and fails if the tag filters would not start it for the release tag, or if the verify job lacks a gate that the script runs.
- The version rules come from `scripts/release-channel.mjs`, which the script runs in a child process and does not import, and from `scripts/verify-release.mjs`, which the script also runs in a child process with the tag it would print. Neither is copied.
- `preflight`, `gates`, `dry-run`, and `verify` write a small note named `release-state.json` inside the git folder.
  It holds a commit hash and a hash of the lock file, and no secret. Nothing treats it as proof. It only lets a finished step print `already done`.
  The `tag` step re-checks the branch live and shows the note only as evidence for the person.
  Because they write it, these four steps are `local-write`.
- `preflight` runs `git fetch`, which updates the remote-tracking branches in the local repository.
- `verify` reads the registry first, every time. It installs into a temporary project outside the repository with scripts turned off and a cleaned environment, and it removes the project when it finishes.
- `tree-clean` compares with the last fetch. It does not fetch, so run `git fetch` first if the remote may have changed.
  It allows ignored files only when a build recreates them (`node_modules`, `dist`, `.next`, `storybook-static`, `release-artifacts`, and the docs build folders). Any other ignored file, such as a local settings file, fails the check.
- The file count (71) and the size limit (160,000 bytes, about 28 percent above the measured 124,672) in `release.config.json` were measured from a real build of 1.0.0-beta.0 with `npm run build`, then `npm pack --dry-run --json --ignore-scripts`. The count is `entryCount` and the size is `size`. Measure again when the package contents change on purpose.
- `status` reports the tag phase as done only when the local tag and the remote tag both point at the commit that preflight recorded. The tag is pushed by a person, so `status` only reports.
- No output holds a home path. The script runs `node` by name and prints paths relative to the repository.
- Human-only steps still run read-only checks before they refuse. `release publish` runs `npm view`, `release tag` runs `git ls-remote` and other reads, and `release retire` runs `git rev-parse` and `npm view`. They run no write command.
- The version rules and the docs edition module are loaded in child processes, never inside the release script. The script pins `scripts/verify-release.mjs` and `docs-site/lib/versions.mjs` to those literal paths, and it fails when the verifier is empty or missing.
- Every child process gets an allowlist environment (PATH, a throwaway HOME, LANG, TERM, CI) and the user npm config is turned off. The allowlist and the throwaway HOME stop the usual places. A child can still read any file by its absolute path, because the tools run no sandbox. Treat the trees you point them at as trusted.
- The `pr-open` tool is the one exception to the throwaway HOME. gh keeps its login in its own config folder, so gh gets the real HOME and no token variable. The tool prints which gh identity it uses before it creates anything.
- `verify` installs the react and react-dom versions that `package-lock.json` pins, compares the installed entries with the entries in `package.json`, and checks that every target file exists.
- The tools accept a folder only when it is the top of a work tree whose `package.json` is a regular file with this package name. That name is a guard against a wrong folder and not a proof of identity, because anyone can write it.
- The design kit check lists the entries of the zip, reads its manifest, and compares the scene hash with the source scene. The built docs check compares the built changelog with `CHANGELOG.md`, so a stale build of the same version fails. `claims` ignores letter case, fails on an empty configured folder, and keeps `docs/archive` out of the search because that folder holds the preserved 0.1.5 documentation. The reason is also written in `release.config.json`.
- A child that runs too long is stopped. Git and registry reads get 120 seconds, and each gate gets 15 minutes.
- The command lines that the script prints show `node` by name, and a long child program is shown as a short label in angle brackets.
- A file left in the design kit folder by an earlier build makes `dry-run` and `verify` fail. The message names the file and says to delete it by hand, and the script deletes nothing. The repository build script does not clear that folder, and this lane does not change it.
- `release status` and `release claims` write nothing. npm runs there with a throwaway HOME, cache, and log folder that the script removes at the end. `tree-clean` writes nothing either, and it reads the remote tags with `git ls-remote`.
- The environment variable `SAGE_BODY_DIR` may name one more folder for the body file of `pr-open`. The folder must exist and may not be the root of the disk or a home folder.
- The design kit check and the docs edition check run inside the local-write steps (preflight, gates, dry-run, and verify), so they are listed as local-write and not as read-only.
- A gate step in the publish workflow may not set `working-directory` or `shell`, and the workflow may not set default run settings, unless `release.config.json` lists the step under `workflow.justified`.
- Every `npm view` runs in the throwaway folder and not in the repository, so a project `.npmrc` cannot redirect it, and it names the public registry. The user config and the global config of npm are two different empty files, because npm 11 refuses one file loaded as both.
- A 404 from the registry counts as "not published yet" only when the package is public, no verify record says it was published, `package.json` has the same name, and the registry is the public one. Otherwise the phase is unknown and `status` exits 1. Setting `RELEASE_REGISTRY` to any other registry makes every registry read untrusted, with a warning.
- `verify` installs from the named registry and compares the installed integrity with the integrity that `npm view` reports for the version.
- `tree-clean` refuses a tree whose own git config has a key that can make git run a program (a filter, a diff or merge driver, an external diff, an attributes file, a signing program, a credential helper, an ssh or proxy command, or an include) or that hides submodule changes, and it names the key. It also refuses a tree that has a `.gitmodules` file, a modules folder in any git folder, or any gitlink entry, because git status would run the filters of a nested repository. It shows every untracked file whatever the config says, and it fails on a file marked assume-unchanged or skip-worktree.
- `pr-open` takes `--expect-identity <login>`. An identity read that fails with "Resource not accessible by integration" (a GitHub App token) is only a warning, and only without that flag. Any other identity failure stops the run.
- `pr-open` says "a PR may exist: check before retrying" only where gh may have got as far as creating one: a timeout, an exit 0 with no address, a failed exit whose output shows a pull request address, or a spawn error that is not "no such program" or "no permission". A body or a title that holds something shaped like a secret is refused before gh is called.
- The publish workflow runs more checks than the release script: `release.config.json` lists them under `ciOnlyGates` with a reason (the Playwright install and the Storybook and docs theme tests need a browser). `gates`, `dry-run`, and `status` print a warning and put it in the JSON `warnings`: "CI also runs: ... Run them before you push a tag, because a tag cannot be moved." Preflight fails when the verify job of the workflow runs a command that is in neither `gates` nor `ciOnlyGates`, or when a listed one is missing from the workflow. The safety control for everything that publishes is a content pin, not this check. `workflow.pins` in `release.config.json` lists three files with a SHA-256 each: `.github/workflows/publish.yml`, `scripts/verify-release.mjs` (it runs with `id-token: write`), and `scripts/publish-design-release.mjs` (it runs with `contents: write`). The script reads each file as bytes. For the workflow it turns CRLF into LF and cuts trailing spaces and tabs from each line, and it refuses any non-ASCII byte, any lone CR, and any other control byte, so a Unicode space cannot hide a change. It hashes the two scripts byte for byte. `preflight`, `gates`, `dry-run`, the `tag` step, and `status` fail when a hash differs. The message tells a person to review the change by hand and then update the pin. An agent never updates it. `.github/CODEOWNERS` asks the owner to review changes to the config, the workflows, `scripts/`, and `tools/`. GitHub enforces that file only when branch protection requires review from code owners. The owner chooses that setting and this repository does not change it. The repository has no YAML parser, so the line reader in `tools/lib/workflow.mjs` only extracts the tag filters and the `run:` lines for the gate agreement and its warning. It does not prove that the workflow is safe, because YAML has many forms that a line reader misses, such as quoted keys, flow maps, merge keys, and several documents.
- `tools/manifest.json` has the `safety_classes` and `exit_codes` blocks of the factory manifest and an `agent_settable` field on every argument. A path argument such as `<tree>` or `--dir` is not agent-settable, so a server that exposes `tree-clean` must fix the path itself. The keys `script` and `subcommand` take the place of the factory key `command`, so a shared server needs a small adapter.
- `release status` is read-only in effect, but it prints the same warnings and exits 1 when a phase is unknown.

