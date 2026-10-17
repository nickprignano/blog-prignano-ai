import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// Every post is a Markdown file in src/content/posts. The file name becomes
// the URL: src/content/posts/fslogix-sizing.md -> /posts/fslogix-sizing/.
// A post with missing or malformed front matter fails the build, so a broken
// post can't reach the live site.
const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1).max(200),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z
      .array(z.string().regex(/^[a-z0-9-]+$/, "tags are lowercase words joined by hyphens, like azure-virtual-desktop"))
      .default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
