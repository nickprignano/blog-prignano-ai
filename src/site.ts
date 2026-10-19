// Site-wide settings. Edit these rather than the layouts.
export const SITE = {
  url: "https://blog.prignano.ai",
  title: "Nick Prignano",
  description:
    "Adventures in vibe coding and overcoming self-imposed boundaries.",
  author: "Nick Prignano",
  // Shown in the header, as on prignano.ai.
  bio: "Wow everything is computer",
  avatar: "https://github.com/nickprignano.png?size=112",
  repo: "https://github.com/nickprignano/blog-prignano-ai",
  // Posts per page on the home and tag pages. Further pages load as you scroll.
  pageSize: 10,
  links: [
    { label: "GitHub", href: "https://github.com/nickprignano" },
    { label: "Website", href: "https://prignano.ai" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/nickprignano" },
  ],
};

// Color of a post's line art, by its first tag. Tags not listed here get a
// color picked from the post's slug.
export const TAG_HUES: Record<string, number> = {
  "vibe-coding": 285,
  boundaries: 25,
  ai: 175,
  nerdio: 160,
  avd: 205,
  azure: 210,
  terraform: 265,
  packer: 195,
  powershell: 225,
};
