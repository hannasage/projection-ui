// Environment helpers. A child process gets a short allowlist of variables, never a copy of the whole environment,
// so a token in the caller environment cannot reach npm, a test, a build, or gh by accident.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const pick = (env, names) => {
  const copy = {};
  for (const name of names) if (env[name] !== undefined) copy[name] = env[name];
  return copy;
};

/**
 * Makes a throwaway HOME folder with two empty npm config files in it: one for the user config and one for the global config.
 * npm 11 refuses one file that is loaded as both ("double-loading config"), so each gets its own.
 * If anything fails after the folder is made, the folder is removed before the error goes on. `hooks.onCreated` lets a test throw there.
 */
export function makeHome(hooks = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "release-home-")));
  try {
    hooks.onCreated?.(dir);
    writeFileSync(join(dir, "npmrc-user"), "");
    writeFileSync(join(dir, "npmrc-global"), "");
    // A minimal package.json makes this folder the root of its own project, so npm run here (with --prefix) never looks upward
    // at a project that holds the temporary folder, and never reads that project's .npmrc.
    writeFileSync(join(dir, "package.json"), '{"name":"release-scratch","version":"0.0.0","private":true}\n');
    return dir;
  } catch (error) {
    // The first error is the one to report. A failed removal must not replace it.
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // The folder stays, and the original error goes on.
    }
    throw error;
  }
}

export function removeHome(home) {
  rmSync(home, { recursive: true, force: true });
}

/** The allowlist: PATH, a HOME that the caller chooses, LANG, TERM, and CI. Nothing else. */
export function allowlistEnv(env, home, extra = {}) {
  return { ...pick(env, ["PATH", "LANG", "TERM", "CI"]), HOME: home, ...extra };
}

/**
 * The environment for npm and for the project scripts. HOME is a throwaway folder and the user npm config is turned off,
 * so a token in ~/.npmrc is not read. The npm cache and the Playwright browser folder keep their real places when they exist,
 * because they hold public downloads and no secret.
 */
export function toolEnv(env, home, extra = {}) {
  const realHome = env.HOME ?? "";
  const cache = env.npm_config_cache ?? (realHome && existsSync(join(realHome, ".npm")) ? join(realHome, ".npm") : undefined);
  const mac = join(realHome, "Library", "Caches", "ms-playwright");
  const linux = join(realHome, ".cache", "ms-playwright");
  const browsers = env.PLAYWRIGHT_BROWSERS_PATH ?? (realHome && existsSync(mac) ? mac : realHome && existsSync(linux) ? linux : undefined);
  return allowlistEnv(env, home, {
    npm_config_userconfig: join(home, "npmrc-user"),
    npm_config_globalconfig: join(home, "npmrc-global"),
    npm_config_update_notifier: "false",
    NO_UPDATE_NOTIFIER: "1",
    ...(cache ? { npm_config_cache: cache } : {}),
    ...(browsers ? { PLAYWRIGHT_BROWSERS_PATH: browsers } : {}),
    ...extra,
  });
}

/** True when the person already chose an ssh command for git: the variable is set, or core.sshCommand is set in any git config that applies in `cwd`. */
function hasSshCommand(env, cwd) {
  if (typeof env.GIT_SSH_COMMAND === "string" && env.GIT_SSH_COMMAND !== "") return true;
  const result = spawnSync("git", ["config", "--get", "core.sshCommand"], { cwd, env: { PATH: env.PATH ?? "", HOME: env.HOME ?? "", GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" }, encoding: "utf8", timeout: 15_000 });
  return result.status === 0 && (result.stdout ?? "").trim() !== "";
}

/**
 * The environment for git. git needs the real HOME for its config and keys, and an agent socket for ssh. It never prompts.
 * BatchMode makes ssh fail instead of asking for a password or a passphrase, so no command waits for input.
 * An ssh command the person already chose, in GIT_SSH_COMMAND or in core.sshCommand, is theirs and is kept: nothing is set then.
 */
export function gitEnv(env, extra = {}, cwd = process.cwd()) {
  const own = hasSshCommand(env, cwd);
  return {
    ...pick(env, ["PATH", "HOME", "LANG", "TERM", "SSH_AUTH_SOCK", "GIT_SSH_COMMAND"]),
    ...(own ? {} : { GIT_SSH_COMMAND: "ssh -o BatchMode=yes" }),
    GIT_TERMINAL_PROMPT: "0",
    GIT_OPTIONAL_LOCKS: "0",
    ...extra,
  };
}

/** The environment for gh. gh needs its own config folder to find its login, so HOME stays real. No token variable is passed. */
export function ghEnv(env) {
  return { ...pick(env, ["PATH", "HOME", "LANG", "TERM", "CI", "XDG_CONFIG_HOME", "GH_CONFIG_DIR", "GH_HOST"]), ...(hasSshCommand(env, process.cwd()) ? pick(env, ["GIT_SSH_COMMAND"]) : { GIT_SSH_COMMAND: "ssh -o BatchMode=yes" }), GIT_TERMINAL_PROMPT: "0" };
}

/** True when this module file is the one node was started with. A tool exits the process only in that case. */
export function isMain(metaUrl) {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(metaUrl));
  } catch {
    return false;
  }
}
