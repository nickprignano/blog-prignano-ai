// Asks Claude to read the posts and images a pull request adds or changes and
// flag employer leaks, oversharing and other risky content before it's public.
//
//   ANTHROPIC_API_KEY=... node scripts/post-review.mjs [base..head]
//
// Extra private context (who the employer is, topics to avoid) comes from the
// POST_REVIEW_CONTEXT secret, and the LEAK_DENYLIST names are passed along
// too; neither is ever in the repo. This repo is public, so in GitHub Actions
// the findings show only file, line and category. Run it locally to read
// Claude's notes. Findings marked "block" fail the check; "warn" doesn't.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const range = process.argv[2] ?? "origin/main...HEAD";
const IMAGE_TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const changed = execFileSync("git", ["diff", "--name-only", "--diff-filter=AM", "-z", range])
  .toString()
  .split("\0")
  .filter(Boolean);
const posts = changed.filter((f) => /^src\/content\/posts\/.*\.mdx?$/.test(f));
const images = changed.filter((f) => IMAGE_TYPES[f.split(".").pop().toLowerCase()]);

if (!posts.length && !images.length) {
  console.log("No posts or images changed.");
  process.exit(0);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.log("::warning::ANTHROPIC_API_KEY is not set, so posts were not reviewed.");
  process.exit(0);
}

const SYSTEM = `You review posts for Nick's personal technical blog before they are published on the public internet. Nick has a day job, and the blog must never embarrass him, his employer, or the people he works with. Read each post (front matter included) and each image, and flag anything that a careful employer, customer or partner would not want public:

- employer-internal: internal tools, systems, processes, org structure, people, metrics, or how the employer works, beyond what it has said publicly.
- customer-or-partner: a customer or partner that can be identified by name or by detail, or their environment, problems or results.
- confidential: unreleased products or features, roadmaps, pricing, deals, incidents, outages, security weaknesses, or anything described as internal or under NDA.
- employer-opinion: criticism or praise of the employer, its products, leadership or colleagues, or of its competitors in a way that could read as the employer's view.
- speaking-for-employer: anything that reads as an official statement, promise or recommendation from the employer.
- identifying-data: in text or images, real tenant, subscription or account IDs, hostnames, internal URLs, email addresses, usernames, names or faces of other people, or screenshots that show any of these.

Use severity "block" when publishing it as written is likely to cause real trouble, and "warn" when it is worth a second look. Generic, public technical knowledge, Nick's own opinions about public products and technology, and his own personal story are fine; do not flag them. Placeholders like contoso and 00000000-0000-0000-0000-000000000000 are fine. Report each issue once, at the line it starts on (use line 0 for images), with a short note saying what is risky and how to fix it. Return an empty list if nothing needs attention.`;

const privateContext = [
  process.env.POST_REVIEW_CONTEXT,
  process.env.LEAK_DENYLIST && `These names must never appear, even indirectly: ${process.env.LEAK_DENYLIST}`,
]
  .filter(Boolean)
  .join("\n\n");

const content = [];
for (const file of posts) {
  const numbered = readFileSync(file, "utf8")
    .split("\n")
    .map((line, i) => `${i + 1}| ${line}`)
    .join("\n");
  content.push({ type: "text", text: `Post ${file}:\n${numbered}` });
}
for (const file of images) {
  const data = readFileSync(file);
  if (data.length > MAX_IMAGE_BYTES) {
    console.log(`::warning file=${file}::Image is over 5 MB, so it was not reviewed. Check it by eye.`);
    continue;
  }
  content.push({ type: "text", text: `Image ${file}:` });
  content.push({
    type: "image",
    source: { type: "base64", media_type: IMAGE_TYPES[file.split(".").pop().toLowerCase()], data: data.toString("base64") },
  });
}

const SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          file: { type: "string" },
          line: { type: "integer" },
          category: {
            type: "string",
            enum: ["employer-internal", "customer-or-partner", "confidential", "employer-opinion", "speaking-for-employer", "identifying-data"],
          },
          severity: { type: "string", enum: ["block", "warn"] },
          note: { type: "string" },
        },
        required: ["file", "line", "category", "severity", "note"],
        additionalProperties: false,
      },
    },
  },
  required: ["findings"],
  additionalProperties: false,
};

const response = await new Anthropic().beta.messages.create({
  model: "claude-opus-5-5",
  max_tokens: 16000,
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
  output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
  system: privateContext ? `${SYSTEM}\n\nPrivate context from Nick:\n${privateContext}` : SYSTEM,
  messages: [{ role: "user", content }],
});
if (response.stop_reason !== "end_turn") {
  console.log(`::error::The review didn't finish (${response.stop_reason}). Re-run it or review the post by hand.`);
  process.exit(1);
}

const { findings } = JSON.parse(response.content.find((b) => b.type === "text").text);
const inActions = Boolean(process.env.GITHUB_ACTIONS);
for (const f of findings) {
  const level = f.severity === "block" ? "error" : "warning";
  const where = f.line ? `file=${f.file},line=${f.line}` : `file=${f.file}`;
  // Notes can quote the risky detail, so they stay out of public logs.
  const detail = inActions ? "run `npm run post-review` locally for details" : f.note;
  console.log(`::${level} ${where}::${f.category}: ${detail}`);
}
const blocking = findings.filter((f) => f.severity === "block").length;
console.log(`${findings.length} finding(s), ${blocking} blocking.`);
process.exit(blocking ? 1 : 0);
