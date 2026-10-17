import type { APIRoute } from "astro";
import { renderCard } from "../../lib/og";
import { SITE } from "../../site";

// The preview card for every page that isn't a post.
export const GET: APIRoute = async () => {
  const png = await renderCard({
    title: SITE.title,
    subtitle: "Nerdio, Azure Virtual Desktop, Terraform and Packer",
    seed: "blog.prignano.ai",
    hue: 205,
  });
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
};
