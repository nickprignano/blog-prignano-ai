// Site-wide settings. Edit these rather than the layouts.
export const SITE = {
  url: "https://blog.prignano.ai",
  title: "Nick Prignano",
  description:
    "Notes on Nerdio Manager for Enterprise, Azure Virtual Desktop, Terraform and Packer, for AVD and Nerdio admins, consultants and MSP engineers.",
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
    // { label: "LinkedIn", href: "https://www.linkedin.com/in/your-handle" },
  ],
};

// Colour of a post's line art, by its first tag. Tags not listed here get a
// colour picked from the post's slug.
export const TAG_HUES: Record<string, number> = {
  nerdio: 160,
  avd: 205,
  azure: 210,
  terraform: 265,
  packer: 195,
  powershell: 225,
};
