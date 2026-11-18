import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { createScene, type Ctx, type StyleName } from "./art";

// Open Graph cards (1200x630) for link previews on LinkedIn and elsewhere:
// a still of the post's line art with the title over it.

const W = 1200;
const H = 630;

const require = createRequire(import.meta.url);
const font = (weight: 400 | 700) =>
  readFile(require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`));
let fonts: Promise<Buffer[]> | undefined;

// photo: a JPEG to use instead of the line art, as a path from the repo root.
type Card = { title: string; subtitle?: string; tags?: string[]; seed: string; hue?: number; style?: StyleName; photo?: string };

export async function renderCard({ title, subtitle, tags = [], seed, hue, style, photo }: Card) {
  const [regular, bold] = await (fonts ??= Promise.all([font(400), font(700)]));
  const art = photo
    ? `data:image/jpeg;base64,${(await readFile(photo)).toString("base64")}`
    : `data:image/svg+xml;base64,${Buffer.from(artSvg(seed, hue ?? null, style ?? null)).toString("base64")}`;

  const el = (type: string, style: Record<string, unknown>, children?: unknown) => ({
    type,
    props: { style, children },
  });

  // Satori sizes boxes without padding, so the text block is positioned
  // inside the card rather than padded.
  const tree = el("div", { width: W, height: H, display: "flex", fontFamily: "Inter", color: "#e6edf3" }, [
    { type: "img", props: { src: art, width: W, height: H, style: { position: "absolute", top: 0, left: 0, objectFit: "cover" } } },
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

// A still of the post's line art, drawn as SVG through the same code as the
// animated art on the site.
function artSvg(seed: string, hue: number | null, style: StyleName | null) {
  const ctx = new SvgCtx();
  createScene(ctx, W, H, seed, hue, style).step(0, { x: 0, y: 0, strength: 0 });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${ctx.defs.join("")}</defs>${ctx.body.join("")}</svg>`;
}

class SvgGradient {
  stops: string[] = [];
  constructor(
    readonly id: string,
    readonly coords: number[],
  ) {}
  addColorStop(offset: number, color: string) {
    this.stops.push(`<stop offset="${offset}" stop-color="${rgb(color).color}"/>`);
  }
}

// Records the canvas calls the line art makes as SVG elements.
class SvgCtx implements Ctx {
  fillStyle: unknown = "#000";
  strokeStyle: unknown = "#000";
  lineWidth = 1;
  lineCap = "butt";
  lineJoin = "miter";
  globalCompositeOperation = "source-over";
  defs: string[] = [];
  body: string[] = [];
  private d = "";
  private gradients: SvgGradient[] = [];

  createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
    const g = new SvgGradient(`g${this.gradients.length}`, [x0, y0, x1, y1]);
    this.gradients.push(g);
    return g;
  }
  beginPath() {
    this.d = "";
  }
  moveTo(x: number, y: number) {
    this.d += `M${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  lineTo(x: number, y: number) {
    this.d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  closePath() {
    this.d += "Z";
  }
  stroke() {
    if (!this.d) return;
    this.body.push(
      `<path d="${this.d}" fill="none" stroke=${this.paint(this.strokeStyle, "stroke")} stroke-width="${this.lineWidth}" stroke-linecap="${this.lineCap}" stroke-linejoin="${this.lineJoin}"${this.blend()}/>`,
    );
  }
  fill() {
    if (this.d) this.body.push(`<path d="${this.d}" fill=${this.paint(this.fillStyle, "fill")}${this.blend()}/>`);
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.body.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill=${this.paint(this.fillStyle, "fill")}${this.blend()}/>`);
  }
  // Canvas's "lighter" adds colors together; screen is the nearest SVG blend.
  private blend() {
    return this.globalCompositeOperation === "lighter" ? ` style="mix-blend-mode:screen"` : "";
  }
  // A paint attribute's quoted value, plus its opacity for a color.
  private paint(style: unknown, attr: "fill" | "stroke") {
    if (!(style instanceof SvgGradient)) {
      const { color, alpha } = rgb(String(style));
      return `"${color}" ${attr}-opacity="${alpha}"`;
    }
    if (!this.defs.some((d) => d.includes(`id="${style.id}"`))) {
      const [x1, y1, x2, y2] = style.coords.map((n) => n.toFixed(1));
      this.defs.push(
        `<linearGradient id="${style.id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${style.stops.join("")}</linearGradient>`,
      );
    }
    return `"url(#${style.id})"`;
  }
}

// resvg doesn't read hsla(), so turn the art's colors into rgb and an alpha.
function rgb(css: string) {
  const m = css.match(/^hsla\(([\d.]+), ([\d.]+)%, ([\d.]+)%, ([\d.]+)\)$/);
  if (!m) return { color: css, alpha: 1 };
  const [h, s, l, alpha] = m.slice(1).map(Number);
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return { color: `rgb(${f(0)},${f(8)},${f(4)})`, alpha };
}
