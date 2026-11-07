// A small reader for .github/workflows/publish.yml. It reads only what the release script must agree with:
// the tag filters under `on.push.tags`, and the `run:` steps of one job. It is not a general YAML parser,
// and it refuses (with an error) any shape it does not understand, so it can never agree by accident.

const indentOf = (line) => line.length - line.trimStart().length;
const isBlank = (line) => line.trim() === "" || line.trim().startsWith("#");

function stripComment(value) {
  let quote = null;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote !== null) {
      if (char === quote) quote = null;
    } else if (char === "'" || char === '"') quote = char;
    else if (char === "#" && (index === 0 || /\s/.test(value[index - 1]))) return value.slice(0, index).trim();
  }
  return value.trim();
}

function unquote(value) {
  const text = value.trim();
  return /^(['"]).*\1$/.test(text) ? text.slice(1, -1) : text;
}

/** Returns `{ ok: true, tags }` with the tag filters of the push trigger, or `{ ok: false, error }`. */
export function pushTagFilters(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => /^(?:on|"on"|'on'):\s*(?:#.*)?$/.test(line));
  if (start < 0) return { ok: false, error: "the workflow has no top-level `on:` block" };
  let inPush = false;
  let pushIndent = -1;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (isBlank(line)) continue;
    const indent = indentOf(line);
    if (indent === 0) break;
    if (/^\s*push:\s*(?:#.*)?$/.test(line)) {
      inPush = true;
      pushIndent = indent;
      continue;
    }
    if (inPush && indent <= pushIndent) inPush = false;
    if (inPush && /^\s*tags-ignore:/.test(line)) return { ok: false, error: "the push trigger uses tags-ignore, which this reader does not support" };
    const match = inPush ? /^(\s*)tags:\s*(.*)$/.exec(line) : null;
    if (match === null) continue;
    const value = stripComment(match[2]);
    if (value.startsWith("[")) {
      if (!value.endsWith("]")) return { ok: false, error: "the tags list spans several lines in a form this reader does not support" };
      const items = value.slice(1, -1).split(",").map(unquote).filter((item) => item !== "");
      return items.length > 0 ? { ok: true, tags: items } : { ok: false, error: "the tags list is empty" };
    }
    if (value !== "") return { ok: false, error: `the tags value ${value} is not a list` };
    const items = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      if (isBlank(lines[next])) continue;
      const item = /^(\s*)-\s+(.+)$/.exec(lines[next]);
      if (item === null || indentOf(lines[next]) <= indentOf(line)) break;
      items.push(unquote(stripComment(item[2])));
    }
    return items.length > 0 ? { ok: true, tags: items } : { ok: false, error: "the tags list is empty" };
  }
  return { ok: false, error: "the workflow has no `on.push.tags` filter" };
}

/**
 * True when a GitHub tag filter pattern matches the tag. `*` matches any characters except `/`, and `**` matches any characters.
 * Every other character is literal. A pattern with `?`, `+`, `[`, `]`, or `!` has a meaning this matcher does not model,
 * so it throws instead of guessing.
 */
export function tagMatches(pattern, tag) {
  if (/[?+[\]!]/.test(pattern)) throw new Error(`The tag filter ${pattern} uses a special character that this matcher does not support`);
  let source = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*" && pattern[index + 1] === "*") {
      source += ".*";
      index += 1;
    } else if (char === "*") source += "[^/]*";
    else source += char.replace(/[.\\^$|(){}]/g, "\\$&");
  }
  return new RegExp(`^${source}$`).test(tag);
}

/** The filters that match the tag. An empty list means the workflow would not start for this tag. */
export function matchingFilters(filters, tag) {
  return filters.filter((pattern) => tagMatches(pattern, tag));
}

// A key whose meaning can switch a step or a job off, change what it needs, or change where and how it runs.
const SWITCH_KEY = /^(?:-\s+)?(?:if|continue-on-error|needs|environment|env|uses)\s*:/;

/**
 * Reads the jobs block. Returns { name: { if, needs, continueOnError, environment, env, defaults, unparsed, steps: [...] } } or null.
 * Each step is { run, if, continueOnError, workingDirectory, shell, uses, env }.
 * This is a line reader and not a YAML parser, so it counts every line that holds a switch key (SWITCH_KEY) and every one that it
 * understood at a place where it expects such a key. `unparsed` is the number of the others. A workflow with any other line fails the
 * check, because a key at an odd indent could be a real switch that this reader did not see.
 */
export function parseJobs(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => /^jobs:\s*(?:#.*)?$/.test(line));
  if (start < 0) return null;
  const jobs = {};
  let job = null;
  let inSteps = false;
  let step = null;
  let listKey = null;
  const value = (raw) => unquote(stripComment(raw));
  const setNeeds = (raw) => {
    const text2 = stripComment(raw);
    if (text2.startsWith("[")) job.needs = text2.slice(1, -1).split(",").map(unquote).filter((item) => item !== "");
    else if (text2 === "") {
      job.needs = [];
      listKey = "needs";
    } else job.needs = [unquote(text2)];
  };
  let seen = 0;
  let understood = 0;
  const close = () => {
    if (job !== null) job.unparsed = seen - understood;
    seen = 0;
    understood = 0;
  };
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (isBlank(line)) continue;
    const indent = indentOf(line);
    const trimmed = line.trim();
    if (indent === 0) break;
    if (indent === 2) {
      close();
      const name = /^([A-Za-z0-9_-]+):\s*(?:#.*)?$/.exec(trimmed);
      job = name ? { if: null, needs: null, continueOnError: null, environment: null, env: false, defaults: false, unparsed: 0, steps: [] } : null;
      if (name) jobs[name[1]] = job;
      inSteps = false;
      step = null;
      listKey = null;
      continue;
    }
    if (job === null) continue;
    if (SWITCH_KEY.test(trimmed)) seen += 1;
    if (indent === 4) {
      listKey = null;
      inSteps = /^steps:/.test(trimmed);
      step = null;
      if (/^defaults:/.test(trimmed)) job.defaults = true;
      const pair = /^(if|needs|continue-on-error|environment|env):\s*(.*)$/.exec(trimmed);
      if (pair === null) continue;
      understood += 1;
      if (pair[1] === "if") job.if = value(pair[2]);
      else if (pair[1] === "continue-on-error") job.continueOnError = value(pair[2]);
      else if (pair[1] === "environment") job.environment = value(pair[2]);
      else if (pair[1] === "env") job.env = true;
      else setNeeds(pair[2]);
      continue;
    }
    if (!inSteps && listKey === "needs" && /^-\s+/.test(trimmed)) {
      job.needs.push(value(trimmed.replace(/^-\s+/, "")));
      continue;
    }
    if (!inSteps) continue;
    let pair = null;
    if (indent === 6 && trimmed.startsWith("- ")) {
      step = { run: null, if: null, continueOnError: null, workingDirectory: null, shell: null, uses: null, env: false };
      job.steps.push(step);
      pair = /^-\s+([A-Za-z-]+):\s*(.*)$/.exec(trimmed);
    } else if (indent === 8 && step !== null) pair = /^([A-Za-z-]+):\s*(.*)$/.exec(trimmed);
    if (pair === null || step === null) continue;
    if (SWITCH_KEY.test(trimmed)) understood += 1;
    if (pair[1] === "run") step.run = value(pair[2]);
    else if (pair[1] === "if") step.if = value(pair[2]);
    else if (pair[1] === "continue-on-error") step.continueOnError = value(pair[2]);
    else if (pair[1] === "working-directory") step.workingDirectory = value(pair[2]);
    else if (pair[1] === "shell") step.shell = value(pair[2]);
    else if (pair[1] === "uses") step.uses = value(pair[2]);
    else if (pair[1] === "env") step.env = true;
  }
  close();
  return jobs;
}

/** Returns the `run:` commands of one job, in order, or null when the job is not found. */
export function jobRunSteps(text, jobName) {
  const job = parseJobs(text)?.[jobName];
  return job === undefined ? null : job.steps.filter((step) => step.run !== null).map((step) => step.run);
}

const ALWAYS_TRUE = new Set(["true", "${{ true }}", "${{true}}"]);
const ALWAYS_FALSE = new Set(["false", "${{ false }}", "${{false}}"]);

/**
 * Checks that the verify job gates the publish job, that no gate can be switched off, and that the jobs say nothing the reader missed.
 * `gates` and `ciOnly` are lists of command forms: each item is a list of accepted spellings of one command. The verify job may run
 * only the gates, the CI-only commands, and the extra commands in `alsoAllowed`, and it must run every one of the first two.
 * `justified` maps a step command to the step keys (working-directory, shell) that the config allows on it.
 * `publishEnvironment` and `publishUses` pin the environment of the publish job and the actions it may use.
 * Returns a problem text, or null when the workflow keeps its promises.
 */
export function gateProblem(text, { verifyJob, publishJob, gates, ciOnly = [], alsoAllowed = [], publishCommand, justified = {}, publishEnvironment, publishUses }) {
  const jobs = parseJobs(text);
  if (jobs === null) return "the workflow has no jobs block";
  const verify = jobs[verifyJob];
  const publish = jobs[publishJob];
  if (verify === undefined) return `the workflow has no job named ${verifyJob}`;
  if (publish === undefined) return `the workflow has no job named ${publishJob}`;
  for (const [name, job] of [[verifyJob, verify], [publishJob, publish]]) {
    if (job.unparsed > 0) return `the ${name} job has ${job.unparsed} line(s) with if, continue-on-error, needs, environment, env, or uses that this reader did not understand at its place, so the check cannot trust the job`;
  }
  if (/^defaults:/m.test(text)) return "the workflow sets default run settings (working directory or shell), which change what every gate runs";
  if (verify.defaults) return `the ${verifyJob} job sets default run settings (working directory or shell), which change what every gate runs`;
  if (verify.if !== null) return `the ${verifyJob} job has an if condition (${verify.if}), so it can be skipped`;
  if (verify.continueOnError !== null && !ALWAYS_FALSE.has(verify.continueOnError)) return `the ${verifyJob} job has continue-on-error: ${verify.continueOnError}`;
  const covered = (forms) => verify.steps.find((candidate) => candidate.run !== null && forms.includes(candidate.run));
  for (const forms of [...gates, ...ciOnly]) {
    const step = covered(forms);
    if (step === undefined) return `the ${verifyJob} job does not run: ${forms[0]}`;
    if (step.if !== null && !ALWAYS_TRUE.has(step.if)) return `the step "${step.run}" has an if condition (${step.if}), so it can be skipped`;
    if (step.continueOnError !== null && !ALWAYS_FALSE.has(step.continueOnError)) return `the step "${step.run}" has continue-on-error: ${step.continueOnError}`;
    const allowed = justified[step.run] ?? [];
    if (step.workingDirectory !== null && !allowed.includes("working-directory")) return `the step "${step.run}" sets working-directory (${step.workingDirectory}), so it may not run what the script runs. Justify it in release.config.json or remove it`;
    if (step.shell !== null && !allowed.includes("shell")) return `the step "${step.run}" sets shell (${step.shell}), so it may not run what the script runs. Justify it in release.config.json or remove it`;
  }
  // Two-way: every command the verify job runs is a gate, a CI-only command, or an allowed extra. Otherwise a tag could fail in CI.
  const known = new Set([...gates, ...ciOnly, ...alsoAllowed].flat());
  const stray = verify.steps.find((candidate) => candidate.run !== null && !known.has(candidate.run));
  if (stray !== undefined) return `the ${verifyJob} job runs "${stray.run}", which is neither in gates nor in ciOnlyGates of release.config.json. A tag that CI would reject cannot be moved, so list it`;
  if (publish.needs === null || !publish.needs.includes(verifyJob)) return `the ${publishJob} job does not need the ${verifyJob} job (needs: ${publish.needs === null ? "missing" : `[${publish.needs.join(", ")}]`})`;
  if (publish.if !== null) return `the ${publishJob} job has an if condition (${publish.if})`;
  if (publish.continueOnError !== null && !ALWAYS_FALSE.has(publish.continueOnError)) return `the ${publishJob} job has continue-on-error: ${publish.continueOnError}`;
  if (publishEnvironment !== undefined && publish.environment !== publishEnvironment) return `the ${publishJob} job must use the environment ${publishEnvironment} (it says ${publish.environment ?? "nothing"})`;
  if (publish.env) return `the ${publishJob} job sets env at the job level`;
  const envStep = publish.steps.find((candidate) => candidate.env);
  if (envStep !== undefined) return `a step of the ${publishJob} job sets env (${envStep.run ?? envStep.uses ?? "a step"}), which can change what it publishes`;
  if (publishUses !== undefined) {
    const extra = publish.steps.find((candidate) => candidate.uses !== null && !publishUses.includes(candidate.uses));
    if (extra !== undefined) return `the ${publishJob} job uses "${extra.uses}", which is not in publishUses of release.config.json`;
  }
  const publishStep = publish.steps.find((candidate) => candidate.run === publishCommand);
  if (publishStep === undefined) return `the ${publishJob} job does not run: ${publishCommand}`;
  if (publishStep.if !== null && !ALWAYS_TRUE.has(publishStep.if)) return `the step "${publishCommand}" has an if condition (${publishStep.if})`;
  return null;
}
