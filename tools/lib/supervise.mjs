// Runs one command with a time limit and kills its whole process group when the limit passes or when this process is told to stop.
// Usage: node supervise.mjs <milliseconds> <command> [arguments...]
// The command keeps this process standard input, output, and error. The exit code is the command exit code, 124 after a timeout,
// 127 when the command cannot start, and 128 plus the signal number when a signal ends it.
import { spawn } from "node:child_process";
import { constants } from "node:os";
import process from "node:process";

const [limit, command, ...args] = process.argv.slice(2);
const child = spawn(command, args, { stdio: "inherit", detached: true });
let timedOut = false;

function killGroup(signal) {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    // The group is already gone.
  }
}

const timer = setTimeout(() => {
  timedOut = true;
  killGroup("SIGTERM");
  setTimeout(() => killGroup("SIGKILL"), 2000).unref();
}, Number(limit));

for (const signal of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(signal, () => {
    killGroup("SIGKILL");
    process.exit(128 + (constants.signals[signal] ?? 15));
  });
}

child.on("error", (error) => {
  clearTimeout(timer);
  console.error(`could not start ${command}: ${error.message}`);
  process.exit(127);
});

child.on("exit", (code, signal) => {
  clearTimeout(timer);
  // Anything the command left running in its group, such as a server a test started, is stopped now.
  killGroup("SIGKILL");
  if (timedOut) process.exit(124);
  process.exit(code ?? 128 + (constants.signals[signal] ?? 1));
});
