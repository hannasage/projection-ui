// Runs a command to the end, or until its time limit, and returns what it printed. The command runs under tools/lib/supervise.mjs,
// so a timeout stops the command and everything it started (its whole process group), and the result says so.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SUPERVISOR = join(dirname(fileURLToPath(import.meta.url)), "supervise.mjs");

/**
 * Returns { status, stdout, stderr, timedOut, startFailed }. `command` may be "node", which means the running node binary.
 * Options: cwd, env, input, timeoutMs (default 120000), maxBuffer.
 */
export function runSupervised(command, args, options = {}) {
  const limit = options.timeoutMs ?? 120_000;
  const result = spawnSync(process.execPath, [SUPERVISOR, String(limit), command === "node" ? process.execPath : command, ...args], {
    cwd: options.cwd,
    env: options.env,
    input: options.input,
    encoding: "utf8",
    maxBuffer: options.maxBuffer ?? 256 * 1024 * 1024,
    // A backstop in case the supervisor itself hangs. The supervisor stops the command first.
    timeout: limit + 15_000,
    killSignal: "SIGKILL",
  });
  if (result.error !== undefined) {
    const late = result.error.code === "ETIMEDOUT";
    return { status: late ? 124 : 127, stdout: result.stdout ?? "", stderr: late ? "" : String(result.error.message), timedOut: late, startFailed: !late };
  }
  const status = result.status ?? 128;
  return { status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", timedOut: status === 124, startFailed: status === 127 && /^could not start /m.test(result.stderr ?? "") };
}
