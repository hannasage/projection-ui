// Small text helpers shared by the tools and by scripts/release.mjs. There is one copy of each, so every output path scrubs the same way.

// Key names whose value is a secret. Used inside text ("token: x") and, in deepRedact, as the name of a field.
// Any name that ends in _key, _secret, _token, _password, or _passwd counts too (AWS_SECRET_ACCESS_KEY, MY_SERVICE_KEY).
const FIXED_NAMES = "_authToken|_auth|_password|passwd|passphrase|otp|pwd|npm_config__auth(?:token|password)?|private_?key|access_token|authToken|client_secret|secret|token|password|api[-_]?key|AccountKey";
const SUFFIX_NAMES = "[A-Za-z][A-Za-z0-9_]{0,60}(?:_key|_secret|_token|_password|_passwd)";
const KEY_NAMES = `${FIXED_NAMES}|${SUFFIX_NAMES}`;
// A value after a key: a double-quoted string (with escapes), a single-quoted string, or a run of non-space characters.
// Every repeat is bounded, so no input can make the matcher slow.
const VALUE = String.raw`(?:"(?:[^"\\]|\\.){0,2000}"|'(?:[^'\\]|\\.){0,2000}'|\S{1,2000})`;
// A plain number or word is not a secret ("secret=true", "token: 5"), so it stays readable.
const PLAIN = /^(?:true|false|null|undefined|none)$/i;
const keepsValue = (value) => PLAIN.test(value.replace(/^["']|["']$/g, ""));

const SECRET_PATTERNS = [
  // A private key block, also when the end line is missing.
  [/-----BEGIN [A-Z ]{0,30}PRIVATE KEY-----[\s\S]{0,10000}?(?:-----END [A-Z ]{0,30}PRIVATE KEY-----|$)/g, "[redacted]"],
  // A key and a value in JSON, with escaped quotes, in double or single quotes, also when the closing quote is missing.
  [new RegExp(String.raw`("(?:${KEY_NAMES})"\s*:\s*")(?:[^"\\]|\\.){0,2000}("?)`, "gi"), "$1[redacted]$2"],
  // A number as the value of a secret key in JSON ("password": 12345) becomes a string, so the JSON stays valid.
  [new RegExp(String.raw`("(?:${KEY_NAMES})"\s*:\s*)-?\d[\d.eE+-]{0,60}`, "gi"), '$1"[redacted]"'],
  [new RegExp(String.raw`('(?:${KEY_NAMES})'\s*:\s*')(?:[^'\\]|\\.){0,2000}('?)`, "gi"), "$1[redacted]$2"],
  // A number under a single-quoted secret key, and a list (of numbers or text) under a secret key in either quote style.
  [new RegExp(String.raw`('(?:${KEY_NAMES})'\s*:\s*)-?\d[\d.eE+-]{0,60}`, "gi"), "$1'[redacted]'"],
  [new RegExp(String.raw`((["'])(?:${KEY_NAMES})\2\s*:\s*)\[[^\]]{0,2000}\]?`, "gi"), (whole, head, quote) => `${head}${quote}[redacted]${quote}`],
  // A password inside a URL: after the first colon of the user part, up to the @ that comes before the host. The password may hold
  // spaces and a second @. It may not hold a slash, so a URL with a port and a path stays readable. A bare token as the user name.
  [/(\/\/[^\s/:@[]{1,128}:)([^\s]{1,512})@(?=[A-Za-z0-9[])/g, (whole, head, password) => (/^\d+\//.test(password) ? whole : `${head}[redacted]@`)],
  [/(\/\/)[A-Za-z0-9_.~-]{20,256}@/g, "$1[redacted]@"],
  // Headers.
  [/(\bAuthorization:[ \t]*)[^\r\n]{1,4000}/gi, "$1[redacted]"],
  [/(\bx-api-key:\s*)\S{1,2000}/gi, "$1[redacted]"],
  [/(\b(?:Set-)?Cookie:[ \t]*)[^\r\n]{1,4000}/gi, "$1[redacted]"],
  [/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{1,2000}/gi, "$1[redacted]"],
  // An environment variable or a key in a config file (KEY=value, KEY: value, key = value), with or without quotes.
  [new RegExp(String.raw`(\b(?:${KEY_NAMES}|[A-Z][A-Z0-9]{0,60}(?:TOKEN|SECRET|PASSWORD))\s{0,8}[=:]\s{0,8})(${VALUE})`, "gi"), (whole, head, value) => (keepsValue(value) ? whole : `${head}[redacted]`)],
  // One-time-code settings, and flags that carry a secret.
  [/((?:NPM_CONFIG_OTP|npm_config_otp)\s*[=:]\s*)\S{1,200}/g, "$1[redacted]"],
  [/(\s--?(?:token|password|pass|passphrase|secret|api-?key|access-?token|auth-?token)(?:=|\s+))\S{1,2000}/gi, "$1[redacted]"],
  [/^(--?(?:token|password|pass|passphrase|secret|api-?key|access-?token|auth-?token)(?:=|\s+))\S{1,2000}/gi, "$1[redacted]"],
  [/(\s--?(?:otp|one-time-password)(?:=|\s+))\S{1,200}/g, "$1[redacted]"],
  [/^(--?(?:otp|one-time-password)(?:=|\s+))\S{1,200}/g, "$1[redacted]"],
  // Tokens by their prefix.
  [/github_pat_[A-Za-z0-9_]{20,255}/g, "[redacted]"],
  [/gh[pousr]_[A-Za-z0-9]{20,255}/g, "[redacted]"],
  [/npm_[A-Za-z0-9]{20,255}/g, "[redacted]"],
  [/sk-ant-[A-Za-z0-9_-]{10,255}/g, "[redacted]"],
  [/sk-proj-[A-Za-z0-9_-]{10,255}/g, "[redacted]"],
  [/\bsk-[A-Za-z0-9_-]{20,255}/g, "[redacted]"],
  [/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{10,255}/g, "[redacted]"],
  [/pypi-[A-Za-z0-9_-]{20,500}/g, "[redacted]"],
  [/\bSG\.[A-Za-z0-9_-]{16,100}\.[A-Za-z0-9_-]{16,100}/g, "[redacted]"],
  [/shpat_[A-Za-z0-9]{16,255}/g, "[redacted]"],
  [/dop_v1_[A-Za-z0-9]{20,255}/g, "[redacted]"],
  [/whsec_[A-Za-z0-9]{10,255}/g, "[redacted]"],
  [/ya29\.[A-Za-z0-9_-]{20,500}/g, "[redacted]"],
  [/AGE-SECRET-KEY-[A-Z0-9]{10,255}/g, "[redacted]"],
  [/https:\/\/hooks\.slack\.com\/(?:services|workflows)\/[A-Za-z0-9\/_-]{10,255}/g, "[redacted]"],
  [/glpat-[A-Za-z0-9_-]{20,255}/g, "[redacted]"],
  [/xox[abposr]-[A-Za-z0-9-]{10,255}/g, "[redacted]"],
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, "[redacted]"],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, "[redacted]"],
  [/\beyJ[A-Za-z0-9_-]{5,500}\.[A-Za-z0-9_-]{5,500}\.[A-Za-z0-9_-]{0,500}/g, "[redacted]"],
];

/** Removes anything shaped like a token, a bearer header, a cookie, a private key, a password in a URL, or a one-time-code flag from text that is about to be shown. */
export function redact(text) {
  let out = String(text);
  for (const [pattern, replacement] of SECRET_PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

const SECRET_KEY = new RegExp(String.raw`^(?:${KEY_NAMES}|authorization|cookie|set-cookie|x-api-key)$`, "i");

/**
 * Redacts every string inside a value, one string at a time, and keeps the shape. Use it before JSON.stringify.
 * Each string is redacted on its own, so a token at the end of a field can not reach past the end of that field
 * and damage the JSON around it.
 */
export function deepRedact(value) {
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.map(deepRedact);
  // A field with a secret name is redacted whatever its value looks like.
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, (typeof inner === "string" || typeof inner === "number" || Array.isArray(inner)) && SECRET_KEY.test(key) ? "[redacted]" : deepRedact(inner)]));
  return value;
}


// Escape sequences (colors, cursor moves, window titles) and control characters. A text from a config file must not repaint a terminal.
const ANSI = /\u001B\[[0-?]*[ -/]*[@-~]|\u001B\][^\u0007\u001B]*(?:\u0007|\u001B\\)|\u001B[@-Z\\-_]/g;
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/g;

/** Removes escape sequences and control characters, so that text printed from a file cannot move the cursor or hide itself. */
export function printable(text) {
  return String(text).replace(ANSI, "").replace(CONTROL, " ");
}

// A zero count is not a failure line: "0 errors", "fail 0", "# fail 0".
const ZERO_COUNT = /\b(?:0|no) (?:errors?|failures?|failed|failing)\b|\b(?:errors?|fail(?:ed|ures?)?)[:=]?\s+0\b/i;
const STRONG = /^(?:✖|✗|×|not ok\b|FAIL\b|Error\b|npm error\b|npm ERR!|.*\berror TS\d+|.*:\d+:\d+:?\s+error\b)/i;
const WEAK = /error|fail|not ok|✗|×|✖/i;

/**
 * The one line to show for a failed command. Every line is redacted first, then the chosen line is shortened,
 * so a token can never be cut in half and slip past the patterns.
 */
export function failingLine(stdout, stderr) {
  const lines = redact(`${stderr ?? ""}\n${stdout ?? ""}`)
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => printable(line).trim())
    .filter((line) => line !== "");
  const real = lines.filter((line) => !ZERO_COUNT.test(line));
  const pick = real.find((line) => STRONG.test(line)) ?? real.find((line) => WEAK.test(line)) ?? lines[0] ?? "no output";
  return pick.length > 300 ? `${pick.slice(0, 300)}...` : pick;
}

/** Shows a command the way a person would type it. Escape sequences and control characters are removed first. */
export function show(command) {
  return command
    .map((part) => printable(part))
    .map((part) => (/^[\w@%+=:,./-]+$/.test(part) ? part : `'${part.replaceAll("'", "'\\''")}'`))
    .join(" ");
}
