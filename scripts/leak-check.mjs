// Fails when the repo holds something that must not be public: an Azure-style
// GUID (tenant, subscription, client ID) or a name from the private denylist.
// Scans every tracked file, images included (their metadata is plain bytes),
// and, when given a git range, the commits and diffs in that range.
//
//   LEAK_DENYLIST="name one, name two" node scripts/leak-check.mjs [base..head]
//
// The denylist lives in the LEAK_DENYLIST repository secret, never in the
// repo. Terms are separated by commas or new lines, match whole words and
// ignore case. Findings name the file and term number, never the term.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const git = (...args) => execFileSync("git", args, { maxBuffer: 1 << 28 });
const GUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const PLACEHOLDER = "00000000-0000-0000-0000-000000000000";

const terms = (process.env.LEAK_DENYLIST ?? "")
  .split(/[,\n]/)
  .map((t) => t.trim())
  .filter(Boolean);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const denied = terms.map((t) => new RegExp(`(?<![a-z0-9])${escape(t)}(?![a-z0-9])`, "i"));

if (!terms.length) {
  console.log("::warning::LEAK_DENYLIST is not set, so only GUIDs are checked.");
}

const findings = [];
function scan(where, buffer) {
  // latin1 keeps every byte. NULs end fields in image metadata but sit
  // inside UTF-16 text (Windows EXIF comments), so read binaries both ways.
  const text = buffer.toString("latin1");
  const binary = buffer.includes(0);
  const lines = binary
    ? [...text.split(/[\0\n]/), ...text.replace(/\0/g, "").split("\n")]
    : text.split("\n");
  lines.forEach((line, i) => {
    const at = binary ? where : `${where}:${i + 1}`;
    for (const [guid] of line.matchAll(GUID)) {
      if (guid !== PLACEHOLDER) findings.push(`${at}: GUID (use ${PLACEHOLDER})`);
    }
    denied.forEach((re, n) => {
      if (re.test(line)) findings.push(`${at}: denylist term #${n + 1}`);
    });
  });
}

for (const file of git("ls-files", "-z").toString().split("\0").filter(Boolean)) {
  scan(file, readFileSync(file));
}
const range = process.argv[2];
if (range) scan(`commits ${range}`, git("log", "-p", "--format=%an%n%ae%n%B", range));

const unique = [...new Set(findings)];
for (const f of unique) console.log(`::error::${f}`);
console.log(unique.length ? `${unique.length} leak(s) found.` : "No leaks found.");
process.exit(unique.length ? 1 : 0);
