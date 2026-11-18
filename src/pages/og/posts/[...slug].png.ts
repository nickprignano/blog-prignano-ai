import type { APIRoute, GetStaticPaths } from "astro";
import { renderCard } from "../../../lib/og";
import { artFor, formatDate, getPosts, imageFor, type Post } from "../../../lib/posts";

export const getStaticPaths = (async () => {
  return (await getPosts()).map((post) => ({ params: { slug: post.id }, props: { post } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { post } = props as { post: Post };
  const png = await renderCard({
    title: post.data.title,
    subtitle: `Nick Prignano · ${formatDate(post.data.date)}`,
    tags: post.data.tags,
    ...(await artFor(post)),
    photo: imageFor(post) && `src/assets/posts/${post.id}.jpg`,
  });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
};
