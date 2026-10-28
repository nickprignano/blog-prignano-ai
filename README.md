# blog.prignano.ai

Source for [blog.prignano.ai](https://blog.prignano.ai): adventures in vibe
coding and overcoming self-imposed boundaries.

It's a static [Astro](https://astro.build) site. Cloudflare builds it and
deploys it whenever something is merged to `main`.

## Add a post

1. Create a branch.
2. Add a Markdown file to `src/content/posts/`. The file name becomes the URL,
   so `src/content/posts/fslogix-sizing.md` is published at
   `https://blog.prignano.ai/posts/fslogix-sizing/`. Use lowercase words
   joined by hyphens.
3. Start the file with this front matter:

   ```markdown
   ---
   title: "Sizing FSLogix profile containers"
   description: "One or two sentences. Shown on the home page, in search results and in LinkedIn previews."
   date: 2026-10-20
   tags: [avd, fslogix]
   ---

   The post starts here.
   ```

   | Field         | Required | Notes                                                                      |
   | ------------- | -------- | -------------------------------------------------------------------------- |
   | `title`       | yes      |                                                                            |
   | `description` | yes      | Up to 200 characters.                                                      |
   | `date`        | yes      | `YYYY-MM-DD`. Posts are listed newest first.                               |
   | `updated`     | no       | `YYYY-MM-DD`, shown as "Updated" on the post.                              |
   | `tags`        | no       | Lowercase, hyphens for spaces: `azure-virtual-desktop`, not `Azure VD`.    |
   | `draft`       | no       | `true` keeps the post off the live site; it still shows in `npm run dev`.  |

4. Open a pull request. The **Build** check fails if the front matter is
   missing or malformed, so a broken post can't reach the live site. Cloudflare
   also posts a preview link for the branch, if preview builds are on (see
   below).
5. Merge. The post is live a minute or two later.

### Writing tips

- Fence code with its language for highlighting: ` ```hcl `, ` ```powershell `,
  ` ```bash `, ` ```json `, ` ```yaml `. Every code block gets a Copy button.
- Put images next to the post, e.g. `src/content/posts/fslogix-sizing/diagram.png`,
  and reference them relatively: `![Diagram](./fslogix-sizing/diagram.png)`.
- The LinkedIn preview image is generated from the title, date and tags. Check
  it at `/og/posts/<file-name>.png` in a preview build.
- First tag sets the color of the post's line art. Colors for common tags are
  in `TAG_HUES` in `src/site.ts`.

### Before you publish

This repo is public. Don't commit secrets, tenant or subscription IDs, or the
names of employers or customers. Use placeholders such as
`00000000-0000-0000-0000-000000000000` and `contoso`.

The Leak check workflow enforces this on every pull request. It runs
[gitleaks](https://github.com/gitleaks/gitleaks) for secrets, then
`scripts/leak-check.mjs`, which fails on any GUID other than the all-zero
placeholder and on any name in the `LEAK_DENYLIST` repository secret (commas
or new lines between names, whole words, any case). It reads posts, front
matter, image metadata and the pull request's commits, but not text drawn
inside an image, so check screenshots by eye. To run it locally:

```sh
LEAK_DENYLIST="name one, name two" npm run leak-check
```

The Post review workflow then has Claude read the posts and images a pull
request adds or changes, and fail the check on employer leaks and
oversharing: internal tools or processes, customer or partner details,
confidential or unreleased work, opinions about the employer, anything that
reads as speaking for it, and IDs, hostnames or other people's details in
text or screenshots. It needs the `ANTHROPIC_API_KEY` repository secret, and
reads the optional `POST_REVIEW_CONTEXT` secret for private background, such
as who the employer is and topics to stay away from. Because this repo is
public, the check shows only the file, line and category. To read Claude's
notes, run it locally against your branch:

```sh
ANTHROPIC_API_KEY=... POST_REVIEW_CONTEXT="..." npm run post-review
```

## Run it locally

Needs Node 22 or newer.

```sh
npm install
npm run dev      # http://localhost:4321, drafts included
npm run build    # what CI and Cloudflare run: checks front matter and types, then builds to dist/
npm run preview  # serves dist/
```

## Where things are

| Path                         | What                                                        |
| ---------------------------- | ----------------------------------------------------------- |
| `src/content/posts/`         | Posts                                                       |
| `src/content.config.ts`      | Front matter rules                                          |
| `src/site.ts`                | Site title, description, links, posts per page, tag colors |
| `src/pages/about.astro`      | About page                                                  |
| `src/scripts/line-art.ts`    | The animated line art (same family as prignano.ai)          |
| `src/lib/og.ts`              | LinkedIn / Open Graph preview images                        |
| `src/styles/global.css`      | The blog's layout styles                                    |
| `prignano-theme` (npm)       | Colors, dark mode and header shared with prignano.ai        |

To pick up a new version of the shared theme, run
`npm install https://codeload.github.com/nickprignano/prignano-theme/tar.gz/refs/tags/<tag>`
in a pull request.

RSS is at `/rss.xml`, the sitemap at `/sitemap-index.xml`.

## Hosting setup (one time)

The site runs on Cloudflare as a Worker that serves static files, in the same
account as prignano.ai.

### 1. Connect the repo

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Import a
   repository** → pick `nickprignano/blog-prignano-ai`.
2. Project name `blog-prignano-ai`, production branch `main`, deploy command
   `npx wrangler deploy`. Leave the build command empty: `wrangler.jsonc`
   runs `npm run build` as part of every deploy.
3. Preview links on pull requests: in the Worker's **Settings → Build**,
   **Builds for non-production branches** is on by default. Keep its default
   command, `npx wrangler preview`; the `previews` block in `wrangler.jsonc`
   is what it needs.

### 2. DNS and HTTPS for blog.prignano.ai

prignano.ai's DNS is on Cloudflare (Cloudflare is the registrar), so there are
no records to type in by hand. `wrangler.jsonc` lists `blog.prignano.ai` as a
custom domain, and the first deploy from `main`:

- creates a proxied DNS record for `blog` in the prignano.ai zone (it appears in
  **DNS → Records** with type **Worker**), and
- issues an HTTPS certificate for it.

To check, or to add it by hand if the deploy didn't: Worker → **Settings →
Domains & Routes → Add → Custom domain** → `blog.prignano.ai`. If an older
`blog` CNAME or A record exists in the zone, delete it first; Cloudflare won't
attach the domain over it.

Then in the prignano.ai zone: **SSL/TLS → Edge Certificates → Always Use
HTTPS** on.

### 3. Analytics (optional, cookieless)

Cloudflare Web Analytics, no cookies and no personal data:

1. **Analytics & Logs → Web Analytics → Add a site** → `blog.prignano.ai`,
   and choose automatic setup.
2. If automatic setup isn't offered, choose manual setup, copy the token, and
   add it in the Worker's **Settings → Build → Variables and secrets** as
   `CF_BEACON_TOKEN`. The next build adds the beacon. The token stays in
   Cloudflare, not in this repo.

### 4. Protect main

GitHub → repo **Settings → Rules → Rulesets → New branch ruleset**, target the
default branch, and turn on **Require a pull request before merging** and
**Require status checks to pass** with the `build` check. If you're the only
contributor, leave required approvals at 0: GitHub doesn't let you approve
your own pull requests.

## License

Code, including code samples in posts, is [MIT](LICENSE). Post content is
[CC BY 4.0](LICENSE-CONTENT.md).
