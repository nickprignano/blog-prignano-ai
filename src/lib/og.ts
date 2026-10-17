import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { hash, mulberry32 } from "./random";

// Open Graph cards (1200x630) for link previews on LinkedIn and elsewhere:
// a still of the post's line art with the title over it.

const W = 1200;
const H = 630;

const require = createRequire(import.meta.url);
const font = (weight: 400 | 700) =>
  readFile(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`));
let fonts: Promise<Buffer[]> | undefined;

type Card = { title: string; subtitle?: string; tags?: string[]; seed: string; hue?: number };

export async function renderCard({ title, subtitle, tags = [], seed, hue }: Card) {
  const [regular, bold] = await (fonts ??= Promise.all([font(400), font(700)]));
  const art = `data:image/svg+xml;base64,${Buffer.from(waveArt(seed, hue)).toString("base64")}`;

  const el = (type: string, style: Record<string, unknown>, children?: unknown) => ({
    type,
    props: { style, children },
  });

  // Satori sizes boxes without padding, so the text block is positioned
  // inside the card rather than padded.
  const tree = el("div", { width: W, height: H, display: "flex", fontFamily: "Inter", color: "#e6edf3" }, [
    { type: "img", props: { src: art, width: W, height: H, style: { position: "absolute", top: 0, left: 0 } } },
    // Darken the lower part so the title stays readable over any art.
    el("div", {
      position: "absolute",
      top: 0,
      left: 0,
      width: W,
      height: H,
      backgroundImage: "linear-gradient(180deg, rgba(8,11,16,0) 20%, rgba(8,11,16,0.92) 80%)",
    }),
    el("div", { position: "absolute", left: 72, bottom: 56, width: W - 144, display: "flex", flexDirection: "column" }, [
      tags.length
        ? el("div", { display: "flex", gap: 12, marginBottom: 20 }, tags.slice(0, 4).map((t) =>
            el("div", { fontSize: 24, padding: "4px 16px", borderRadius: 999, background: "rgba(88,166,255,0.18)", color: "#9cc2ff" }, `#${t}`),
          ))
        : null,
      el("div", { display: "flex", fontSize: title.length > 60 ? 56 : 64, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.02em" }, title),
      el("div", { display: "flex", justifyContent: "space-between", marginTop: 28, fontSize: 28, color: "#8b949e" }, [
        el("div", {}, subtitle ?? ""),
        el("div", {}, "blog.prignano.ai"),
      ]),
    ].filter(Boolean)),
  ]);

  const svg = await satori(tree as Parameters<typeof satori>[0], {
    width: W,
    height: H,
    fonts: [
      { name: "Inter", data: regular, weight: 400, style: "normal" },
      { name: "Inter", data: bold, weight: 700, style: "normal" },
    ],
  });
  return new Resvg(svg).render().asPng();
}

// A still of the "wave lines" style from the site's line art, as SVG.
function waveArt(seed: string, hue?: number) {
  const rand = mulberry32(hash(seed));
  const base = hue ?? rand() * 360;
  const next = base + 25 + rand() * 45;
  const lines = 30;
  const top = H * 0.08;
  const gap = (H * 0.62) / (lines - 1);
  const amp = gap * (3 + rand() * 3);
  const waves = Array.from({ length: 3 }, () => ({
    f: (2 + rand() * 7) / W,
    phase: rand() * 10,
    rowShift: 0.15 + rand() * 0.4,
  }));
  const centre = 0.55 + rand() * 0.3;
  const width = 0.2 + rand() * 0.15;

  const paths: string[] = [];
  for (let i = 0; i < lines; i++) {
    const y0 = top + i * gap;
    const k = i / (lines - 1);
    const pts: string[] = [];
    for (let j = 0; j <= 160; j++) {
      const x = (j / 160) * W;
      const env = Math.exp(-(((x / W - centre) / width) ** 2));
      let d = 0;
      for (const wv of waves) d += Math.sin(x * wv.f * Math.PI * 2 + i * wv.rowShift + wv.phase);
      pts.push(`${x.toFixed(1)},${(y0 - Math.abs(d / waves.length) * amp * env).toFixed(1)}`);
    }
    const colour = `hsl(${Math.round((((base + (next - base) * k) % 360) + 360) % 360)}, 85%, ${Math.round(62 + 18 * Math.sin(k * Math.PI))}%)`;
    // Fill under each line so the ones in front hide the ones behind.
    paths.push(`<path d="M${pts.join(" L")} L${W},${H} L0,${H} Z" fill="url(#bg)" stroke="none"/>`);
    paths.push(`<path d="M${pts.join(" L")}" fill="none" stroke="${colour}" stroke-opacity="0.85" stroke-width="2.4"/>`);
  }
  const h = (n: number) => ((n % 360) + 360) % 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="hsl(${Math.round(h(base + 200))}, 35%, 5%)"/><stop offset="1" stop-color="hsl(${Math.round(h(base))}, 50%, 11%)"/>
</linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#bg)"/>${paths.join("")}</svg>`;
}
