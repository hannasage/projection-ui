// The release steps of Projection UI as one script. Run it with `npm run release -- <subcommand>`.
//
//   status     reads the version, the tags, and the registry, and lists what is left                       read-only
//   preflight  the checkout, the version rules, the publish workflow, and the docs edition agree           local-write
//   gates      npm ci, then every gate in release.config.json                                              local-write
//   dry-run    npm publish --dry-run, then the package, the design kit zip, and the built docs            local-write
//   publish    prints what a person does. The tag starts .github/workflows/publish.yml, which publishes     human-only
//   verify     reads the registry, installs the package into a clean project, loads every entry           local-write
//   tag        prints the tag commands for a person. It never runs git tag or git push                      human-only
//   retire     prints the commands that retire the old prerelease. It never runs them                       human-only
//   claims     finds text that says the package is not published                                           read-only
//
// This repository already publishes through .github/workflows/publish.yml. A pushed tag that matches the workflow filters starts a
// real publish, so the script never pushes a tag and never runs npm publish. It reads the workflow and checks that it agrees with
// release.config.json. workflow.pins in that file pins the content of the workflow and of the two scripts that run with publish
// rights; preflight, gates, dry-run, tag, and status fail when a pinned file differs, until a person reviews it and updates the pin. The usual order is: preflight, gates, dry-run, tag (a person), publish (a person approves the run), verify, claims.
//
// Every value about the release comes from release.config.json, which is checked against a strict schema. The version rules come from
// scripts/release-channel.mjs and scripts/verify-release.mjs, which the script runs in child processes with a short allowlist environment.
// It never loads repository code into its own process. Rules for all subcommands:
//   - The exact command is printed before it runs (`$ command`), including the small git commands.
//   - `--json` prints one JSON object. Exit 0 is a pass, 1 is a failed check, and 2 is a wrong use of the script.
//   - A finished step can run again. It prints "already done" and exits 0. Pass `--force` to run it again (preflight, gates, dry-run, verify).
//   - A step that fails stops the run. The script prints the first failing line only.
//   - publish, tag, and retire refuse unless standard input is a terminal. They print the commands and exit 2. Even with a terminal
//     they only print. The script never runs npm publish, npm login, npm deprecate, npm dist-tag, git tag, or git push.
//     Before they refuse, they still run read-only checks (publish runs npm view, tag runs git ls-remote, retire runs git rev-parse).
//     They run no write command.
//   - Every child process gets an allowlist environment (PATH, a throwaway HOME, LANG, TERM, CI). No token variable is passed.
//     Output is scrubbed of token shapes, one string at a time, so JSON output stays valid.
//   - A child that runs longer than its limit is stopped. Git and npm view get 120 seconds. The gates get 15 minutes.
//
// preflight, gates, dry-run, and verify write a small note, `release-state.json`, inside the git folder. It holds a commit hash and a
// hash of package-lock.json, and only after a clean tree before and after. Nothing trusts it as proof: it only lets a finished step say
// "already done". The design kit and the built docs are checked again on every run, because the note does not cover them.
// `tag` re-checks the branch live and shows the note as evidence for the person, nothing more.
//
// Limit that this script cannot close: a child process can still read any file by its absolute path, for example the real home folder,
// because the script does not run a sandbox. The allowlist and the throwaway HOME stop the usual paths and not a program that goes looking.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { gitEnv, isMain, makeHome, removeHome, toolEnv } from "../tools/lib/env.mjs";
import { deepRedact, failingLine, printable, redact, show } from "../tools/lib/text.mjs";
import { gateProblem, matchingFilters, pinHash, pushTagFilters } from "../tools/lib/workflow.mjs";
import { runSupervised } from "../tools/lib/run.mjs";
import { readZip, zipEntryData } from "../tools/lib/zip.mjs";

/** The safety class of each subcommand. tools/manifest.json repeats these, and a test checks the behavior behind them. */
export const SAFETY = {
  status: "read-only",
  preflight: "local-write",
  gates: "local-write",
  "dry-run": "local-write",
  publish: "human-only",
  verify: "local-write",
  tag: "human-only",
  retire: "human-only",
  claims: "read-only",
};

/** The subcommands for which --force does something. */
export const FORCEABLE = new Set(["preflight", "gates", "dry-run", "verify"]);

const USAGE = [
  "Usage: node scripts/release.mjs <subcommand> [--json] [--force] [--help]",
  "  status | preflight | gates | dry-run | publish | verify | tag | retire | claims",
  "  publish, tag, and retire are human-only: they print the commands and never run them.",
  "  They still run read-only checks first (npm view, git ls-remote, git rev-parse) and run no write command.",
  "  --force runs a recorded step again. It works for preflight, gates, dry-run, and verify.",
  "Exit codes: 0 pass, 1 a check failed, 2 wrong use.",
  "Limit: child processes get an allowlist environment and a throwaway HOME, but they can still read any file by absolute path.",
  "Registry reads name the public registry. RELEASE_REGISTRY changes it, and then no registry read is trusted (status is unknown, exit 1).",
  "verify imports the registry package under the Node permission model (file reads limited to the throwaway project). Network access stays open.",
  "  If this Node lacks the model, verify fails closed. --allow-unsandboxed (verify only) accepts the risk and prints a warning.",
];

// npm view writes nothing but a cache and a log, which the read-only steps point at a throwaway folder. These flags keep it quiet and stop its update check.
const PUBLIC_REGISTRY = "https://registry.npmjs.org/";
const QUIET_NPM = ["--no-update-notifier", "--loglevel", "error"];
const SECOND = 1000;
const LIMITS = { default: 120 * SECOND, gates: 15 * 60 * SECOND, install: 10 * 60 * SECOND, dryRun: 5 * 60 * SECOND };

class ReleaseError extends Error {}

// ---------- config ----------

const PATTERNS = {
  package: /^@[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9._-]*$/,
  version: /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/,
  npmTag: /^[a-z][a-z0-9-]*$/,
  access: /^(?:public|restricted)$/,
  branch: /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9._-]+)*$/,
  remote: /^[A-Za-z][A-Za-z0-9._-]*$/,
  scriptName: /^[a-z][a-z0-9:_-]*$/,
  fileTemplate: /^[A-Za-z0-9._{}-]+$/,
  entryName: /^[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/,
  message: /^[A-Za-z0-9 .,_-]{1,200}$/,
  viewWord: /^[A-Za-z0-9.@_-]+$/,
};
const PINNED = { workflowFile: ".github/workflows/publish.yml", verifier: "scripts/verify-release.mjs", designPublisher: "scripts/publish-design-release.mjs", docsModule: "docs-site/lib/versions.mjs", tagName: "v{version}", tagMessage: "{version}" };
const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isText = (value) => typeof value === "string" && value !== "";
const isCount = (value) => Number.isSafeInteger(value) && value >= 0;
const hasKeys = (object, keys) =>
  typeof object === "object" && object !== null && !Array.isArray(object) && Object.keys(object).sort().join(",") === [...keys].sort().join(",");

/** Returns the problem text for a relative path inside the repository, or null when the path is acceptable. */
function relativeProblem(value) {
  if (!isText(value)) return "is not text";
  if (isAbsolute(value) || value.split(/[\\/]/).includes("..") || value.includes("\0") || value.startsWith("-") || value.includes("\\")) return "must be a relative path inside the repository";
  return null;
}

function allStrings(value, found = []) {
  if (typeof value === "string") found.push(value);
  else if (Array.isArray(value)) value.forEach((inner) => allStrings(inner, found));
  else if (value !== null && typeof value === "object") Object.values(value).forEach((inner) => allStrings(inner, found));
  return found;
}

/** Returns the first problem with the config, or null. Unknown keys are problems, so a typo cannot hide. */
export function configProblem(config) {
  const top = ["package", "version", "npmTag", "access", "expectedFileCount", "maxPackageBytes", "releaseBranch", "remote", "workflow", "gitTag", "gates", "ciOnlyGates", "designKit", "docsEdition", "retire", "claims"];
  if (!hasKeys(config, top)) return `release.config.json must hold exactly these keys: ${top.join(", ")}`;
  if (allStrings(config).some((text) => printable(text) !== text)) return "release.config.json holds a control character or an escape sequence";
  for (const [name, pattern] of [["package", PATTERNS.package], ["version", PATTERNS.version], ["npmTag", PATTERNS.npmTag], ["access", PATTERNS.access], ["releaseBranch", PATTERNS.branch], ["remote", PATTERNS.remote]]) {
    if (!isText(config[name]) || !pattern.test(config[name])) return `${name} is not valid`;
  }
  if (config.releaseBranch.includes("..") || config.releaseBranch.endsWith(".lock") || config.releaseBranch.endsWith(".")) return "releaseBranch is not valid";
  if (!isCount(config.expectedFileCount) || !isCount(config.maxPackageBytes)) return "expectedFileCount and maxPackageBytes must be whole numbers";

  const w = config.workflow;
  if (isPlainObject(w) && !("pins" in w)) return "workflow.pins is missing from release.config.json. It pins the content of the publish workflow and of the scripts that publish, so a person must add it after reviewing the files";
  if (!hasKeys(w, ["file", "verifyJob", "publishJob", "verifier", "justified", "publishEnvironment", "publishUses", "pins"])) return "workflow must hold exactly: file, verifyJob, publishJob, verifier, justified, publishEnvironment, publishUses, pins";
  const pinned = [PINNED.workflowFile, PINNED.verifier, PINNED.designPublisher];
  if (!Array.isArray(w.pins) || w.pins.length !== pinned.length || !w.pins.every((pin, index) => hasKeys(pin, ["path", "sha256"]) && pin.path === pinned[index] && isText(pin.sha256) && /^[0-9a-f]{64}$/.test(pin.sha256))) return `workflow.pins must hold exactly these paths in this order: ${pinned.join(", ")}, each with a sha256 of 64 lowercase hex digits`;
  if (!isText(w.publishEnvironment) || !/^[A-Za-z0-9_-]+$/.test(w.publishEnvironment)) return "workflow.publishEnvironment is not valid";
  if (!Array.isArray(w.publishUses) || !w.publishUses.every((use) => isText(use) && /^[A-Za-z0-9_.\/-]+@[A-Za-z0-9._-]+$/.test(use))) return "workflow.publishUses must be a list of action@reference texts";
  if (!isPlainObject(w.justified) || !Object.values(w.justified).every((keys) => Array.isArray(keys) && keys.every((key) => key === "working-directory" || key === "shell"))) return "workflow.justified must map a step command to a list of working-directory or shell";
  if (w.file !== PINNED.workflowFile) return `workflow.file must be ${PINNED.workflowFile}`;
  if (w.verifier !== PINNED.verifier) return `workflow.verifier must be ${PINNED.verifier}`;
  for (const name of ["verifyJob", "publishJob"]) if (!isText(w[name]) || !/^[A-Za-z0-9_-]+$/.test(w[name])) return `workflow.${name} is not valid`;

  if (!Array.isArray(config.ciOnlyGates) || !config.ciOnlyGates.every(ciOnlyOk)) return "ciOnlyGates must be a list of { name, reason } or { name, command, reason } with plain text, and a command must be npm run <script> or npx playwright install";
  if (new Set(config.ciOnlyGates.map((entry) => entry.name)).size !== config.ciOnlyGates.length) return "ciOnlyGates names must be unique";
  if (Array.isArray(config.gates) && config.ciOnlyGates.some((entry) => config.gates.includes(entry.name))) return "a name in ciOnlyGates is also in gates, so the script would both run it and call it CI-only";
  if (!hasKeys(config.gitTag, ["name", "message"]) || config.gitTag.name !== PINNED.tagName || config.gitTag.message !== PINNED.tagMessage) return `gitTag must be exactly name ${PINNED.tagName} and message ${PINNED.tagMessage}`;
  if (!Array.isArray(config.gates) || config.gates.length === 0 || !config.gates.every((name) => isText(name) && PATTERNS.scriptName.test(name))) return "gates must be a list of npm script names";

  const k = config.designKit;
  if (!hasKeys(k, ["dir", "name", "metadata", "entries", "scene"])) return "designKit must hold exactly: dir, name, metadata, entries, scene";
  for (const name of ["dir", "metadata", "scene"]) {
    const problem = relativeProblem(k[name]);
    if (problem !== null) return `designKit.${name} ${problem}`;
  }
  if (!isText(k.name) || !PATTERNS.fileTemplate.test(k.name)) return "designKit.name is not valid";
  if (!Array.isArray(k.entries) || k.entries.length === 0 || !k.entries.every((entry) => isText(entry) && PATTERNS.entryName.test(entry))) return "designKit.entries must be a list of archive paths";

  const d = config.docsEdition;
  if (!hasKeys(d, ["module", "builtRelease", "builtVersions", "builtChangelog", "changelog"])) return "docsEdition must hold exactly: module, builtRelease, builtVersions, builtChangelog, changelog";
  if (d.module !== PINNED.docsModule) return `docsEdition.module must be ${PINNED.docsModule}`;
  for (const name of ["builtRelease", "builtVersions", "builtChangelog", "changelog"]) {
    const problem = relativeProblem(d[name]);
    if (problem !== null) return `docsEdition.${name} ${problem}`;
  }

  const r = config.retire;
  if (!hasKeys(r, ["note", "commands", "checks"]) || !isText(r.note) || r.note.length > 600) return "retire must hold exactly: note, commands, checks, and the note must be short text";
  if (!Array.isArray(r.commands) || !r.commands.every((command) => retireCommandProblem(command, config) === null)) {
    const bad = Array.isArray(r.commands) ? r.commands.map((command) => retireCommandProblem(command, config)).find((problem) => problem !== null) : "retire.commands must be a list";
    return `retire.commands: ${bad}`;
  }
  if (!Array.isArray(r.checks) || !r.checks.every((command) => retireCheckProblem(command, config) === null)) return "retire.checks may only hold npm view commands for this package";

  const c = config.claims;
  if (!hasKeys(c, ["patterns", "paths", "skipFileNames", "skipDirs", "skipDirsReason"]) || !isText(c.skipDirsReason)) return "claims must hold exactly: patterns, paths, skipFileNames, skipDirs, skipDirsReason";
  if (!Array.isArray(c.patterns) || c.patterns.length === 0 || !c.patterns.every((pattern) => isText(pattern) && !pattern.includes("\n"))) return "claims.patterns must be a list of one-line texts";
  if (!Array.isArray(c.paths) || c.paths.length === 0) return "claims.paths must be a list of paths";
  for (const path of c.paths) {
    const problem = relativeProblem(path);
    if (problem !== null) return `claims.paths entry ${problem}`;
  }
  for (const name of ["skipFileNames", "skipDirs"]) {
    if (!Array.isArray(c[name]) || !c[name].every((entry) => isText(entry) && /^[A-Za-z0-9._-]+$/.test(entry))) return `claims.${name} must be a list of plain names`;
  }
  return null;
}

/** A CI-only command is an npm script (`npm run <script>`) or the Playwright browser install. Nothing else, so `npm publish` cannot be listed. */
const CI_ONLY_COMMAND = /^(?:npm run [a-z][a-z0-9:_-]*|npx playwright install(?: --with-deps)?(?: [a-z]+)?)$/;

/** One entry of ciOnlyGates: an npm script name (or a name with its own command) and a one-line reason. */
function ciOnlyOk(entry) {
  if (!hasKeys(entry, ["name", "reason"]) && !hasKeys(entry, ["name", "command", "reason"])) return false;
  if (!isText(entry.name) || !PATTERNS.scriptName.test(entry.name)) return false;
  if ("command" in entry && !(isText(entry.command) && CI_ONLY_COMMAND.test(entry.command))) return false;
  return isText(entry.reason) && entry.reason.length <= 200 && !entry.reason.includes("\n");
}

/** The only commands retire may hold: npm deprecate of an older version of this package, and npm dist-tag rm of another tag. */
function retireCommandProblem(command, config) {
  if (!Array.isArray(command) || !command.every((part) => typeof part === "string")) return "each command must be a list of text";
  if (command[0] === "npm" && command[1] === "deprecate") {
    const match = /^(@[^@]+)@(.+)$/.exec(command[2] ?? "");
    if (command.length !== 4 || match === null || match[1] !== config.package) return `npm deprecate must be exactly: npm deprecate ${config.package}@<version> "<message>"`;
    if (!PATTERNS.version.test(match[2]) || match[2] === config.version) return "npm deprecate must name an older version than the release";
    if (!PATTERNS.message.test(command[3]) || command[3].startsWith("-")) return "the npm deprecate message may hold only letters, digits, spaces, and . , _ -, and may not start with -";
    return null;
  }
  if (command[0] === "npm" && command[1] === "dist-tag" && command[2] === "rm") {
    if (command.length !== 5 || command[3] !== config.package || !PATTERNS.npmTag.test(command[4])) return `npm dist-tag must be exactly: npm dist-tag rm ${config.package} <tag>`;
    if (command[4] === "latest" || command[4] === config.npmTag) return `npm dist-tag rm may not remove ${command[4]}`;
    return null;
  }
  return "only npm deprecate and npm dist-tag rm are allowed";
}

function retireCheckProblem(command, config) {
  if (!Array.isArray(command) || command.length < 3 || command.length > 6 || command[0] !== "npm" || command[1] !== "view") return "not an npm view command";
  if (!command.slice(3).every((part) => typeof part === "string" && PATTERNS.viewWord.test(part))) return "a word is not plain";
  if (!/^@[A-Za-z0-9._@/-]+$/.test(command[2])) return "the package word is not plain";
  return command[2] === config.package || command[2].startsWith(`${config.package}@`) ? null : "not this package";
}

export function loadConfig(root) {
  const config = JSON.parse(readFileSync(join(root, "release.config.json"), "utf8"));
  const problem = configProblem(config);
  if (problem !== null) throw new ReleaseError(problem);
  return config;
}

/** Replaces each `{name}` in the text with the value for that name. */
export function fill(text, values) {
  return text.replace(/\{([A-Za-z]+)\}/g, (whole, name) => (name in values ? String(values[name]) : whole));
}

const valuesOf = (config) => ({ package: config.package, version: config.version, npmTag: config.npmTag });
export const gitTagName = (config) => fill(config.gitTag.name, valuesOf(config));
const gitTagMessage = (config) => fill(config.gitTag.message, valuesOf(config));
export const designKitName = (config) => fill(config.designKit.name, valuesOf(config));

// ---------- small helpers ----------

/** Converts a size such as "137 kB" to bytes. npm counts a kilobyte as 1000 bytes. */
export function toBytes(amount, unit) {
  const factor = { B: 1, kB: 1000, MB: 1000 * 1000, GB: 1000 * 1000 * 1000 }[unit];
  return factor === undefined ? Number.NaN : Number(amount) * factor;
}

/** Reads the facts out of the text of `npm publish --dry-run`. A missing fact is null. */
export function parseDryRun(text) {
  const clean = text.split("\n").map((line) => line.replace(/^npm notice\s?/, "")).join("\n");
  const pick = (pattern) => pattern.exec(clean)?.slice(1) ?? null;
  const pkg = pick(/^package:\s+(\S+)@(\S+)\s*$/m);
  const files = pick(/^total files:\s+(\d+)\s*$/m);
  const size = pick(/^package size:\s+([\d.]+)\s*(B|kB|MB|GB)\s*$/m);
  const tag = pick(/with tag (\S+) and /);
  const plus = pick(/^\+ (\S+)@(\S+)\s*$/m);
  return {
    name: pkg?.[0] ?? null,
    version: pkg?.[1] ?? null,
    files: files === null ? null : Number(files[0]),
    bytes: size === null ? null : toBytes(size[0], size[1]),
    tag: tag?.[0] ?? null,
    dryRun: /\(dry-run\)/.test(clean),
    plusName: plus?.[0] ?? null,
    plusVersion: plus?.[1] ?? null,
  };
}


const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * Resolves a configured relative path inside the root, one component at a time. Every component is checked with lstat,
 * so a link anywhere in the path is refused. Returns { path } or { problem }.
 */
function safePath(root, path) {
  let current = root;
  for (const part of path.split("/")) {
    current = join(current, part);
    let info;
    try {
      info = lstatSync(current);
    } catch {
      return { problem: `${path} is missing` };
    }
    if (info.isSymbolicLink()) return { problem: `${path} is, or sits below, a symbolic link` };
  }
  return { path: current };
}

const lockHash = (root) => {
  try {
    return sha256(readFileSync(join(root, "package-lock.json")));
  } catch {
    return "none";
  }
};

// ---------- running commands ----------

function makeRun(root, env, out, json, limits = LIMITS, scratch = root, registry = PUBLIC_REGISTRY) {
  const steps = [];
  const say = (line) => {
    if (!json) out(printable(redact(line)));
  };
  /** Prints the command, runs it with a time limit, and records the exit code. git gets the git environment and the rest get the tool one. */
  const exec = (rawCommand, options = {}) => {
    // Every `npm view` names its registry, and runs in the scratch folder and not in the repository, so a project .npmrc cannot redirect it.
    const isView = rawCommand[0] === "npm" && rawCommand[1] === "view";
    const command = isView ? [...rawCommand, "--registry", registry, "--prefix", scratch] : rawCommand;
    // "node" is printed and recorded by name, and the running node binary is what starts. `display` replaces a long program text with a short label.
    const shown = show(options.display ?? command);
    say(`$ ${shown}`);
    const limit = options.timeout === undefined ? limits.default : options.timeout === LIMITS.gates ? limits.gates : options.timeout === LIMITS.install ? limits.install : options.timeout === LIMITS.dryRun ? limits.dryRun : options.timeout;
    // The command runs under a supervisor. When the limit passes, the command and everything it started are stopped, and the exit is 124.
    const result = runSupervised(command[0], command.slice(1), {
      cwd: options.cwd ?? (isView ? scratch : root),
      env: options.env ?? (command[0] === "git" ? env.git : env.tool),
      timeoutMs: limit,
    });
    const status = result.status;
    const stderr = result.timedOut ? `error: timed out after ${limit / SECOND} seconds` : result.stderr;
    steps.push({ command: shown, exit: status });
    return { ok: status === 0, status, stdout: result.stdout, stderr };
  };
  const warnings = [];
  /** A visible warning, shown once: printed in text mode, and listed under `warnings` in JSON mode. */
  const warn = (message) => {
    if (warnings.includes(message)) return;
    warnings.push(message);
    if (!json) out(printable(redact(`WARNING: ${message}`)));
  };
  return { steps, say, exec, warnings, warn, registry, defaultRegistry: registry === PUBLIC_REGISTRY };
}

function finish(ctx, base) {
  // Each string is redacted before it becomes JSON, so a token at the end of a field cannot damage the JSON.
  const body = deepRedact({ ok: base.exit === 0, command: base.command, status: base.status, exit: base.exit, message: base.message, steps: ctx.run.steps, ...(ctx.run.warnings.length > 0 ? { warnings: ctx.run.warnings } : {}), ...base.extra });
  if (ctx.json) ctx.out(JSON.stringify(body));
  else if (base.message) ctx.out(printable(body.message));
  return { exit: base.exit, result: body };
}

const ok = (ctx, message, extra = {}, status = "pass") => finish(ctx, { command: ctx.command, status, exit: 0, message, extra });
const done = (ctx, extra = {}, note = "") => ok(ctx, `already done${note ? `: ${note}` : ""}`, extra, "already-done");
function fail(ctx, line) {
  const clean = redact(line);
  return finish(ctx, { command: ctx.command, status: "fail", exit: 1, message: `FAILED ${ctx.command}: ${clean}`, extra: { failingLine: clean } });
}

// ---------- state ----------

function gitDir(ctx) {
  if (ctx.gitDirPath === undefined) {
    const result = ctx.run.exec(["git", "rev-parse", "--absolute-git-dir"]);
    if (!result.ok) throw new ReleaseError(`cannot find the git folder: ${failingLine(result.stdout, result.stderr)}`);
    ctx.gitDirPath = result.stdout.trim();
  }
  return ctx.gitDirPath;
}

/** Reads the note. A missing note is an empty one. A note that cannot be read as JSON is an error that stops the step. */
function readState(ctx) {
  const file = join(gitDir(ctx), "release-state.json");
  if (!existsSync(file)) return { version: ctx.config.version };
  let state;
  try {
    state = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new ReleaseError(`release-state.json in the git folder is corrupt (${error instanceof Error ? error.message : "unreadable"}). Delete that one file and run the step again`);
  }
  if (typeof state !== "object" || state === null || Array.isArray(state)) throw new ReleaseError("release-state.json in the git folder is corrupt (not an object). Delete that one file and run the step again");
  return state.version === ctx.config.version ? state : { version: ctx.config.version };
}

function writeState(ctx, state) {
  try {
    writeFileSync(join(gitDir(ctx), "release-state.json"), `${JSON.stringify(state, null, 2)}\n`);
  } catch (error) {
    if (error instanceof ReleaseError) throw error;
    throw new ReleaseError(`cannot write release-state.json: ${error instanceof Error ? error.message : "write failed"}`);
  }
}

const recorded = (entry, commit, lock) => entry !== undefined && commit !== null && entry.commit === commit && entry.lock === lock;

// ---------- shared checks ----------

function head(run) {
  const result = run.exec(["git", "rev-parse", "HEAD"]);
  return result.ok ? result.stdout.trim() : null;
}

/**
 * True only when git shows nothing at all. Every untracked file is shown whatever the person's git config says
 * (status.showUntrackedFiles=no would hide them), submodules are not skipped, and a file marked assume-unchanged or skip-worktree
 * (which hides its changes from status) counts as a change.
 */
function treeIsClean(run) {
  const result = run.exec(["git", "-c", "status.showUntrackedFiles=all", "status", "--short", "--untracked-files=all", "--ignore-submodules=none"]);
  const first = result.stdout.split("\n").find((line) => line.trim() !== "");
  if (!result.ok || first !== undefined) return { ok: false, first: first ?? failingLine(result.stdout, result.stderr) };
  const flagged = run.exec(["git", "ls-files", "-v"]);
  if (!flagged.ok) return { ok: false, first: failingLine(flagged.stdout, flagged.stderr) };
  const hidden = flagged.stdout.split("\n").find((line) => /^[a-zS] /.test(line));
  return hidden === undefined ? { ok: true, first: "" } : { ok: false, first: `${hidden.slice(2)} is marked assume-unchanged or skip-worktree, so git status may hide a change` };
}

/** The sentence for a registry that is not the public one. No read from such a registry is trusted. */
function untrustedRegistry(run) {
  const message = `the registry is ${run.registry}, not the public registry, so no registry read is trusted`;
  run.warn(message);
  return message;
}

function distTags(run, config) {
  if (!run.defaultRegistry) return { ok: false, missing: false, tags: {}, error: untrustedRegistry(run) };
  const result = run.exec(["npm", "view", config.package, "dist-tags", "--json", ...QUIET_NPM]);
  // Only npm's own error code line counts as "not found". The same letters in another message do not.
  if (!result.ok) return { ok: false, missing: /^npm error code E404\b/m.test(result.stderr), tags: {}, error: failingLine(result.stdout, result.stderr) };
  try {
    const tags = JSON.parse(result.stdout);
    if (typeof tags !== "object" || tags === null) throw new Error("not an object");
    return { ok: true, missing: false, tags, error: "" };
  } catch {
    return { ok: false, missing: false, tags: {}, error: "npm view did not print JSON" };
  }
}

/** The integrity string that the registry holds for the version, or { ok: false, error }. */
function registryIntegrity(run, config) {
  if (!run.defaultRegistry) return { ok: false, error: untrustedRegistry(run) };
  const result = run.exec(["npm", "view", `${config.package}@${config.version}`, "dist.integrity", "--json", ...QUIET_NPM]);
  if (!result.ok) return { ok: false, error: failingLine(result.stdout, result.stderr) };
  try {
    // One field prints a bare string. Two fields (integrity and gitHead) print an object, and a missing gitHead is left out.
    const parsed = JSON.parse(result.stdout);
    const value = typeof parsed === "string" ? parsed : parsed !== null && typeof parsed === "object" ? parsed["dist.integrity"] : undefined;
    if (typeof value !== "string" || !/^sha\d+-/.test(value)) throw new Error("not an integrity string");
    return { ok: true, integrity: value };
  } catch {
    return { ok: false, error: "npm view did not print an integrity string" };
  }
}

/**
 * A 404 from the registry is the normal state before the first publish. It counts as "not published" only when nothing else
 * contradicts it: the package is public, no verify record says it was published, package.json holds the same name, and the registry is the public one.
 * Returns { accepted, note }.
 */
function notFoundVerdict(ctx, view) {
  const { run, root, config } = ctx;
  if (!view.missing) return { accepted: false, note: view.error };
  const reasons = [];
  if (config.access !== "public") reasons.push("the package is restricted, so a 404 can also mean no permission");
  let recordedVerify = false;
  try {
    recordedVerify = readState(ctx).verify !== undefined;
  } catch {
    recordedVerify = true;
  }
  if (recordedVerify) reasons.push("a verify record says the package was published");
  let name = null;
  try {
    name = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).name;
  } catch {
    // The name stays null, which does not match.
  }
  if (name !== config.package) reasons.push("the name in package.json is not the name in release.config.json");
  if (!run.defaultRegistry) reasons.push(`the registry is ${run.registry}, not the public registry`);
  if (reasons.length > 0) return { accepted: false, note: `registry says not found, but ${reasons.join(" and ")}` };
  run.warn("the registry says this package is not found: normal before the first publish, otherwise check the package name");
  return { accepted: true, note: "registry says not found" };
}

function localTagCommit(run, config) {
  const ref = `refs/tags/${gitTagName(config)}`;
  if (!run.exec(["git", "rev-parse", "-q", "--verify", ref]).ok) return null;
  return run.exec(["git", "rev-list", "-n", "1", ref]).stdout.trim();
}

/** The commit that the remote tag points at. An annotated tag is followed to its commit. Returns { ok, hash, error }. */
function remoteTagCommit(run, config) {
  const ref = `refs/tags/${gitTagName(config)}`;
  const result = run.exec(["git", "ls-remote", "--tags", "--", config.remote, ref, `${ref}^{}`]);
  if (!result.ok) return { ok: false, hash: null, error: failingLine(result.stdout, result.stderr) };
  const lines = result.stdout.split("\n").map((line) => line.trim().split(/\s+/)).filter((parts) => parts.length === 2);
  const peeled = lines.find(([, name]) => name === `${ref}^{}`);
  const plain = lines.find(([, name]) => name === ref);
  return { ok: true, hash: (peeled ?? plain)?.[0] ?? null, error: "" };
}

/** True when the folder holds at least one regular file that the claim check would read. */
function hasReadableFile(directory, config) {
  let entries;
  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      if (!config.claims.skipDirs.includes(entry.name) && hasReadableFile(join(directory, entry.name), config)) return true;
    } else if (entry.isFile() && !config.claims.skipFileNames.includes(entry.name)) return true;
  }
  return false;
}

function claimsCommand(root, config) {
  const paths = [];
  for (const path of config.claims.paths) {
    const resolved = safePath(root, path);
    if (resolved.problem !== undefined) return { problem: `the configured path ${resolved.problem}, so the claim check cannot run` };
    if (statSync(resolved.path).isDirectory() && !hasReadableFile(resolved.path, config)) return { problem: `the configured folder ${path} holds no file to read, so the claim check proves nothing` };
    paths.push(path);
  }
  const command = ["grep", "-rnIFi"];
  for (const pattern of config.claims.patterns) command.push("-e", pattern);
  for (const name of config.claims.skipFileNames) command.push(`--exclude=${name}`);
  for (const name of config.claims.skipDirs) command.push(`--exclude-dir=${name}`);
  return { command: [...command, "--", ...paths] };
}

/** One printed line, redacted first and then cut, so a minified file cannot flood the output. */
const capLine = (line) => {
  const text = redact(line);
  return text.length > 200 ? `${text.slice(0, 200)}...` : text;
};

/** { ok: true } when no file holds a claim, { ok: false } when one does, and { ok: null } when the check could not run. */
function runClaims(run, root, config) {
  const built = claimsCommand(root, config);
  if (built.problem !== undefined) return { ok: null, first: capLine(built.problem) };
  const result = run.exec(built.command);
  if (result.status === 1) return { ok: true, first: "" };
  if (result.status === 0) return { ok: false, first: capLine(result.stdout.split("\n").find((line) => line.trim() !== "") ?? "") };
  return { ok: null, first: capLine(failingLine(result.stdout, result.stderr)) };
}

function configDisagreement(root, config) {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  if (pkg.name !== config.package) return `package.json name is ${pkg.name}, release.config.json says ${config.package}`;
  if (pkg.version !== config.version) return `package.json version is ${pkg.version}, release.config.json says ${config.version}`;
  // Each CI-only entry must run a script that exists, so a typo cannot hide a check. The Playwright install is the one command that is not a script.
  for (const entry of config.ciOnlyGates) {
    const script = "command" in entry ? /^npm run (\S+)$/.exec(entry.command)?.[1] : entry.name;
    if (script !== undefined && !Object.hasOwn(pkg.scripts ?? {}, script)) return `ciOnlyGates entry ${entry.name} is not a script in package.json`;
  }
  return null;
}

// A child process loads the repository module. The script never imports repository code into its own process.
const CHILD_PROGRAM =
  "const { pathToFileURL } = await import(\"node:url\"); const { resolve } = await import(\"node:path\"); " +
  "const mod = await import(pathToFileURL(resolve(process.argv[1])).href); " +
  "const result = process.argv[2] === \"channel\" ? mod.releaseChannel(process.argv[3]) : mod.editionForPackage(process.argv[3]); console.log(JSON.stringify(result));";

/** Runs one exported function of a repository module in a child process. Returns { value } or { problem }. */
function inChild(ctx, file, kind) {
  const resolved = safePath(ctx.root, file);
  if (resolved.problem !== undefined) return { problem: resolved.problem };
  const result = ctx.run.exec(["node", "--input-type=module", "-e", CHILD_PROGRAM, file, kind, ctx.config.version], { display: ["node", "--input-type=module", "-e", "<load the module and call one function>", file, kind, ctx.config.version] });
  if (!result.ok) return { problem: failingLine(result.stdout, result.stderr) };
  try {
    return { value: JSON.parse(result.stdout.trim().split("\n").at(-1)) };
  } catch {
    return { problem: `${file} printed something that is not JSON` };
  }
}

/** The version rules, read from the repository's own files in child processes. Returns a problem text or null. */
function versionRuleProblem(ctx) {
  const { run, root, config, toolEnvironment } = ctx;
  const channel = inChild(ctx, "scripts/release-channel.mjs", "channel");
  if (channel.problem !== undefined) return `scripts/release-channel.mjs does not accept ${config.version}: ${channel.problem}`;
  if (channel.value !== config.npmTag) return `scripts/release-channel.mjs says ${config.version} belongs on the ${channel.value} tag, release.config.json says ${config.npmTag}`;
  const verifier = safePath(root, config.workflow.verifier);
  if (verifier.problem !== undefined) return verifier.problem;
  if (!statSync(verifier.path).isFile() || statSync(verifier.path).size === 0) return `${config.workflow.verifier} is empty or is not a file, so it checks nothing`;
  // verify-release.mjs without --publish only reads package.json and CHANGELOG.md and asserts. It is run with the tag the workflow would see.
  const result = run.exec(["node", config.workflow.verifier], { env: { ...toolEnvironment, GITHUB_REF: `refs/tags/${gitTagName(config)}` } });
  if (!result.ok) return `${config.workflow.verifier} rejects ${gitTagName(config)}: ${failingLine(result.stdout, result.stderr)}`;
  return null;
}

/** The spellings of one CI-only command: its own command text, or `npm run <name>` (and `npm test` for the script test). */
const ciOnlyForms = (entry) => ("command" in entry ? [entry.command] : entry.name === "test" ? ["npm run test", "npm test"] : [`npm run ${entry.name}`]);

/** The warning that says which checks CI runs and the release script does not. Printed by gates, dry-run, and status. */
function warnCiOnly(ctx) {
  const { config, run } = ctx;
  if (config.ciOnlyGates.length === 0) return;
  const list = config.ciOnlyGates.map((entry) => ciOnlyForms(entry)[0].replace(/^npm run /, "")).join(", ");
  run.warn(`CI also runs: ${list}. Run them before you push a tag, because a tag cannot be moved`);
}

/**
 * The content pins, the safety control for everything that publishes: the publish workflow, and the two scripts that run with
 * publish rights. Each file is read as bytes and its hash must equal its entry in workflow.pins. Returns a problem text, or null.
 * The reader in tools/lib/workflow.mjs does not replace this check.
 */
function workflowPinProblem(root, config) {
  for (const pin of config.workflow.pins) {
    const resolved = safePath(root, pin.path);
    if (resolved.problem !== undefined) return resolved.problem;
    let bytes;
    try {
      bytes = readFileSync(resolved.path);
    } catch {
      return `${pin.path} cannot be read, so it cannot be pinned`;
    }
    const found = pinHash(pin.path, bytes);
    if (found.problem !== undefined) return `${pin.path} ${found.problem}`;
    if (found.hash !== pin.sha256) return `${pin.path} changed since the script was last checked: review the change by hand, then update the pin for ${pin.path} in workflow.pins of release.config.json (a person does this)`;
  }
  return null;
}

/** The publish workflow must match its pin, must start for this tag, must run every gate the script runs, and must not let a gate be skipped. */
function workflowProblem(root, config) {
  const pin = workflowPinProblem(root, config);
  if (pin !== null) return pin;
  const resolved = safePath(root, config.workflow.file);
  if (resolved.problem !== undefined) return resolved.problem;
  const text = readFileSync(resolved.path, "utf8");
  const filters = pushTagFilters(text);
  if (!filters.ok) return `${config.workflow.file}: ${filters.error}`;
  const tag = gitTagName(config);
  let matches;
  try {
    matches = matchingFilters(filters.tags, tag);
  } catch (error) {
    return `${config.workflow.file}: ${error instanceof Error ? error.message : String(error)}`;
  }
  if (matches.length === 0) return `${config.workflow.file} would not start for the tag ${tag}. Its filters are: ${filters.tags.join(", ")}`;
  // `npm test` and `npm run test` are the same command, so either form counts.
  const gates = [["npm ci"], ...config.gates.map((name) => (name === "test" ? ["npm run test", "npm test"] : [`npm run ${name}`])), [`node ${config.workflow.verifier}`]];
  const ciOnly = config.ciOnlyGates.map(ciOnlyForms);
  const problem = gateProblem(text, { verifyJob: config.workflow.verifyJob, publishJob: config.workflow.publishJob, gates, ciOnly, publishCommand: `node ${config.workflow.verifier} --publish`, justified: config.workflow.justified, publishEnvironment: config.workflow.publishEnvironment, publishUses: config.workflow.publishUses });
  return problem === null ? null : `${config.workflow.file}: ${problem}`;
}

/** The docs edition in the source must show this version: its label is the version without the prerelease part, and a prerelease is not marked Stable. */
function docsSourceProblem(ctx) {
  const { config } = ctx;
  const edition = inChild(ctx, config.docsEdition.module, "edition");
  if (edition.problem !== undefined) return `${config.docsEdition.module} has no docs edition for ${config.version}: ${edition.problem}`;
  const [core, prerelease] = config.version.split(/-(.+)/);
  if (edition.value?.label !== core) return `the docs edition is labelled ${edition.value?.label}, the release is ${core}`;
  const stable = String(edition.value.status).toLowerCase() === "stable";
  if (prerelease === undefined && !stable) return `the docs edition status is ${edition.value.status}, a stable ${config.version} release needs Stable`;
  if (prerelease !== undefined && stable) return `the docs edition status is ${edition.value.status}, a prerelease ${config.version} must not be marked Stable`;
  return null;
}

/** A regular file inside the root, with no link on the way. Returns { path } or { problem }. */
function regularFile(root, file) {
  const resolved = safePath(root, file);
  if (resolved.problem !== undefined) return resolved;
  return lstatSync(resolved.path).isFile() ? resolved : { problem: `${file} is not a regular file` };
}

/**
 * The built docs site must show this version, and must be built from the sources that are here now:
 * the changelog the build copied must equal CHANGELOG.md byte for byte. A stale build of the same version fails.
 */
export function docsBuiltProblem(root, config) {
  for (const [key, field] of [["builtRelease", "version"], ["builtVersions", "packageVersion"]]) {
    const resolved = regularFile(root, config.docsEdition[key]);
    if (resolved.problem !== undefined) return `${resolved.problem}. Run: npm run release -- gates`;
    let value;
    try {
      const parsed = JSON.parse(readFileSync(resolved.path, "utf8"));
      if (parsed === null || typeof parsed !== "object") return `${config.docsEdition[key]} is not a JSON object`;
      value = parsed[field];
    } catch {
      return `${config.docsEdition[key]} cannot be read as JSON`;
    }
    if (value !== config.version) return `${config.docsEdition[key]} says ${value}, the release is ${config.version}`;
  }
  const built = regularFile(root, config.docsEdition.builtChangelog);
  const source = regularFile(root, config.docsEdition.changelog);
  if (built.problem !== undefined) return `${built.problem}. Run: npm run release -- gates`;
  if (source.problem !== undefined) return source.problem;
  if (!readFileSync(built.path).equals(readFileSync(source.path))) return `${config.docsEdition.builtChangelog} differs from ${config.docsEdition.changelog}, so the built docs are stale. Run: npm run release -- gates --force`;
  return null;
}

/**
 * The design kit zip: it exists, its name matches the version, it is the only zip, its size and hash match its metadata file,
 * it can be read as a zip, it holds exactly the expected entries, and its manifest names this version and the hash of the source scene.
 */
export function designKitProblem(root, config) {
  const name = designKitName(config);
  const dir = safePath(root, config.designKit.dir);
  if (dir.problem !== undefined) return `${dir.problem}. Run: npm run release -- gates`;
  const metadataFile = regularFile(root, `${config.designKit.dir}/${config.designKit.metadata}`);
  const zipFile = regularFile(root, `${config.designKit.dir}/${name}`);
  for (const resolved of [metadataFile, zipFile]) if (resolved.problem !== undefined) return resolved.problem;
  const names = readdirSync(dir.path).sort();
  const expected = [name, config.designKit.metadata].sort();
  const stale = names.filter((entry) => !expected.includes(entry));
  if (stale.length > 0) return `${config.designKit.dir} holds ${stale.join(", ")}, which this release does not use (a stale output of an earlier build). The design release job needs exactly ${expected.join(", ")}. Delete ${stale.length === 1 ? "that file" : "those files"} by hand, then run: npm run release -- gates --force`;
  if (names.join("\n") !== expected.join("\n")) return `${config.designKit.dir} holds ${names.join(", ")}, and the design release job needs exactly ${expected.join(", ")}`;
  let metadata;
  try {
    metadata = JSON.parse(readFileSync(metadataFile.path, "utf8"));
  } catch {
    return `${config.designKit.metadata} cannot be read as JSON`;
  }
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata)) return `${config.designKit.metadata} is not a JSON object`;
  if (metadata.version !== config.version) return `${config.designKit.metadata} says version ${metadata.version}, the release is ${config.version}`;
  if (metadata.filename !== name) return `${config.designKit.metadata} says the file is ${metadata.filename}, expected ${name}`;
  const bytes = readFileSync(zipFile.path);
  if (bytes.subarray(0, 4).toString("latin1") !== "PK\u0003\u0004") return `${name} is not a zip file`;
  if (metadata.bytes !== bytes.length) return `${name} has ${bytes.length} bytes, ${config.designKit.metadata} says ${metadata.bytes}`;
  if (metadata.sha256 !== sha256(bytes)) return `${name} does not match the SHA-256 in ${config.designKit.metadata}`;
  const zip = readZip(bytes);
  if (!zip.ok) return `${name}: ${zip.error}`;
  const listed = zip.entries.map((entry) => entry.name).sort();
  const wanted = [...config.designKit.entries].sort();
  if (listed.join("\n") !== wanted.join("\n")) return `${name} holds ${listed.join(", ")}, expected ${wanted.join(", ")}`;
  const manifestEntry = zip.entries.find((entry) => entry.name === "design-manifest.json");
  const manifestBytes = manifestEntry === undefined ? null : zipEntryData(bytes, manifestEntry);
  if (manifestBytes === null) return `design-manifest.json inside ${name} cannot be read`;
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch {
    return `design-manifest.json inside ${name} is not JSON`;
  }
  if (manifest === null || typeof manifest !== "object" || Array.isArray(manifest)) return `design-manifest.json inside ${name} is not a JSON object`;
  if (manifest.version !== config.version) return `design-manifest.json inside ${name} says version ${manifest.version}, the release is ${config.version}`;
  const scene = regularFile(root, config.designKit.scene);
  if (scene.problem !== undefined) return scene.problem;
  let sceneHash;
  let sceneObject;
  try {
    sceneObject = JSON.parse(readFileSync(scene.path, "utf8"));
    sceneHash = sha256(JSON.stringify(sceneObject));
  } catch {
    return `${config.designKit.scene} cannot be read as JSON`;
  }
  if (manifest.design?.sceneSha256 !== sceneHash) return `the kit was built from another scene than ${config.designKit.scene}`;
  if (metadata.sceneSha256 !== sceneHash) return `${config.designKit.metadata} names another scene hash than ${config.designKit.scene}`;
  // tokens.json and plugin/code.js must agree with the manifest and the source scene, byte for byte (compared by SHA-256).
  const text = (entryName) => {
    const found = zip.entries.find((entry) => entry.name === entryName);
    const data = found === undefined ? null : zipEntryData(bytes, found);
    return data === null ? null : data.toString("utf8");
  };
  const tokensText = text("tokens.json");
  const codeText = text("plugin/code.js");
  if (tokensText === null || codeText === null) return `tokens.json or plugin/code.js inside ${name} cannot be read`;
  if (manifest.tokens === undefined) return `design-manifest.json inside ${name} has no tokens`;
  const expectedTokens = JSON.stringify(manifest.tokens, null, 2);
  if (sha256(tokensText) !== sha256(expectedTokens)) return `tokens.json inside ${name} (SHA-256 ${sha256(tokensText).slice(0, 12)}) differs from the tokens in design-manifest.json (${sha256(expectedTokens).slice(0, 12)})`;
  const embedded = `const scene = ${JSON.stringify(sceneObject)};\nconst tokens = ${JSON.stringify(manifest.tokens)};\nimportProjectionDesign(figma, scene, tokens, ${JSON.stringify(config.version)})`;
  if (!codeText.includes(embedded)) return `plugin/code.js inside ${name} does not embed the source scene, the manifest tokens, and the version ${config.version}`;
  return null;
}

/** The outputs of the gates that the record does not cover. Returns a problem text or null. */
function outputProblem(root, config) {
  const kit = designKitProblem(root, config);
  if (kit !== null) return `design kit: ${kit}`;
  const docs = docsBuiltProblem(root, config);
  return docs === null ? null : `docs edition: ${docs}`;
}

/** What the registry says about retiring: true when every retire command is already in effect, false when not, null when unknown. */
function retireState(ctx) {
  const { run, config } = ctx;
  if (config.retire.commands.length === 0) return true;
  const view = distTags(run, config);
  // A package that is not on the registry has nothing to retire yet. A read that failed or timed out proves nothing.
  if (!view.ok) return notFoundVerdict(ctx, view).accepted ? false : null;
  for (const command of config.retire.commands) {
    if (command[1] === "dist-tag") {
      if (command[4] in view.tags) return false;
    } else {
      const result = run.exec(["npm", "view", command[2], "deprecated", ...QUIET_NPM]);
      if (!result.ok) return null;
      if (result.stdout.trim() === "") return false;
    }
  }
  return true;
}

// ---------- subcommands ----------

/**
 * publish, tag, and retire. The script only prints. A person at a terminal sees exit 0, or exit 1 when the step is not ready.
 * Without a terminal the exit is 2. `note` is a text from the config that is printed first.
 */
function humanOnly(ctx, commands, blockers = [], note = "") {
  if (!ctx.json) {
    ctx.out(`${ctx.command} is human-only. This script never runs these commands. Run them yourself, in a terminal:`);
    if (note) ctx.out(`  Note: ${printable(redact(note))}`);
    for (const line of commands) ctx.out(`  ${printable(redact(line))}`);
    for (const blocker of blockers) ctx.out(`  NOT READY: ${printable(redact(blocker))}`);
  }
  const extra = { commands, blockers, ...(note ? { note } : {}) };
  if (!ctx.isTTY) {
    return finish(ctx, { command: ctx.command, status: "refused", exit: 2, message: `refused: standard input is not a terminal. ${ctx.command} is human-only`, extra });
  }
  if (blockers.length > 0) {
    return finish(ctx, { command: ctx.command, status: "not-ready", exit: 1, message: `FAILED ${ctx.command}: not ready. ${blockers[0]}`, extra });
  }
  return finish(ctx, { command: ctx.command, status: "pass", exit: 0, message: "", extra });
}

/** The git checks that every release commit needs. Returns { problem } or { problem: null, commit }. */
function branchProblem(run, config, { fetch }) {
  if (fetch) {
    const fetched = run.exec(["git", "fetch", "--", config.remote]);
    if (!fetched.ok) return { problem: failingLine(fetched.stdout, fetched.stderr) };
  }
  const branch = run.exec(["git", "rev-parse", "--abbrev-ref", "HEAD"]);
  if (!branch.ok || branch.stdout.trim() !== config.releaseBranch) {
    return { problem: `on branch ${branch.stdout.trim() || "unknown"}, not ${config.releaseBranch}. Run: git checkout ${config.releaseBranch}` };
  }
  const remoteRef = `${config.remote}/${config.releaseBranch}`;
  const behind = run.exec(["git", "rev-list", "--count", `HEAD..${remoteRef}`, "--"]);
  if (!behind.ok || behind.stdout.trim() !== "0") return { problem: `the branch is behind ${remoteRef}. Run: git pull --ff-only` };
  const ahead = run.exec(["git", "rev-list", "--count", `${remoteRef}..HEAD`, "--"]);
  if (!ahead.ok || ahead.stdout.trim() !== "0") return { problem: `the branch has commits that ${remoteRef} lacks. Push them first` };
  const clean = treeIsClean(run);
  if (!clean.ok) return { problem: `the working tree is not clean: ${clean.first}` };
  const commit = head(run);
  return commit === null ? { problem: "cannot read HEAD" } : { problem: null, commit };
}

function lockedVersion(root, name) {
  try {
    const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
    const version = lock.packages?.[`node_modules/${name}`]?.version;
    return typeof version === "string" && PATTERNS.version.test(version) ? version : null;
  } catch {
    return null;
  }
}

/** Every file name that an exports value points at, in order. */
function exportTargets(value, found = []) {
  if (typeof value === "string") found.push(value);
  else if (value !== null && typeof value === "object") Object.values(value).forEach((inner) => exportTargets(inner, found));
  return found;
}

const STEPS = {
  async preflight(ctx) {
    const { run, root, config, flags } = ctx;
    const disagreement = configDisagreement(root, config);
    if (disagreement !== null) return fail(ctx, disagreement);
    const rule = versionRuleProblem(ctx);
    if (rule !== null) return fail(ctx, rule);
    const workflow = workflowProblem(root, config);
    if (workflow !== null) return fail(ctx, workflow);
    const edition = docsSourceProblem(ctx);
    if (edition !== null) return fail(ctx, edition);
    const branch = branchProblem(run, config, { fetch: true });
    if (branch.problem !== null) return fail(ctx, branch.problem);
    run.exec(["git", "log", "-1", "--oneline"]);
    run.say(`commit: ${branch.commit}`);
    const state = readState(ctx);
    const finished = state.preflight?.commit === branch.commit && !flags.has("--force");
    state.preflight = { commit: branch.commit };
    writeState(ctx, state);
    return finished ? done(ctx, { commit: branch.commit }, `preflight passed at ${branch.commit}`) : ok(ctx, `preflight passed at ${branch.commit}`, { commit: branch.commit });
  },

  async gates(ctx) {
    const { run, root, config, flags } = ctx;
    const pin = workflowPinProblem(root, config);
    if (pin !== null) return fail(ctx, pin);
    warnCiOnly(ctx);
    const commit = head(run);
    const lock = lockHash(root);
    const state = readState(ctx);
    const before = treeIsClean(run);
    // The record does not cover the design kit or the built docs, so they are checked again every time. A bad output runs the gates again.
    if (recorded(state.gates, commit, lock) && before.ok && !flags.has("--force") && outputProblem(root, config) === null) return done(ctx, { commit });
    if (!before.ok) return fail(ctx, `refused: the working tree is not clean: ${before.first}`);
    for (const command of [["npm", "ci"], ...config.gates.map((name) => ["npm", "run", name])]) {
      const result = run.exec(command, { timeout: LIMITS.gates });
      if (!result.ok) return fail(ctx, `${show(command)} exited ${result.status}: ${failingLine(result.stdout, result.stderr)}`);
    }
    const after = treeIsClean(run);
    if (!after.ok) return fail(ctx, `the gates changed the working tree, so nothing is recorded: ${after.first}`);
    if (head(run) !== commit || lockHash(root) !== lock) return fail(ctx, "HEAD or package-lock.json changed while the gates ran, so nothing is recorded");
    const outputs = outputProblem(root, config);
    if (outputs !== null) return fail(ctx, `the gates passed but their outputs are wrong, so nothing is recorded. ${outputs}`);
    state.gates = { commit, lock };
    writeState(ctx, state);
    return ok(ctx, "gates passed", { commit });
  },

  async "dry-run"(ctx) {
    const { run, root, config, flags } = ctx;
    const pin = workflowPinProblem(root, config);
    if (pin !== null) return fail(ctx, pin);
    warnCiOnly(ctx);
    const commit = head(run);
    const lock = lockHash(root);
    const state = readState(ctx);
    const before = treeIsClean(run);
    const outputs = outputProblem(root, config);
    // A record never stands in for the design kit or the built docs. They are checked on every run.
    if (recorded(state.dryRun, commit, lock) && before.ok && !flags.has("--force")) return outputs === null ? done(ctx, { commit }) : fail(ctx, outputs);
    if (!before.ok) return fail(ctx, `refused: the working tree is not clean: ${before.first}`);
    const command = ["npm", "publish", "--dry-run", "--tag", config.npmTag, "--access", config.access, "--ignore-scripts"];
    const result = run.exec(command, { timeout: LIMITS.dryRun });
    if (!result.ok) return fail(ctx, `${show(command)} exited ${result.status}: ${failingLine(result.stdout, result.stderr)}`);
    const facts = parseDryRun(`${result.stderr}\n${result.stdout}`);
    const expected = `${config.package}@${config.version}`;
    const problems = [];
    if (facts.name !== config.package || facts.version !== config.version) problems.push(`package line is ${facts.name}@${facts.version}, expected ${expected}`);
    if (config.expectedFileCount === 0 || facts.files !== config.expectedFileCount) problems.push(`total files: ${facts.files}, expected ${config.expectedFileCount}`);
    if (facts.bytes === null || !(facts.bytes > 0) || config.maxPackageBytes === 0 || facts.bytes > config.maxPackageBytes) problems.push(`package size is ${facts.bytes} bytes, above the limit of ${config.maxPackageBytes} bytes in release.config.json`);
    if (facts.tag !== config.npmTag) problems.push(`publish tag is ${facts.tag}, expected ${config.npmTag}`);
    if (!facts.dryRun) problems.push("the output does not say dry-run");
    if (facts.plusName !== config.package || facts.plusVersion !== config.version) problems.push(`last line is + ${facts.plusName}@${facts.plusVersion}, expected + ${expected}`);
    if (problems.length > 0) return fail(ctx, problems[0]);
    if (outputs !== null) return fail(ctx, outputs);
    const after = treeIsClean(run);
    if (!after.ok) return fail(ctx, `the dry run changed the working tree, so nothing is recorded: ${after.first}`);
    state.dryRun = { commit, lock };
    writeState(ctx, state);
    return ok(ctx, `dry run passed: ${expected}, ${facts.files} files, ${facts.bytes} bytes, tag ${facts.tag}, design kit and docs edition agree`, { commit });
  },

  publish(ctx) {
    const { run, config } = ctx;
    const view = distTags(run, config);
    if (view.ok && view.tags[config.npmTag] === config.version) return done(ctx, {}, `${config.package}@${config.version} is on the ${config.npmTag} tag`);
    return humanOnly(ctx, [
      `npm run release -- tag   # prints the tag commands. Push the tag yourself. It starts ${config.workflow.file}`,
      "# On GitHub, approve the npm-publish environment for the run, and wait for the publish and design-release jobs",
      `npm view ${config.package} dist-tags --json   # ${config.npmTag} must be ${config.version}`,
      "npm run release -- verify",
    ]);
  },

  retire(ctx) {
    const { run, config, root } = ctx;
    if (config.retire.commands.length === 0) return done(ctx, {}, config.retire.note);
    const state = retireState(ctx);
    if (state === true) return done(ctx, {}, "the old version is deprecated and the old tag is gone");
    const commands = [...config.retire.commands.map(show), ...config.retire.checks.map(show)];
    if (!ctx.isTTY) return humanOnly(ctx, commands, [], config.retire.note);
    const commit = head(run);
    const record = readState(ctx);
    const blockers = recorded(record.verify, commit, lockHash(root)) ? [] : ["verify has not passed for this commit. Run: npm run release -- verify"];
    return humanOnly(ctx, commands, blockers, config.retire.note);
  },

  async verify(ctx) {
    const { run, root, config, flags, toolEnvironment } = ctx;
    const commit = head(run);
    const lock = lockHash(root);
    // The registry is read first, every time. A note on disk never stands in for it.
    const view = distTags(run, config);
    if (!view.ok) return fail(ctx, `could not read the registry: ${view.error}`);
    if (view.tags[config.npmTag] !== config.version) return fail(ctx, `dist-tag ${config.npmTag} is ${view.tags[config.npmTag] ?? "missing"}, expected ${config.version}`);
    const outputs = outputProblem(root, config);
    if (outputs !== null) return fail(ctx, outputs);
    const state = readState(ctx);
    if (recorded(state.verify, commit, lock) && !flags.has("--force")) return done(ctx, { commit }, `the registry still shows ${config.version} on the ${config.npmTag} tag`);
    const react = lockedVersion(root, "react");
    const reactDom = lockedVersion(root, "react-dom");
    if (react === null || reactDom === null) return fail(ctx, "package-lock.json does not pin react and react-dom, so verify cannot install the versions the repository uses");
    const rootPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    // The import of the registry package runs under the Node permission model, which limits file reads to the throwaway project.
    // Without it, verify fails closed unless the person passes --allow-unsandboxed. Network access stays open: the model does not limit it.
    const detected = ["--permission", "--experimental-permission"].find((name) => process.allowedNodeEnvironmentFlags.has(name));
    const available = ctx.permissionAvailable ?? detected !== undefined;
    if (!available) {
      if (!flags.has("--allow-unsandboxed")) return fail(ctx, "the Node permission model is not available in this Node, so verify will not import the registry package without it. Use a newer Node, or pass --allow-unsandboxed to accept the risk");
      run.warn("the Node permission model is not available in this Node, so the import of the registry package ran without a file read limit (--allow-unsandboxed)");
    }
    const guardFlag = detected ?? "--permission";
    const temp = mkdtempSync(join(tmpdir(), "release-verify-"));
    try {
      const home = join(temp, "home");
      const project = join(temp, "project");
      mkdirSync(home);
      mkdirSync(project);
      // Two empty config files, one for the user config and one for the global config. npm 11 refuses one file loaded as both.
      writeFileSync(join(home, "npmrc-user"), "");
      writeFileSync(join(home, "npmrc-global"), "");
      // The model reads a comma as a list separator and a star as a wildcard, so the real path of the project may hold neither.
      const guardPath = realpathSync(project);
      if (/[,*]/.test(guardPath)) return fail(ctx, `the temporary folder ${guardPath} has a comma or an asterisk in its path, which the permission model reads as a list or a wildcard. Set TMPDIR to a plain folder and run verify again`);
      // The cache lives under the throwaway HOME, and the user and global npm config files are empty.
      const childEnv = toolEnv(ctx.rawEnv, home, { npm_config_cache: join(home, "cache") });
      for (const [command, timeout] of [
        [["npm", "init", "-y"], LIMITS.default],
        [["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund", "--registry", run.registry, `${config.package}@${config.npmTag}`, `react@${react}`, `react-dom@${reactDom}`], LIMITS.install],
      ]) {
        const result = run.exec(command, { cwd: project, env: childEnv, timeout });
        if (!result.ok) return fail(ctx, `${show(command)} exited ${result.status}: ${failingLine(result.stdout, result.stderr)}`);
      }
      const installedRoot = join(project, "node_modules", ...config.package.split("/"));
      let installed;
      try {
        installed = JSON.parse(readFileSync(join(installedRoot, "package.json"), "utf8"));
      } catch {
        return fail(ctx, "the installed package.json cannot be read");
      }
      if (installed.version !== config.version) return fail(ctx, `the installed version is ${installed.version}, expected ${config.version}`);
      // The tarball that npm installed must be the one that npm view described.
      const viewed = registryIntegrity(run, config);
      if (!viewed.ok) return fail(ctx, `could not read the integrity of ${config.version} from the registry: ${viewed.error}`);
      let installedIntegrity = null;
      try {
        installedIntegrity = JSON.parse(readFileSync(join(project, "package-lock.json"), "utf8")).packages?.[`node_modules/${config.package}`]?.integrity ?? null;
      } catch {
        // The check below reports it.
      }
      if (installedIntegrity !== viewed.integrity) return fail(ctx, `the installed integrity ${installedIntegrity ?? "(unreadable)"} differs from the registry integrity ${viewed.integrity}`);
      // The installed entries must be the entries the source declares: same keys, same targets, and every target file present.
      const wanted = Object.keys(rootPackage.exports ?? {}).sort();
      const have = Object.keys(installed.exports ?? {}).sort();
      if (wanted.join("\n") !== have.join("\n")) {
        const missing = wanted.find((key) => !have.includes(key));
        const extra = have.find((key) => !wanted.includes(key));
        return fail(ctx, missing !== undefined ? `the installed package lacks the entry ${missing}` : `the installed package has the entry ${extra}, which the source does not declare`);
      }
      const names = {};
      for (const key of wanted) {
        const sourceTargets = exportTargets(rootPackage.exports[key]).sort();
        const installedTargets = exportTargets(installed.exports[key]).sort();
        if (sourceTargets.join("\n") !== installedTargets.join("\n")) return fail(ctx, `the targets of the entry ${key} differ between the source and the installed package`);
        for (const target of installedTargets) {
          if (isAbsolute(target) || target.split("/").includes("..") || !existsSync(join(installedRoot, target))) return fail(ctx, `the installed file ${target} for ${key} is missing`);
        }
        const value = rootPackage.exports[key];
        if (typeof value === "object" && value !== null && "import" in value) {
          const specifier = key === "." ? config.package : `${config.package}/${key.slice(2)}`;
          // The specifier travels as an argument, never inside the program text.
          const program = "const mod = await import(process.argv[1]); console.log(Object.keys(mod).length);";
          const guard = available ? [guardFlag, `--allow-fs-read=${guardPath}`] : [];
          const shownGuard = available ? [guardFlag, "--allow-fs-read=<project>"] : [];
          const counted = run.exec(["node", ...guard, "--input-type=module", "-e", program, specifier], { cwd: project, env: childEnv, display: ["node", ...shownGuard, "--input-type=module", "-e", "<import the entry and count its names>", specifier] });
          if (!counted.ok) return fail(ctx, `the import of ${specifier} failed: ${failingLine(counted.stdout, counted.stderr)}`);
          const count = Number(counted.stdout.trim());
          if (!(count > 0)) return fail(ctx, `${specifier} exports no names`);
          names[key] = count;
        }
      }
      const clean = treeIsClean(run);
      if (clean.ok && head(run) === commit) {
        state.verify = { commit, lock };
        writeState(ctx, state);
      }
      return ok(ctx, `verify passed: ${config.npmTag} is ${config.version}, ${wanted.length} entries match the source, load or exist${clean.ok ? "" : ". Not recorded: the working tree is not clean"}`, { commit, exports: names, recorded: clean.ok });
    } finally {
      try {
        rmSync(temp, { recursive: true, force: true });
      } catch (error) {
        process.stderr.write(`WARNING: could not remove the temporary folder ${temp}: ${error instanceof Error ? error.message : "remove failed"}\n`);
      }
    }
  },

  tag(ctx) {
    const { run, root, config } = ctx;
    const name = gitTagName(config);
    const existing = localTagCommit(run, config);
    const onRemote = remoteTagCommit(run, config);
    const pinned = workflowPinProblem(root, config);
    const alreadyTagged = existing !== null && onRemote.hash === existing && existing === head(run);
    // "Already done" counts only while every pin still matches. A changed pinned file is a blocker even for a tag that exists.
    if (alreadyTagged && pinned === null) return done(ctx, { tag: name });
    // Live checks only. The note is shown as evidence and never counts as permission.
    const blockers = [];
    if (!onRemote.ok) blockers.push(`could not read the remote tags, so it is not known whether ${name} exists: ${onRemote.error}`);
    else if (!alreadyTagged && (existing !== null || onRemote.hash !== null)) blockers.push(`the tag ${name} already exists (local ${existing ?? "missing"}, remote ${onRemote.hash ?? "missing"}) and does not match HEAD on both sides. Do not move a published tag`);
    const branch = branchProblem(run, config, { fetch: false });
    if (branch.problem !== null) blockers.push(branch.problem);
    const rule = workflowProblem(root, config);
    if (rule !== null) blockers.push(rule);
    const outputs = outputProblem(root, config);
    if (outputs !== null) blockers.push(outputs);
    const commit = branch.commit ?? head(run) ?? "<commit-hash>";
    const state = readState(ctx);
    const lock = lockHash(root);
    for (const [key, label] of [["preflight", "preflight"], ["gates", "gates"], ["dryRun", "dry-run"]]) {
      const entry = state[key];
      const good = key === "preflight" ? entry?.commit === commit : recorded(entry, commit, lock);
      if (!good) blockers.push(`${label} has not been recorded for this commit. Run: npm run release -- ${label}`);
    }
    const commands = [
      `git tag -a ${name} ${commit} -m ${show([gitTagMessage(config)])}`,
      `git push ${config.remote} ${name}   # starts ${config.workflow.file}, which publishes ${config.package}@${config.version} after the npm-publish environment is approved`,
    ];
    return humanOnly(ctx, commands, blockers);
  },

  claims(ctx) {
    const { run, root, config } = ctx;
    const found = runClaims(run, root, config);
    if (found.ok !== true) return fail(ctx, found.ok === null ? `the claim check could not run: ${found.first}` : found.first);
    return ok(ctx, "no file holds a stale claim");
  },

  status(ctx) {
    const { run, root, config } = ctx;
    warnCiOnly(ctx);
    const state = readState(ctx);
    const commit = head(run);
    const lock = lockHash(root);
    const phases = [];
    const add = (name, finished, note = "") => phases.push({ name, state: finished === null ? "unknown" : finished ? "done" : "todo", note });
    // If HEAD cannot be read, nothing recorded for a commit can be compared, so those phases are unknown.
    const headNote = "git rev-parse HEAD failed or timed out";
    const known = (value) => (commit === null ? null : value);
    add("preflight", known(state.preflight?.commit === commit), commit === null ? headNote : "");
    add("gates", known(recorded(state.gates, commit, lock)), commit === null ? headNote : "");
    add("dry-run", known(recorded(state.dryRun, commit, lock)), commit === null ? headNote : "");
    // The tag is human-only here, so status only reports. It is done when the local and the remote tag both point at the preflight commit.
    const wanted = state.preflight?.commit;
    const localTag = localTagCommit(run, config);
    const remoteTag = remoteTagCommit(run, config);
    let tagNote = "";
    if (!remoteTag.ok) tagNote = `could not read the remote tags: ${remoteTag.error}`;
    else if (!wanted) tagNote = "preflight has not recorded a commit";
    else if (localTag === null && remoteTag.hash === null) tagNote = "";
    else if (localTag !== wanted) tagNote = `local tag ${localTag === null ? "is missing" : `points at ${localTag}`}, expected ${wanted}`;
    else if (remoteTag.hash !== wanted) tagNote = `remote tag ${remoteTag.hash === null ? "is missing" : `points at ${remoteTag.hash}`}, expected ${wanted}`;
    // If the remote cannot be read, the phase is unknown and the remote error comes first.
    add("tag", !remoteTag.ok ? null : wanted !== undefined && localTag === wanted && remoteTag.hash === wanted, tagNote);
    // A package that is not on the registry (E404) is the normal state before the first publish: those phases are todo, and the read is fine.
    // A read that failed or timed out for another reason is unknown.
    const view = distTags(run, config);
    const verdict = view.ok ? { accepted: false, note: "" } : notFoundVerdict(ctx, view);
    add("publish", view.ok ? view.tags[config.npmTag] === config.version : verdict.accepted ? false : null, view.ok ? "" : verdict.note);
    add("verify", known(view.ok ? recorded(state.verify, commit, lock) && view.tags[config.npmTag] === config.version : verdict.accepted ? false : null), commit === null ? headNote : view.ok ? "" : verdict.note);
    add("retire", retireState(ctx), config.retire.commands.length === 0 ? "nothing to retire" : view.ok ? "" : verdict.note);
    const claims = runClaims(run, root, config);
    add("claims", claims.ok, claims.ok === true ? "" : claims.first);
    // A pinned file that differs blocks every release step. This is not a failed read, so the phase is blocked and not unknown.
    const pin = workflowPinProblem(root, config);
    phases.push({ name: "workflow-pin", state: pin === null ? "done" : "blocked", note: pin ?? "" });
    const left = phases.filter((phase) => phase.state !== "done").map((phase) => phase.name);
    const unknown = phases.filter((phase) => phase.state === "unknown").map((phase) => phase.name);
    const blocked = phases.filter((phase) => phase.state === "blocked").map((phase) => phase.name);
    run.say(`${config.package}@${config.version} on the ${config.npmTag} tag`);
    for (const phase of phases) run.say(`  ${phase.state.padEnd(7)} ${phase.name}${phase.note ? ` (${phase.note})` : ""}`);
    run.say(left.length === 0 ? "Nothing is left to do." : `Left to do: ${left.join(", ")}`);
    const base = { package: config.package, version: config.version, phases, left, unknown, blocked };
    if (unknown.length > 0) {
      return finish(ctx, { command: "status", status: "unknown", exit: 1, message: `status could not read: ${unknown.join(", ")}`, extra: base });
    }
    if (blocked.length > 0) {
      return finish(ctx, { command: "status", status: "blocked", exit: 1, message: `status is blocked: ${phases.find((phase) => phase.state === "blocked").note}`, extra: base });
    }
    return finish(ctx, { command: "status", status: "pass", exit: 0, message: "", extra: base });
  },
};

// ---------- entry ----------

const KNOWN_FLAGS = new Set(["--json", "--force", "--help", "--allow-unsandboxed"]);

/**
 * Runs one subcommand. `context` is `{ root, env, isTTY, out, limits, permissionAvailable }`. `limits` may shorten the time limits and `permissionAvailable` may pretend the permission model is missing, for a test. It returns `{ exit, result }` and never exits the process,
 * so a test can call it. The command line below is a thin wrapper.
 */
export async function runRelease(argv, context) {
  const { root, isTTY, out } = context;
  const flags = new Set(argv.filter((arg) => arg.startsWith("-")));
  const words = argv.filter((arg) => !arg.startsWith("-"));
  const json = flags.has("--json");
  const home = makeHome();
  try {
    // A read-only step writes nothing, so npm gets its cache and its log folder inside the throwaway HOME, which is removed at the end.
    const readOnly = SAFETY[words[0]] === "read-only";
    const toolEnvironment = toolEnv(context.env, home, readOnly ? { npm_config_cache: join(home, "npm-cache"), npm_config_logs_dir: join(home, "npm-logs") } : {});
    const run = makeRun(root, { git: gitEnv(context.env, {}, root), tool: toolEnvironment }, out, json, { ...LIMITS, ...context.limits }, home, context.env.RELEASE_REGISTRY || PUBLIC_REGISTRY);
    const command = words[0];
    const base = { run, out, json, root, flags, isTTY, command, toolEnvironment, rawEnv: context.env, permissionAvailable: context.permissionAvailable };
    if (flags.has("--help")) {
      for (const line of USAGE) out(line);
      return { exit: 0, result: { ok: true } };
    }
    if (words.length !== 1 || !Object.hasOwn(SAFETY, command)) {
      return usageError(base, command === undefined ? "No subcommand given." : `Unknown subcommand: ${words.join(" ")}`);
    }
    const bad = [...flags].find((flag) => !KNOWN_FLAGS.has(flag) || (flag === "--force" && !FORCEABLE.has(command)) || (flag === "--allow-unsandboxed" && command !== "verify"));
    if (bad !== undefined) return usageError(base, `The flag ${bad} does not belong to ${command}.`);
    // git is checked by running it, and the command is printed like every other.
    const version = run.exec(["git", "--version"]);
    if (!version.ok) return fail(base, "git is not installed or is not on PATH");
    let config;
    try {
      config = loadConfig(root);
    } catch (error) {
      return fail(base, `release.config.json: ${error instanceof Error ? error.message : String(error)}`);
    }
    try {
      return await STEPS[command]({ ...base, config });
    } catch (error) {
      return fail(base, error instanceof Error ? error.message : String(error));
    }
  } finally {
    try {
      removeHome(home);
    } catch (error) {
      process.stderr.write(`WARNING: could not remove the temporary folder ${home}: ${error instanceof Error ? error.message : "remove failed"}\n`);
    }
  }
}

function usageError(ctx, message) {
  const body = deepRedact({ ok: false, command: ctx.command ?? null, status: "usage", exit: 2, message, steps: ctx.run.steps, usage: USAGE });
  if (ctx.json) ctx.out(JSON.stringify(body));
  else for (const line of [printable(body.message), ...USAGE]) ctx.out(line);
  return { exit: 2, result: body };
}

if (isMain(import.meta.url)) {
  const { exit } = await runRelease(process.argv.slice(2), {
    root: dirname(dirname(fileURLToPath(import.meta.url))),
    env: process.env,
    isTTY: process.stdin.isTTY === true,
    out: (line) => console.log(line),
  });
  process.exit(exit);
}
