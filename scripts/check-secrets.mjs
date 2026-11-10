#!/usr/bin/env node
// Looks for keys and personal data in the files Git is about to upload. It runs before every commit.
// It does not find everything: it is a safety net, and you still have to look yourself.
// To accept a line that gives a false alarm, end that line with the comment "secret-ok".
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT } from "./lib/env.mjs";

const PATTERNS = [
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["API key", /\b(sk-[A-Za-z0-9_-]{20,}|sk_live_[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|EAA[A-Za-z0-9]{40,})\b/],
  ["JWT token", /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}/],
  ["database URL with a password", /postgres(ql)?:\/\/[^:\s"'`]+:(?!password@|postgres@|\$|\.\.\.|…|<)[^@\s"'`]{6,}@(?!localhost|127\.0\.0\.1)/],
  ["hub secret", /\b(hub|dev|ref|inv|code)_[A-Za-z0-9_-]{40,}\b/],
  ["env variable with a value", /^\s*(HUB_ENCRYPTION_KEY|GOOGLE_CLIENT_SECRET|DATABASE_URL)\s*=\s*(?!$|postgresql:\/\/user:)\S{12,}/],
  ["phone number", /(?<![\w.-])(\+34|0034)?[ ]?[6789]\d{2}[ .]?\d{3}[ .]?\d{3}(?![\w-])|(?<![\w.])\+\d{2}[ ]?\d{9,11}(?!\w)/],
  ["a person's email", /\b[A-Za-z0-9._%+-]+@(?!demo\.test|example\.test|example\.com|company\.com)[A-Za-z0-9.-]+\.[a-z]{2,}\b/i],
  ["Spanish ID number (DNI or NIE)", /\b([0-9]{8}[A-HJ-NP-TV-Z]|[XYZ][0-9]{7}[A-HJ-NP-TV-Z])\b/],
];
const SKIP = /^(package-lock\.json|LICENSE|scripts\/check-secrets\.mjs)$|\.(png|jpg|jpeg|webp|ico|woff2?|pdf)$/;

let files;
try {
  files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
} catch { console.error("This is not a Git repository."); process.exit(1); }

let warnings = 0;
for (const file of files) {
  if (SKIP.test(file)) continue;
  let text;
  try { text = fs.readFileSync(path.join(ROOT, file), "utf8"); } catch { continue; }
  text.split("\n").forEach((line, i) => {
    if (line.includes("secret-ok")) return;
    for (const [label, pattern] of PATTERNS) {
      const m = line.match(pattern);
      if (m) { warnings++; console.log(`${file}:${i + 1}  ${label}: ${m[0].slice(0, 12)}…`); }
    }
  });
}
if (warnings) { console.log(`\n✗ ${warnings} ${warnings === 1 ? "warning" : "warnings"}. Remove the data or, if it is a false alarm, mark the line with "secret-ok".`); process.exit(1); }
console.log(`✓ ${files.length} files checked, no warnings.`);
