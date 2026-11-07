// Reports whether a clone tree is safe to remove. Safety class: read-only.
//
//   node tools/tree-clean.mjs <tree> [--json]
//
// It checks three things and prints one line for each:
//   clean   no changed file, no untracked file, no stash entry, and no ignored file except rebuildable output
//           (node_modules, dist, .next, and the build folders listed in REBUILDABLE below). Other ignored files may hold
//           local work that exists nowhere else, such as a .env file, so they fail the check.
//   pushed  no local branch holds a commit that no remote-tracking branch has, and the current branch matches its upstream.
//           A local tag (annotated or not) that no remote has, with the same object, fails too. An upstream on the remote "." (a local branch)
//           does not count as pushed. Branches compare with the last fetch. Tags are read with `git ls-remote`, which reads and writes nothing.
//   idle    no process has its working folder inside the tree. It reads `lsof -a -d cwd`, and lsof must exit 0 or 1.
//           As a non-root user it cannot see the processes of other users. The tool prints one line that says so.
// It exits 0 only when all three pass.
// This tool REMOVES NOTHING. It never deletes a file, a branch, or a worktree. Removal belongs to the factory-tree finish step
// of the workbench scripts. Run this tool first, and let that step do the removal.
// The tool lists the keys of the tree's own git config first, and refuses the tree when a key can make git run a program, or when the tree has submodules or a gitlink.
// Exit codes: 0 all three pass, 1 a check failed or git is missing, 2 wrong use.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { parseArgs } from "node:util";
import { gitEnv, isMain } from "./lib/env.mjs";
import { resolvePackageTree } from "./lib/paths.mjs";
import { redact } from "./lib/text.mjs";

const USAGE = [
  "Usage: node tools/tree-clean.mjs <tree> [--json]",
  "Checks that a clone tree is clean, pushed, and idle. Exit 0 only when all three pass.",
  "This tool removes nothing. Removal belongs to the factory-tree finish step of the workbench scripts.",
  "Note: the tool refuses a tree whose own git config has a key that can make git run a program (a filter, a diff or merge driver, an external diff, an attributes file, a signing program, a credential helper, an ssh or proxy command, an include) or that hides submodule changes, and a tree that has submodules or a nested repository.",
  "Exit codes: 0 all pass, 1 a check failed, 2 wrong use.",
].join("\n");

/** Ignored paths that a build recreates. A path equal to one of these, or below one, is not a reason to keep the tree. */
export const REBUILDABLE = [
  "dist",
  "storybook-static",
  "release-artifacts",
  "docs-site/out",
  "docs-site/.source",
  "docs-site/.generated",
  "docs-site/content",
  "docs-site/public/examples",
  "docs-site/public/markdown",
  "docs-site/public/archives",
  "docs-site/public/downloads",
  "docs-site/public/llms.txt",
  "docs-site/public/llms-full.txt",
  "docs-site/public/release.json",
  "docs-site/public/changelog.md",
  "docs-site/public/docs-versions.json",
  "docs-site/next-env.d.ts",
  "docs-site/tsconfig.tsbuildinfo",
];

/** True when an ignored path is rebuildable output: any node_modules or .next folder, or a path under REBUILDABLE. */
export function isRebuildable(path) {
  const clean = path.replace(/\/+$/, "");
  const segments = clean.split("/");
  if (segments.includes("node_modules") || segments.includes(".next")) return true;
  return REBUILDABLE.some((entry) => clean === entry || clean.startsWith(`${entry}/`));
}

// GIT_OPTIONAL_LOCKS=0 keeps git status from rewriting the index, so this read-only tool changes nothing.
const sshChoice = new Map();
/** The git environment for one tree. Whether the person set an ssh command is looked up once per tree. */
function gitEnvFor(tree) {
  if (!sshChoice.has(tree)) sshChoice.set(tree, gitEnv(process.env, {}, tree));
  return sshChoice.get(tree);
}
// The tree is any folder, so its config is not trusted: git runs with no fsmonitor, no hooks, and no external transport program.
const SAFE_CONFIG = ["-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "-c", "protocol.ext.allow=never"];
const git = (tree, ...args) => spawnSync("git", [...SAFE_CONFIG, "-C", tree, ...args], { encoding: "utf8", env: gitEnvFor(tree), maxBuffer: 64 * 1024 * 1024, timeout: 120_000 });
export const plural = (count, word) => {
  if (count === 1) return `${count} ${word}`;
  const many = /(?:ch|sh|s|x|z)$/.test(word) ? `${word}es` : /[^aeiou]y$/.test(word) ? `${word.slice(0, -1)}ies` : `${word}s`;
  return `${count} ${many}`;
};
const firstLine = (text) => redact(text.trim().split("\n")[0] ?? "");

/** Splits `git status --porcelain=v1 -z --ignored` into `{ code, path }` entries. */
export function parseStatus(text) {
  const parts = text.split("\0").filter((part) => part !== "");
  const entries = [];
  for (let index = 0; index < parts.length; index += 1) {
    const code = parts[index].slice(0, 2);
    entries.push({ code, path: parts[index].slice(3) });
    if (code[0] === "R" || code[0] === "C") index += 1;
  }
  return entries;
}

/** The first file below a folder that git collapsed into one ignored entry and that a build does not recreate, or null. */
function firstUnrecreatable(tree, folder) {
  const clean = folder.replace(/\/+$/, "");
  if (isRebuildable(clean)) return null;
  let names;
  try {
    names = readdirSync(join(tree, clean), { withFileTypes: true });
  } catch {
    return clean;
  }
  for (const entry of names) {
    const path = `${clean}/${entry.name}`;
    if (isRebuildable(path)) continue;
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      const inner = firstUnrecreatable(tree, path);
      if (inner !== null) return inner;
    } else return path;
  }
  return null;
}

// A repository config that can make git run a program (a filter, a pager, a credential helper, a diff or merge driver, an alias)
// or that pulls in more config. The tool does not chase flags to switch each one off. If the tree has any of these, it refuses the tree.
const RISKY_KEYS = [
  /^filter\./i,
  /^core\.(fsmonitor|sshcommand|askpass|gitproxy|attributesfile|alternaterefscommand)$/i,
  /^remote\..*\.(uploadpack|receivepack)$/i,
  /^gpg\.program$/i,
  /^diff\.external$/i,
  /^diff\.ignoresubmodules$/i,
  /^submodule\..*\.ignore$/i,
  /^diff\..*\.(command|textconv)$/i,
  /^merge\..*\.driver$/i,
  /^gpg\..*\.program$/i,
  /^credential\./i,
  /^include(if)?\./i,
  /^(uploadpack|receivepack)\./i,
];
// Not on the list: core.hooksPath, core.editor, core.pager, alias.*, and url.*. A status never runs them, and a repository may set
// core.hooksPath on purpose (the agent guide of a repository can ask for it). The tool also runs git with hooks switched off.

/** The first key in the tree's own config that matches a risky pattern, null when none does, or an error text. */
export function riskyConfig(tree) {
  const keys = [];
  for (const scope of ["--local", "--worktree"]) {
    const result = git(tree, "config", scope, "--list", "--name-only");
    if (result.error !== undefined) return { error: `git config could not run: ${firstLine(result.error.message)}` };
    if (result.status === 0) keys.push(...result.stdout.split("\n").filter((line) => line !== ""));
    else if (scope === "--local") return { error: `git config could not be read: ${firstLine(result.stderr)}` };
  }
  const key = keys.find((name) => RISKY_KEYS.some((pattern) => pattern.test(name)));
  if (key !== undefined) return { key };
  // Submodules and nested repositories run their own filters when git status looks inside them, so a tree that has any is refused:
  // a .gitmodules file, a modules folder in the git folder or in the common folder or in any linked worktree folder, or any gitlink entry.
  const gitDir = git(tree, "rev-parse", "--absolute-git-dir");
  const common = git(tree, "rev-parse", "--path-format=absolute", "--git-common-dir");
  if (gitDir.status !== 0 || common.status !== 0) return { error: `git could not name its folders: ${firstLine(gitDir.stderr || common.stderr)}` };
  const folders = [gitDir.stdout.trim(), common.stdout.trim()];
  const linked = join(common.stdout.trim(), "worktrees");
  if (existsSync(linked)) for (const name of readdirSync(linked)) folders.push(join(linked, name));
  if (existsSync(join(tree, ".gitmodules")) || folders.some((folder) => existsSync(join(folder, "modules")))) return { submodules: true };
  const staged = git(tree, "ls-files", "-s");
  if (staged.status !== 0) return { error: `git ls-files failed: ${firstLine(staged.stderr)}` };
  if (staged.stdout.split("\n").some((line) => line.startsWith("160000 "))) return { submodules: true };
  return null;
}

function checkClean(tree) {
  // Every untracked file is shown whatever the config says, and submodules are not skipped.
  const status = git(tree, "-c", "status.showUntrackedFiles=all", "status", "--porcelain=v1", "-z", "--ignored=matching", "--untracked-files=all", "--ignore-submodules=none");
  if (status.error !== undefined || status.status !== 0) return { ok: false, detail: `git status failed: ${firstLine(status.error?.message ?? status.stderr)}` };
  const entries = parseStatus(status.stdout);
  const changed = entries.filter((entry) => entry.code !== "!!");
  // git shows a folder whose files are all ignored as one entry. Look inside it, so a rebuildable folder cannot hide a local file next to it.
  const ignored = entries
    .filter((entry) => entry.code === "!!" && !isRebuildable(entry.path))
    .map((entry) => (entry.path.endsWith("/") ? firstUnrecreatable(tree, entry.path) : entry.path))
    .filter((path) => path !== null);
  // A file marked assume-unchanged (a lowercase tag) or skip-worktree (S) hides its changes from git status.
  const flagged = git(tree, "ls-files", "-v");
  if (flagged.error !== undefined || flagged.status !== 0) return { ok: false, detail: `git ls-files failed: ${firstLine(flagged.error?.message ?? flagged.stderr)}` };
  const hidden = flagged.stdout.split("\n").filter((line) => /^[a-zS] /.test(line));
  if (hidden.length > 0) return { ok: false, detail: `${plural(hidden.length, "file")} marked assume-unchanged or skip-worktree, so git status may hide a change, first: ${hidden[0].slice(2)}` };
  const stash = git(tree, "stash", "list");
  if (stash.error !== undefined || stash.status !== 0) return { ok: false, detail: `git stash list failed: ${firstLine(stash.error?.message ?? stash.stderr)}` };
  const stashes = stash.stdout.split("\n").filter((line) => line !== "");
  const problems = [];
  if (changed.length > 0) problems.push(`${plural(changed.length, "changed or untracked path")}, first: ${changed[0].code} ${changed[0].path}`);
  if (ignored.length > 0) problems.push(`${plural(ignored.length, "ignored path")} that a build does not recreate, first: ${ignored[0]}`);
  if (stashes.length > 0) problems.push(`${plural(stashes.length, "stash entry")}`);
  return problems.length === 0 ? { ok: true, detail: "no changed, untracked, stashed, or unrecreatable ignored file" } : { ok: false, detail: problems.join("; ") };
}

/** Every local tag must exist on some remote with the same object. A tag lives only in this folder until a remote has it. */
function checkTags(tree) {
  const listed = git(tree, "for-each-ref", "--format=%(refname:strip=2) %(objectname)", "refs/tags");
  if (listed.error !== undefined || listed.status !== 0) return { ok: false, detail: `git for-each-ref failed: ${firstLine(listed.error?.message ?? listed.stderr)}` };
  const local = listed.stdout.split("\n").filter((line) => line !== "").map((line) => line.split(" "));
  if (local.length === 0) return { ok: true, detail: "no local tag" };
  const remotes = git(tree, "remote").stdout.split("\n").filter((line) => line !== "");
  const onRemote = new Set();
  for (const remote of remotes) {
    const result = git(tree, "ls-remote", "--tags", "--", remote);
    if (result.error !== undefined || result.status !== 0) return { ok: false, detail: `could not read the tags of ${remote}, so local tags are not proven pushed: ${firstLine(result.error?.message ?? result.stderr)}` };
    for (const line of result.stdout.split("\n")) {
      const [hash, ref] = line.split(/\s+/);
      if (hash && ref && ref.startsWith("refs/tags/") && !ref.endsWith("^{}")) onRemote.add(`${ref.slice("refs/tags/".length)} ${hash}`);
    }
  }
  const missing = local.find(([name, hash]) => !onRemote.has(`${name} ${hash}`));
  return missing === undefined ? { ok: true, detail: "every local tag is on a remote" } : { ok: false, detail: `the local tag ${missing[0]} is on no remote with the same object` };
}

function checkPushed(tree) {
  const branch = git(tree, "symbolic-ref", "--short", "-q", "HEAD");
  if (branch.status !== 0) return { ok: false, detail: "detached head: no branch to compare with a remote" };
  const name = branch.stdout.trim();
  const remoteName = git(tree, "config", "--get", `branch.${name}.remote`);
  if (remoteName.status === 0 && remoteName.stdout.trim() === ".") return { ok: false, detail: `the upstream of ${name} is a local branch (remote "."), so nothing is pushed` };
  let upstream = git(tree, "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}");
  let ref = upstream.status === 0 ? upstream.stdout.trim() : null;
  if (ref === null) {
    const fallback = `origin/${name}`;
    upstream = git(tree, "rev-parse", "--verify", "-q", `refs/remotes/${fallback}`);
    ref = upstream.status === 0 ? fallback : null;
  }
  if (ref === null) return { ok: false, detail: `the branch ${name} has no remote branch` };
  const ahead = git(tree, "rev-list", "--count", `${ref}..HEAD`);
  if (ahead.status !== 0) return { ok: false, detail: `git rev-list failed: ${firstLine(ahead.stderr)}` };
  if (Number(ahead.stdout.trim()) > 0) return { ok: false, detail: `${plural(Number(ahead.stdout.trim()), "commit")} not on ${ref}` };
  // Every other local branch too: removing the tree deletes them all.
  const loose = git(tree, "rev-list", "--branches", "--not", "--remotes", "--count");
  if (loose.status !== 0) return { ok: false, detail: `git rev-list failed: ${firstLine(loose.stderr)}` };
  if (Number(loose.stdout.trim()) > 0) {
    const heads = git(tree, "for-each-ref", "--format=%(refname:short)", "refs/heads").stdout.split("\n").filter((line) => line !== "");
    const unpushed = heads.filter((head) => Number(git(tree, "rev-list", "--count", head, "--not", "--remotes").stdout.trim()) > 0);
    return { ok: false, detail: `${plural(Number(loose.stdout.trim()), "commit")} on a local branch that no remote branch has${unpushed.length > 0 ? `, branches: ${unpushed.join(", ")}` : ""}` };
  }
  const tags = checkTags(tree);
  if (!tags.ok) return tags;
  return { ok: true, detail: `${name} matches ${ref} as of the last fetch, every local branch is on a remote, and every local tag is on a remote` };
}

/** The processes whose working folder is the tree or a folder below it. */
export function processesInside(tree, listing, ownPids) {
  const found = [];
  let current = null;
  for (const line of listing.split("\n")) {
    const tag = line[0];
    const rest = line.slice(1);
    if (tag === "p") current = { pid: Number(rest), command: "", path: "" };
    else if (current === null) continue;
    else if (tag === "c") current.command = rest;
    else if (tag === "n") {
      current.path = rest;
      const inside = rest === tree || rest.startsWith(`${tree}/`);
      if (inside && !ownPids.has(current.pid)) found.push({ ...current });
    }
  }
  return found;
}

function checkIdle(tree) {
  const result = spawnSync("lsof", ["-a", "-d", "cwd", "-Fpcn"], { cwd: "/", encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 60_000 });
  if (result.error !== undefined) return { ok: false, detail: `lsof could not run: ${firstLine(result.error.message)}` };
  if (result.status !== 0 && result.status !== 1) return { ok: false, detail: `lsof exited ${result.status}, so idle is not proven` };
  if (result.stdout === "") return { ok: false, detail: `lsof printed nothing and exited ${result.status}, so idle is not proven` };
  const inside = processesInside(tree, result.stdout, new Set([process.pid, result.pid]));
  if (inside.length === 0) return { ok: true, detail: "no process has its working folder inside the tree" };
  const names = inside.map((entry) => `${entry.command} (pid ${entry.pid})`);
  return { ok: false, detail: `${plural(inside.length, "process")} inside: ${names.join(", ")}` };
}

function usageError(json, message, exit = 2) {
  const text = redact(message);
  if (json) console.log(JSON.stringify({ ok: false, status: exit === 2 ? "usage" : "error", exit, message: text }));
  else console.error(`${text}\n${USAGE}`);
  return exit;
}

export function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, strict: true, allowPositionals: true, options: { json: { type: "boolean" }, help: { type: "boolean" } } });
  } catch (error) {
    return usageError(argv.includes("--json"), error instanceof Error ? error.message : String(error));
  }
  const json = parsed.values.json === true;
  if (parsed.values.help) {
    console.log(USAGE);
    return 0;
  }
  if (parsed.positionals.length !== 1) return usageError(json, "Give exactly one tree path.");
  const tree = resolvePackageTree(parsed.positionals[0]);
  if (!tree.ok) return usageError(json, tree.error, tree.kind === "env" ? 1 : 2);

  const risky = riskyConfig(tree.top);
  if (risky !== null) {
    const detail = risky.error ?? (risky.submodules ? "refused: the tree has submodules or a nested repository (.gitmodules, a modules folder, or a gitlink entry), and git status would run their filters, so no status was run on this tree" : `refused: the config key ${risky.key} can make git run a program, so no git command except the config read was run on this tree`);
    if (json) console.log(JSON.stringify({ ok: false, status: "fail", exit: 1, path: tree.top, removes: "nothing", refused: true, checks: [{ name: "config", ok: false, detail: redact(detail) }] }));
    else {
      console.log(`FAIL config - ${redact(detail)}`);
      console.log("Result: the tree is not safe to remove. This tool removed nothing.");
    }
    return 1;
  }

  const checks = [
    { name: "clean", ...checkClean(tree.top) },
    { name: "pushed", ...checkPushed(tree.top) },
    { name: "idle", ...checkIdle(tree.top) },
  ];
  const ok = checks.every((check) => check.ok);
  const note = process.getuid?.() === 0 ? null : "As a non-root user, this tool cannot see the processes of other users, so idle covers only your own processes.";
  if (json) console.log(JSON.stringify({ ok, status: ok ? "pass" : "fail", exit: ok ? 0 : 1, path: tree.top, removes: "nothing", note, checks }));
  else {
    for (const check of checks) console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name} - ${check.detail}`);
    if (note) console.log(`NOTE ${note}`);
    console.log(ok ? "Result: the tree is safe to remove. This tool removed nothing." : "Result: the tree is not safe to remove. This tool removed nothing.");
  }
  return ok ? 0 : 1;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
