import { getCollection, type CollectionEntry } from "astro:content";
import type { ImageMetadata } from "astro";
import type { StyleName } from "./art";

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

// A post's header image, made with ElevenLabs and saved as
// src/assets/posts/<slug>.jpg. A post without one shows its line art instead.
const images = import.meta.glob<{ default: ImageMetadata }>("../assets/posts/*.jpg", { eager: true });

export function imageFor(post: Post): ImageMetadata | undefined {
  return images[`../assets/posts/${post.id}.jpg`]?.default;
}

// A post's line art. Posts take turns through the styles, oldest first, and
// each post's color sits a golden angle (137.5 degrees) around the color wheel
// from the one before, so posts next to each other never look alike. Drafts
// count too, so publishing one doesn't change the art of the posts after it,
// and a new post never changes an older one.
export async function artFor(post: Post): Promise<{ seed: string; hue: number; style: StyleName }> {
  const all = await getCollection("posts");
  const order = all.sort((a, b) => a.data.date.getTime() - b.data.date.getTime() || a.id.localeCompare(b.id));
  const i = order.findIndex((p) => p.id === post.id);
  return { seed: post.id, hue: Math.round((85 + i * 137.5) % 360), style: ART_STYLES[i % ART_STYLES.length] };
}

const ART_STYLES: StyleName[] = ["waves", "flow", "harmonograph"];

export function readingMinutes(post: Post) {
  const words = (post.body ?? "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}
