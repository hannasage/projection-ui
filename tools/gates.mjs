// Runs the full gate set in order and reports the real exit code of each command. Safety class: local-write.
//
//   node tools/gates.mjs [--ci] [--bail] [--cwd <folder>] [--json]
//
// The gates are the `gates` list of release.config.json, the same list that `release gates` runs, so the two cannot drift apart:
// `npm run tokens:check`, `typecheck`, `lint`, `test`, `build`, `build:docs`, `test:docs`, and `test:artifact`. With --ci, `npm ci` runs first.
// The tool prints one line per gate. A gate passes only when its exit code is 0, and a pass line never shows over another code.
// A gate that fails prints its first failing line. With --bail the run stops at the first failure.
// The commands write to node_modules (npm ci), dist (build), storybook-static and docs-site (build:docs) in the folder.
// Nothing is written to a remote. The folder must be the top of a work tree of this same package.
// The commands get an allowlist environment (PATH, a throwaway HOME, LANG, TERM, CI), so no token variable and no user npm config reaches them.
// Each command may run for 15 minutes. Then it and everything it started (its whole process group) are stopped, the gate fails, and its exit is 124.
// Exit codes: 0 every gate passed, 1 a gate failed or git is missing, 2 wrong use.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { parseArgs } from "node:util";
import { isMain, makeHome, removeHome, toolEnv } from "./lib/env.mjs";
import { resolvePackageTree } from "./lib/paths.mjs";
import { runSupervised } from "./lib/run.mjs";
import { failingLine, redact } from "./lib/text.mjs";

const USAGE = "Usage: node tools/gates.mjs [--ci] [--bail] [--cwd <folder>] [--json]\nExit codes: 0 every gate passed, 1 a gate failed, 2 wrong use.";
const GATE_LIMIT_MS = 15 * 60 * 1000;

/** The gate names, read from release.config.json in the repository that holds this tool. */
export function readGates() {
  const file = join(dirname(fileURLToPath(import.meta.url)), "../release.config.json");
  const gates = JSON.parse(readFileSync(file, "utf8")).gates;
  if (!Array.isArray(gates) || gates.length === 0 || !gates.every((name) => typeof name === "string" && /^[a-z][a-z0-9:_-]*$/.test(name))) throw new Error("release.config.json has no valid gates list");
  return gates;
}

function usageError(json, message, exit = 2) {
  const text = redact(message);
  if (json) console.log(JSON.stringify({ ok: false, status: exit === 2 ? "usage" : "error", exit, message: text }));
  else console.error(`${text}\n${USAGE}`);
  return exit;
}

/** `options.gateLimitMs` shortens the time limit of each command, for a test. */
export function main(argv, env = process.env, options = {}) {
  let values;
  try {
    ({ values } = parseArgs({ args: argv, strict: true, allowPositionals: false, options: { ci: { type: "boolean" }, bail: { type: "boolean" }, cwd: { type: "string" }, json: { type: "boolean" }, help: { type: "boolean" } } }));
  } catch (error) {
    return usageError(argv.includes("--json"), error instanceof Error ? error.message : String(error));
  }
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  const folder = resolvePackageTree(values.cwd ?? process.cwd());
  if (!folder.ok) return usageError(values.json === true, folder.error, folder.kind === "env" ? 1 : 2);

  let gates;
  try {
    gates = readGates();
  } catch (error) {
    return usageError(values.json === true, error instanceof Error ? error.message : String(error), 1);
  }
  const commands = [...(values.ci ? [{ name: "ci", command: ["npm", "ci"] }] : []), ...gates.map((name) => ({ name, command: ["npm", "run", name] }))];
  const limit = options.gateLimitMs ?? GATE_LIMIT_MS;
  const home = makeHome();
  const childEnv = toolEnv(env, home);
  const results = [];
  try {
    for (const { name, command } of commands) {
      if (!values.json) console.log(`$ ${command.join(" ")}`);
      // The command runs under a supervisor. A timeout stops the command and everything it started, and the exit is 124.
      const result = runSupervised(command[0], command.slice(1), { cwd: folder.path, env: childEnv, timeoutMs: limit });
      const exit = result.status;
      const passed = exit === 0;
      const gate = { name, command: command.join(" "), exit, signal: null, ok: passed };
      if (!passed) {
        if (result.timedOut) gate.firstFailingLine = `timed out after ${limit / 1000} seconds`;
        else if (result.startFailed) gate.firstFailingLine = redact(failingLine(result.stdout, result.stderr));
        else gate.firstFailingLine = failingLine(result.stdout, result.stderr);
      }
      results.push(gate);
      if (!values.json) console.log(passed ? `PASS ${gate.command} (exit ${exit})` : `FAIL ${gate.command} (exit ${exit}) - ${gate.firstFailingLine}`);
      if (!passed && values.bail) break;
    }
  } finally {
    // A folder that cannot be removed is a warning and never a crash.
    try {
      removeHome(home);
    } catch (error) {
      process.stderr.write(`WARNING: could not remove the temporary folder ${home}: ${error instanceof Error ? error.message : "remove failed"}\n`);
    }
  }
  const ok = results.every((gate) => gate.ok) && results.length === commands.length;
  if (values.json) console.log(JSON.stringify({ ok, status: ok ? "pass" : "fail", exit: ok ? 0 : 1, path: folder.path, gates: results }));
  else {
    const failed = results.filter((gate) => !gate.ok).map((gate) => gate.name);
    console.log(ok ? `Result: all ${results.length} gates passed` : `Result: failed - ${failed.join(", ")}`);
  }
  return ok ? 0 : 1;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
