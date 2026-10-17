import { getCollection, type CollectionEntry } from "astro:content";
import { TAG_HUES } from "../site";

export type Post = CollectionEntry<"posts">;

// Published posts, newest first. Drafts show up in `npm run dev` only.
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection("posts", ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function getTags(posts: Post[]) {
  const counts = new Map<string, number>();
  for (const post of posts) for (const tag of post.data.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count }));
}

export function hueFor(post: Post): number | undefined {
  return post.data.tags.map((t) => TAG_HUES[t]).find((h) => h !== undefined);
}

export function readingMinutes(post: Post) {
  const words = (post.body ?? "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}
