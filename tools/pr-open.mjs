// Opens a draft pull request with a checked body. Safety class: remote-write.
//
//   node tools/pr-open.mjs --title <text> --body-file <file> --base <branch> [--dir <folder>] [--dry-run] [--json]
//
// The tool checks the title and the body before it touches GitHub (see tools/lib/pr-body.mjs): the first line of the body is a
// GitHub alert, at most 300 words, no contractions, no invisible characters, the body ends with the footer line,
// and neither text holds a home path or a session link.
// The body file must lie inside the repository, the system temporary folder, or the folder named by the environment variable SAGE_BODY_DIR
// (it must exist and must not be the root of the disk or a home folder). The tool reads it once, checks that text,
// and hands exactly that text to gh on standard input, so the file cannot change between the check and the call.
// It then runs `gh pr create --draft --base <branch> --title <text> --body-file -`. It only ever opens a DRAFT.
// There is no flag to open a ready pull request. A person or the merge gate marks it ready later.
// gh must print a pull request URL. Anything else is a failure, even when gh exits 0.
// Before it creates anything, it asks gh who is logged in (`gh api user --jq .login`) and prints that name. If gh fails after it may have
// created the pull request, the message says so: check GitHub before you try again. gh gets an allowlist environment with the real HOME,
// because gh keeps its login in its own config folder. No token variable is passed.
// With --dry-run it checks the text and prints the command, and it does not call gh.
// Exit codes: 0 opened (or dry run passed), 1 the text or gh failed or git is missing, 2 wrong use.
import { readFileSync } from "node:fs";
import process from "node:process";
import { parseArgs } from "node:util";
import { ghEnv, isMain } from "./lib/env.mjs";
import { bodyDirRoot, resolveFile, resolvePackageTree, tempRoot } from "./lib/paths.mjs";
import { runSupervised } from "./lib/run.mjs";
import { deepRedact, failingLine, redact, show } from "./lib/text.mjs";
import { validateBody, validateTitle } from "./lib/pr-body.mjs";

const USAGE = [
  "Usage: node tools/pr-open.mjs --title <text> --body-file <file> --base <branch> [--dir <folder>] [--expect-identity <login>] [--dry-run] [--json]",
  "Opens a DRAFT pull request. The text is checked first. Exit codes: 0 opened, 1 the text or gh failed, 2 wrong use.",
  "--expect-identity cannot pass with a GitHub App token, because that token cannot read its own login. gh pr create runs in --dir, so git hooks of a hostile --dir could run: only use a folder you trust.",
  "gh runs with the real HOME and its own config folder on purpose, because that is where it keeps its login. No token variable is passed.",
  "It prints the gh identity before it creates anything, and it stops gh after 120 seconds.",
].join("\n");

const PR_URL = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+$/;
/** A branch name that git would accept and that cannot be read as an option, a path climb, a reflog form, or a hidden or lock component. */
export function safeBranch(name) {
  if (!BRANCH.test(name) || name.length > 200) return false;
  if (name.includes("..") || name.includes("//") || name.includes("@{") || name.endsWith("/") || name.endsWith(".")) return false;
  return name.split("/").every((part) => part !== "" && !part.startsWith(".") && !part.endsWith(".lock"));
}
const BRANCH = /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9._-]+)*$/;

function usageError(json, message, exit = 2) {
  const text = redact(message);
  if (json) console.log(JSON.stringify({ ok: false, status: exit === 2 ? "usage" : "error", exit, message: text }));
  else console.error(`${text}\n${USAGE}`);
  return exit;
}

/** `options.createLimitMs` shortens the time limit of `gh pr create`, for a test. */
export function main(argv, env = process.env, options = {}) {
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      strict: true,
      allowPositionals: false,
      options: { title: { type: "string" }, "body-file": { type: "string" }, base: { type: "string" }, dir: { type: "string" }, "expect-identity": { type: "string" }, "dry-run": { type: "boolean" }, json: { type: "boolean" }, help: { type: "boolean" } },
    }));
  } catch (error) {
    return usageError(argv.includes("--json"), error instanceof Error ? error.message : String(error));
  }
  const json = values.json === true;
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  const title = values.title?.trim() ?? "";
  if (title === "" || /[\r\n\0]/.test(title) || title.length > 256) return usageError(json, "--title is required, must be one line, and at most 256 characters");
  const base = values.base ?? "";
  if (!safeBranch(base)) return usageError(json, "--base is required and must be a branch name");
  if (values["body-file"] === undefined) return usageError(json, "--body-file is required");
  const folder = resolvePackageTree(values.dir ?? process.cwd());
  if (!folder.ok) return usageError(json, `--dir: ${folder.error}`, folder.kind === "env" ? 1 : 2);
  const extra = bodyDirRoot(env);
  if (!extra.ok) return usageError(json, extra.error);
  const file = resolveFile(values["body-file"], 64 * 1024, [folder.top, tempRoot(), ...(extra.root === null ? [] : [extra.root])]);
  if (!file.ok) return usageError(json, `--body-file: ${file.error}`);

  let body;
  try {
    body = readFileSync(file.path, "utf8");
  } catch (error) {
    return usageError(json, `--body-file: cannot read ${file.path}: ${error instanceof Error ? error.message : "read failed"}`);
  }
  const problems = [...validateTitle(title), ...validateBody(body)];
  if (problems.length > 0) {
    if (json) console.log(JSON.stringify({ ok: false, status: "invalid-body", exit: 1, problems }));
    else for (const problem of problems) console.log(`INVALID ${problem}`);
    return 1;
  }

  // --draft is always in the command. No option turns it off. The body comes in on standard input: this exact, checked text.
  const command = ["gh", "pr", "create", "--draft", "--base", base, "--title", title, "--body-file", "-"];
  if (values["dry-run"]) {
    // The title was checked, so it holds no secret and is shown as it is.
    if (!json) console.log(`$ ${redact(show(command))}`);
    if (json) console.log(JSON.stringify(deepRedact({ ok: true, status: "dry-run", exit: 0, draft: true, command: show(command), url: null })));
    else console.log("Dry run: the text is valid and gh was not called.");
    return 0;
  }
  const environment = ghEnv(env);
  const warnings = [];
  const mayExist = "a PR may exist: check before retrying";
  const failure = (status, line, extra = {}, step = "gh pr create") => {
    // A failure of the identity step happens before any command for the pull request exists, so it names no command.
    const named = step === "gh identity" ? {} : { command: show(command) };
    if (json) console.log(JSON.stringify(deepRedact({ ok: false, status, exit: 1, draft: true, ...named, failingLine: line, ...(warnings.length > 0 ? { warnings } : {}), ...extra })));
    else {
      for (const warning of warnings) console.log(`WARNING ${redact(warning)}`);
      console.log(`FAILED ${step}: ${redact(line)}`);
    }
    return 1;
  };
  // Say which account gh uses before anything is created. A GitHub App token cannot read it (403, "Resource not accessible by
  // integration"), and only that case is a warning, and only when --expect-identity did not ask for a proof. Any other failure stops the run.
  const expected = values["expect-identity"];
  const who = ["gh", "api", "user", "--jq", ".login"];
  if (!json) console.log(`$ ${show(who)}`);
  const identity = runSupervised(who[0], who.slice(1), { cwd: folder.path, env: environment, timeoutMs: 30_000 });
  let login = null;
  const text = `${identity.stderr}\n${identity.stdout}`;
  if (identity.status !== 0) {
    const forbidden = !identity.timedOut && !identity.startFailed && /Resource not accessible by integration/i.test(text);
    const line = identity.startFailed ? `could not start gh: ${failingLine(identity.stdout, identity.stderr)}` : identity.timedOut ? "gh did not say who is logged in within 30 seconds" : `could not read the gh identity: ${failingLine(identity.stdout, identity.stderr)}`;
    if (expected !== undefined || !forbidden) return failure("gh-identity-failed", line, {}, "gh identity");
    warnings.push(line);
  } else {
    login = identity.stdout.trim().split("\n").at(-1) ?? "";
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,38})(?:\[bot\])?$/.test(login)) return failure("gh-identity-invalid", "gh printed an identity that is not a login", {}, "gh identity");
    if (expected !== undefined && login.toLowerCase() !== expected.toLowerCase()) return failure("gh-identity-mismatch", `gh is signed in as ${login}, not as ${expected}`, { identity: login }, "gh identity");
  }
  if (!json) {
    for (const warning of warnings) console.log(`WARNING ${redact(warning)}`);
    if (login !== null) console.log(`Using the gh identity: ${login}`);
    console.log(`$ ${redact(show(command))}`);
  }
  const createLimit = options.createLimitMs ?? 120_000;
  const result = runSupervised(command[0], command.slice(1), { cwd: folder.path, env: environment, input: body, timeoutMs: createLimit });
  const url = result.stdout.trim().split("\n").at(-1)?.trim() ?? "";
  // "A PR may exist" only where gh may have got as far as creating one: a timeout, a spawn error that is not "no such program"
  // or "no permission" (for example ENOBUFS), a non-zero exit whose output shows a pull request address, and an exit 0 with no address.
  // A clean failure before the create, such as a bad flag or a missing login, creates nothing.
  if (result.startFailed) {
    const never = /ENOENT|EACCES/.test(result.stderr);
    return failure("gh-failed", `${failingLine(result.stdout, result.stderr)}${never ? "" : `. ${mayExist}`}`, { identity: login });
  }
  if (result.timedOut) return failure("gh-timeout", `gh did not finish in ${createLimit / 1000} seconds. ${mayExist}`, { identity: login });
  if (result.status !== 0) {
    const shown = /https:\/\/\S+\/pull\/\d+/.test(`${result.stdout}\n${result.stderr}`);
    return failure("gh-failed", `${failingLine(result.stdout, result.stderr)}${shown ? `. ${mayExist}` : ""}`, { identity: login });
  }
  if (!PR_URL.test(url)) return failure("no-url", `gh exited 0 but did not print a pull request URL, so no pull request is proven. ${mayExist}`, { identity: login });
  if (json) console.log(JSON.stringify(deepRedact({ ok: true, status: "pass", exit: 0, draft: true, identity: login, command: show(command), url, ...(warnings.length > 0 ? { warnings } : {}) })));
  else console.log(redact(url));
  return 0;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
