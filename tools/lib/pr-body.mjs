// The rules for the body and the title of a pull request. `tools/pr-open.mjs` checks them before it calls GitHub.
// No rule uses a pattern that can backtrack badly: the checks are string compares, a split on white space, and short fixed patterns.
import { HIDDEN, spaceHidden, stripHidden } from "./invisible.mjs";
import { redact } from "./text.mjs";

export const FOOTER = "🤖 Generated with [Claude Code](https://claude.com/claude-code)";
export const ALERTS = ["NOTE", "TIP", "IMPORTANT", "CAUTION", "WARNING"].map((type) => `> [!${type}]`);
export const MAX_WORDS = 300;

// A letter, an apostrophe (straight, curly, high-reversed, prime, or a modifier letter), then a contraction ending, and no letter after.
// A possessive such as "the team's" has the same shape as "it's", so it counts too. Write "the name of the team" instead.
// The text is normalized first, so a full-width apostrophe becomes a straight one. The test ignores case and covers any alphabet.
const CONTRACTION = /\p{L}['‘’‛′ʹʻʼˈ`](?:t|s|re|ve|ll|d|m)(?!\p{L})/iu;
const HOME_PATHS = [/\/Users\/[^\s/]+/i, /\/home\/[^\s/]+/i, /(?:^|[^\w.-])\/root(?:\/|\s|$)/, /\/var\/root\b/i, /[A-Za-z]:\\Users\\[^\s\\]+/, /\\Users\\[^\s\\]+/];
const SESSION_LINKS = [/claude\.ai\/(?:code|chat|share|artifact|local_sessions|s|project|projects)\b/i, /\bsession_[A-Za-z0-9]{8,}/];

/** Decodes the ways a slash or a path can be written in text: HTML entities, percent codes, and look-alike slashes. A bad code is left as it is. */
function decodeOnce(text) {
  let out = text.replace(/&#(?:x([0-9a-f]{1,6})|(\d{1,7}));|&(sol|bsol|apos|quot|amp);/gi, (whole, hex, dec, name) => {
    if (name !== undefined) return { sol: "/", bsol: "\\", apos: "'", quot: '"', amp: "&" }[name.toLowerCase()];
    const code = hex !== undefined ? parseInt(hex, 16) : Number(dec);
    return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
  // Each run of percent codes is decoded on its own, so one bad code does not stop the others from being decoded.
  out = out.replace(/(?:%[0-9a-f]{2}){1,200}/gi, (run) => {
    try {
      return decodeURIComponent(run);
    } catch {
      return run;
    }
  });
  // Division slash, fraction slash, big solidus, and the set-minus look-alikes of the backslash.
  return out.replace(/[∕⁄⧸]/g, "/").replace(/[∖⧵]/g, "\\");
}

/** Decodes up to four times, so a double encoding (`&amp;#47;`, `%252F`) is undone too. */
function decoded(text) {
  let out = text;
  for (let pass = 0; pass < 4; pass += 1) {
    const next = decodeOnce(out);
    if (next === out) break;
    out = next;
  }
  return out;
}

/** The text in the forms a check must look at: the raw text, the cleaned text, and the cleaned text with codes decoded. */
function views(text) {
  const clean = stripHidden(text).normalize("NFKC");
  return [text, clean, decoded(clean)];
}

export function countWords(text) {
  let count = 0;
  for (const word of spaceHidden(text).split(/\s+/)) if (word !== "") count += 1;
  return count;
}

/** Problems that make any public text unfit: a home path, a session link, a hidden character, or something shaped like a secret. */
export function privateContentProblems(text, what = "the text") {
  const problems = [];
  const forms = views(text);
  const example = ["", "Users", "name"].join("/");
  if (HOME_PATHS.some((pattern) => forms.some((form) => pattern.test(form)))) problems.push(`${what} has a home path (such as ${example}). Remove it`);
  if (SESSION_LINKS.some((pattern) => forms.some((form) => pattern.test(form)))) problems.push(`${what} has a session link. Remove it`);
  if (redact(text) !== text) problems.push(`${what} has a text shaped like a token or a password. Remove it`);
  HIDDEN.lastIndex = 0;
  if (HIDDEN.test(text)) problems.push(`${what} has an invisible character (such as a zero-width space or a direction override). Remove it`);
  HIDDEN.lastIndex = 0;
  return problems;
}

function contractionProblems(text, what) {
  return views(text).some((form) => CONTRACTION.test(form)) ? [`${what} has a contraction (such as don't, it's, or we're). Write the words out`] : [];
}

/** Returns the list of problems with a pull request title. An empty list means the title is allowed. */
export function validateTitle(text) {
  if (typeof text !== "string" || text.trim() === "") return ["the title is empty or is not text"];
  return [...contractionProblems(text, "the title"), ...privateContentProblems(text, "the title")];
}

/** Returns the list of problems with a body. An empty list means the body is allowed. */
export function validateBody(text) {
  if (typeof text !== "string" || text.trim() === "") return ["the body is empty or is not text"];
  const problems = [];
  if (text.includes("\r")) problems.push("the body has carriage returns (CRLF line ends). Use line feeds only");
  const newline = text.indexOf("\n");
  const first = newline === -1 ? text : text.slice(0, newline);
  if (!ALERTS.includes(first)) problems.push("the first line must be a GitHub alert, such as > [!NOTE], > [!TIP], > [!IMPORTANT], > [!CAUTION], or > [!WARNING]");
  const words = countWords(text);
  if (words > MAX_WORDS) problems.push(`the body has ${words} words, and the limit is ${MAX_WORDS}`);
  problems.push(...contractionProblems(text, "the body"));
  // One final line feed is allowed. Nothing else may follow the footer line: not a blank line, not a space.
  const body = text.endsWith("\n") ? text.slice(0, -1) : text;
  if (body !== FOOTER && !body.endsWith(`\n${FOOTER}`)) problems.push(`the body must end with the line: ${FOOTER}`);
  problems.push(...privateContentProblems(text, "the body"));
  return problems;
}
