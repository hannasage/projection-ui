// Path arguments for the tools. Every path a tool takes goes through one of these functions first.
// Each one resolves the value to an absolute path, follows links to the real path, and refuses what does not fit.
// A refusal is `{ ok: false, error, kind }`. `kind` is "usage" for a bad value (exit 2) or "env" when git itself cannot run (exit 1).
import { spawnSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, parse, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { gitEnv } from "./env.mjs";

const here = dirname(fileURLToPath(import.meta.url));

/** The name in the package.json of the repository that holds these tools. */
export function ownPackageName() {
  return JSON.parse(readFileSync(join(here, "../../package.json"), "utf8")).name;
}

function checkText(input) {
  if (typeof input !== "string" || input.trim() === "") return "the path is empty or is not text";
  if (input.includes("\0")) return "the path holds a null byte";
  return null;
}

// git gets the short allowlisted environment, never a copy of the whole one.
const gitEnvFor = (path) => gitEnv(process.env, {}, path);

/** Resolves a folder that is inside a git work tree. On success it returns `{ ok: true, path, top }`. */
export function resolveWorkTree(input) {
  const bad = checkText(input);
  if (bad !== null) return { ok: false, kind: "usage", error: bad };
  let path;
  try {
    path = realpathSync(resolve(input));
    if (!statSync(path).isDirectory()) return { ok: false, kind: "usage", error: `${path} is not a folder` };
  } catch {
    return { ok: false, kind: "usage", error: `${resolve(input)} does not exist` };
  }
  const inside = spawnSync("git", ["-C", path, "rev-parse", "--is-inside-work-tree"], { encoding: "utf8", env: gitEnvFor(path) });
  if (inside.error !== undefined) return { ok: false, kind: "env", error: `git could not run: ${inside.error.message}` };
  if (inside.status !== 0 || inside.stdout.trim() !== "true") return { ok: false, kind: "usage", error: `${path} is not inside a git work tree` };
  const top = spawnSync("git", ["-C", path, "rev-parse", "--show-toplevel"], { encoding: "utf8", env: gitEnvFor(path) });
  if (top.error !== undefined) return { ok: false, kind: "env", error: `git could not run: ${top.error.message}` };
  // The folder was found to be inside a work tree, so a failing second question is a git failure and not a wrong use.
  if (top.status !== 0) return { ok: false, kind: "env", error: `git could not name the top of the work tree of ${path}: ${(top.stderr ?? "").trim().split("\n")[0]}` };
  return { ok: true, path, top: realpathSync(top.stdout.trim()) };
}

/**
 * Resolves the top folder of a work tree of this same package. A tool that runs npm scripts or opens a pull request
 * must not be pointed at some other project, so the folder must be the top of its tree and its package.json must carry this package name.
 * The name is a guard against a wrong folder and not a proof of identity: anyone can write a package.json. The tools run the scripts of the tree they are given, so the caller must trust that tree.
 */
export function resolvePackageTree(input, expectedName = ownPackageName()) {
  const tree = resolveWorkTree(input);
  if (!tree.ok) return tree;
  if (tree.path !== tree.top) return { ok: false, kind: "usage", error: `${tree.path} is not the top of a work tree (the top is ${tree.top})` };
  let name;
  try {
    // The file must be a regular file in the tree. A link could point at a file that has the right name somewhere else.
    const manifest = join(tree.top, "package.json");
    if (!lstatSync(manifest).isFile()) return { ok: false, kind: "usage", error: `${manifest} is not a regular file` };
    name = JSON.parse(readFileSync(manifest, "utf8")).name;
  } catch {
    return { ok: false, kind: "usage", error: `${tree.top} has no readable package.json` };
  }
  if (name !== expectedName) return { ok: false, kind: "usage", error: `${tree.top} is the package ${name}, not ${expectedName}` };
  return tree;
}

/** True when `path` is `root` or lies below it. Both must already be real paths. */
export function isInside(root, path) {
  return path === root || path.startsWith(root.endsWith(sep) ? root : root + sep);
}

/**
 * Resolves a regular file no larger than `maxBytes`. When `roots` is given, the real path must lie under one of them.
 * On success it returns `{ ok: true, path }`.
 */
export function resolveFile(input, maxBytes = 1024 * 1024, roots = null) {
  const bad = checkText(input);
  if (bad !== null) return { ok: false, kind: "usage", error: bad };
  try {
    const path = realpathSync(resolve(input));
    const info = statSync(path);
    if (!info.isFile()) return { ok: false, kind: "usage", error: `${path} is not a file` };
    if (info.size > maxBytes) return { ok: false, kind: "usage", error: `${path} is larger than ${maxBytes} bytes` };
    if (roots !== null && !roots.some((root) => isInside(root, path))) return { ok: false, kind: "usage", error: `${path} is outside the repository and the temporary folder` };
    return { ok: true, path };
  } catch {
    return { ok: false, kind: "usage", error: `${resolve(input)} does not exist` };
  }
}

/** The real path of the system temporary folder. */
export function tempRoot() {
  return realpathSync(tmpdir());
}

/**
 * The extra folder named by the environment variable SAGE_BODY_DIR, where a session may keep its body files.
 * Returns { ok: true, root } (root is null when the variable is unset) or { ok: false, error }.
 * The folder must exist, must be a folder, and must not be the root of the disk or a home folder.
 */
export function bodyDirRoot(env = process.env) {
  const value = env.SAGE_BODY_DIR;
  if (value === undefined || value === "") return { ok: true, root: null };
  const bad = checkText(value);
  if (bad !== null) return { ok: false, error: `SAGE_BODY_DIR: ${bad}` };
  let root;
  try {
    root = realpathSync(resolve(value));
    if (!statSync(root).isDirectory()) return { ok: false, error: `SAGE_BODY_DIR: ${root} is not a folder` };
  } catch {
    return { ok: false, error: `SAGE_BODY_DIR: ${resolve(value)} does not exist` };
  }
  const homes = new Set([env.HOME, homedir()].filter((home) => typeof home === "string" && home !== "").map((home) => {
    try {
      return realpathSync(home);
    } catch {
      return resolve(home);
    }
  }));
  if (root === resolve("/") || root === parse(root).root || homes.has(root)) return { ok: false, error: `SAGE_BODY_DIR: ${root} is the root of the disk or a home folder, which is too wide` };
  return { ok: true, root };
}
