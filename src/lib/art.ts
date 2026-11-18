// The line art shared by the animated <line-art> element and the Open Graph
// cards, drawn through a small slice of the canvas API so the same code can
// paint a canvas in the browser or write SVG at build time.
//
// The seed (a post's slug) sets the shapes and motion, the hue sets the
// palette, and the style picks one of three looks. Left out, the hue and
// style come from the seed too.

import { hash, mulberry32 } from "./random";

export type Pointer = { x: number; y: number; strength: number };

export type Scene = {
  // Advances the piece by dt seconds and draws it.
  step: (dt: number, pointer: Pointer) => void;
};

export interface Gradient {
  addColorStop(offset: number, color: string): void;
}

// The parts of CanvasRenderingContext2D the styles use.
export interface Ctx {
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  lineCap: string;
  lineJoin: string;
  globalCompositeOperation: string;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): Gradient;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  stroke(): void;
  fill(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
}

export const STYLES = ["flow", "waves", "harmonograph"] as const;
export type StyleName = (typeof STYLES)[number];

export function createScene(ctx: Ctx, w: number, h: number, seed: string, hue: number | null, style: StyleName | null = null): Scene {
  const rand = mulberry32(hash(seed));
  const baseHue = hue ?? rand() * 360;
  const spread = 25 + rand() * 45;
  const palette = {
    hues: [baseHue, baseHue + spread, baseHue - spread, baseHue + 180 + (rand() - 0.5) * 40],
    bg: background(ctx, w, h, baseHue, rand),
  };
  const styles = { flow: flowTrails, waves: waveLines, harmonograph };
  // Always draw the pick, so a named style keeps the same shapes it would get
  // from the seed.
  const picked = STYLES[Math.floor(rand() * STYLES.length)];
  return styles[style ?? picked](ctx, w, h, rand, palette);
}

type Palette = { hues: number[]; bg: Gradient };
type Style = (ctx: Ctx, w: number, h: number, rand: () => number, p: Palette) => Scene;

// Particles drift through a slowly shifting vector field, each trailing a
// line that fades out behind it. The pointer swirls the field around it.
const flowTrails: Style = (ctx, w, h, rand, { hues, bg }) => {
  const scale = Math.min(w, h);
  const f1 = (1.2 + rand() * 2.5) / scale;
  const f2 = (1.2 + rand() * 2.5) / scale;
  const p1 = rand() * 100;
  const p2 = rand() * 100;
  const twist = 1 + rand() * 2;
  const drift = 0.05 + rand() * 0.1;
  const speed = scale * (0.12 + rand() * 0.1);
  const reach = Math.max(w, h) * 0.22;
  const field = (x: number, y: number, t: number, ptr: Pointer) => {
    let a = (Math.sin(x * f1 + p1 + t * drift) + Math.cos(y * f2 + p2 - t * drift * 0.7) + Math.sin((x + y) * f1 * 0.5 + t * drift * 0.5)) * twist;
    if (ptr.strength > 0.01) {
      const dx = x - ptr.x;
      const dy = y - ptr.y;
      const near = Math.exp(-(dx * dx + dy * dy) / (reach * reach));
      // Blend toward a circle around the pointer.
      a += (Math.atan2(dy, dx) + Math.PI / 2 - a) * near * ptr.strength;
    }
    return a;
  };

  const count = Math.min(900, Math.round((w * h) / 1800));
  const tail = 40;
  const particles = Array.from({ length: count }, () => spawn());
  function spawn() {
    return { xs: [rand() * w], ys: [rand() * h], life: 2 + rand() * 6, band: Math.floor(rand() * hues.length) };
  }
  let t = rand() * 100;

  const advance = (dt: number, ptr: Pointer) => {
    t += dt;
    const boost = 1 + ptr.strength * 0.8;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const x = p.xs[p.xs.length - 1];
      const y = p.ys[p.ys.length - 1];
      const a = field(x, y, t, ptr);
      const nx = x + Math.cos(a) * speed * boost * dt;
      const ny = y + Math.sin(a) * speed * boost * dt;
      p.life -= dt;
      if (p.life <= 0 || nx < 0 || ny < 0 || nx > w || ny > h) {
        // Let the tail run out before respawning, so lines don't vanish at once.
        p.xs.shift();
        p.ys.shift();
        if (p.xs.length === 0) particles[i] = spawn();
        continue;
      }
      p.xs.push(nx);
      p.ys.push(ny);
      if (p.xs.length > tail) {
        p.xs.shift();
        p.ys.shift();
      }
    }
  };

  // Each tail is drawn in three segments, faint at the back and bright at the
  // head. Batching by color and segment keeps it to a dozen strokes a frame.
  const draw = () => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = Math.max(1, scale * 0.0022);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const segments = 3;
    for (let band = 0; band < hues.length; band++) {
      for (let seg = 0; seg < segments; seg++) {
        ctx.beginPath();
        for (const p of particles) {
          if (p.band !== band) continue;
          const n = p.xs.length;
          const from = Math.floor((n * seg) / segments);
          const to = Math.min(n - 1, Math.floor((n * (seg + 1)) / segments));
          if (to <= from) continue;
          ctx.moveTo(p.xs[from], p.ys[from]);
          for (let k = from + 1; k <= to; k++) ctx.lineTo(p.xs[k], p.ys[k]);
        }
        ctx.strokeStyle = hsl(hues[band], 85, 55 + seg * 10, 0.15 + seg * 0.3);
        ctx.stroke();
      }
    }
  };

  // Run the simulation for a moment up front so the still frame already
  // shows full trails.
  const still: Pointer = { x: 0, y: 0, strength: 0 };
  for (let i = 0; i < tail; i++) advance(1 / 30, still);

  return {
    step: (dt, ptr) => {
      if (dt > 0) advance(dt, ptr);
      draw();
    },
  };
};

// Stacked horizontal lines rippling like a sound wave, strongest in the
// middle. The ripple follows the pointer across and swells under it.
const waveLines: Style = (ctx, w, h, rand, { hues, bg }) => {
  const scale = Math.min(w, h);
  const lines = 26 + Math.floor(rand() * 18);
  const top = h * 0.12;
  const gap = (h * 0.76) / (lines - 1);
  const amp = gap * (2.5 + rand() * 3);
  const waves = Array.from({ length: 3 }, () => ({
    f: (2 + rand() * 7) / w,
    speed: 0.3 + rand() * 0.6,
    phase: rand() * 10,
    rowShift: 0.15 + rand() * 0.4,
  }));
  const home = 0.35 + rand() * 0.3;
  let center = home;
  const width = 0.18 + rand() * 0.15;
  const points = 140;
  let t = rand() * 100;

  return {
    step: (dt, ptr) => {
      t += dt;
      const goal = home + (ptr.x / w - home) * ptr.strength;
      center += (goal - center) * Math.min(1, dt * 3);
      const swell = 1 + ptr.strength * 0.6;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = Math.max(1, scale * 0.0028);
      ctx.lineJoin = "round";
      for (let i = 0; i < lines; i++) {
        const y0 = top + i * gap;
        const k = i / (lines - 1);
        ctx.strokeStyle = hsl(hues[0] + (hues[1] - hues[0]) * k, 85, 62 + 18 * Math.sin(k * Math.PI), 0.85);
        const ys: number[] = [];
        for (let j = 0; j <= points; j++) {
          const x = (j / points) * w;
          const env = Math.exp(-(((x / w - center) / width) ** 2));
          let d = 0;
          for (const wv of waves) d += Math.sin(x * wv.f * Math.PI * 2 + t * wv.speed + i * wv.rowShift + wv.phase);
          ys.push(y0 - Math.abs(d / waves.length) * amp * swell * env);
        }
        const trace = () => {
          ctx.moveTo(0, ys[0]);
          for (let j = 1; j <= points; j++) ctx.lineTo((j / points) * w, ys[j]);
        };
        // Fill under each line so the ones in front hide the ones behind.
        ctx.beginPath();
        trace();
        ctx.lineTo(w, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.beginPath();
        trace();
        ctx.stroke();
      }
    },
  };
};

// Interlocking looping curves, like a pendulum drawing machine, whose phases
// drift so the figure slowly turns and morphs. The pointer leans the figure
// toward it and speeds up the drift.
const harmonograph: Style = (ctx, w, h, rand, { hues, bg }) => {
  const scale = Math.min(w, h);
  const ratios = [1, 2, 3, 4, 5];
  const pick = () => ratios[Math.floor(rand() * ratios.length)] + (rand() - 0.5) * 0.02;
  const curves = Array.from({ length: 2 }, (_, c) => ({
    fx: pick(),
    fy: pick(),
    fx2: pick(),
    fy2: pick(),
    px: rand() * Math.PI * 2,
    py: rand() * Math.PI * 2,
    drift: (0.08 + rand() * 0.12) * (c ? -1 : 1),
    hue: hues[c],
  }));
  const decay = 0.012 + rand() * 0.01;
  const turns = 60;
  const points = 2400;
  const r = scale * 0.42;
  let t = rand() * 100;
  let cx = w / 2;
  let cy = h / 2;

  return {
    step: (dt, ptr) => {
      t += dt * (1 + ptr.strength * 2);
      const ease = Math.min(1, dt * 2);
      cx += (w / 2 + (ptr.x - w / 2) * 0.25 * ptr.strength - cx) * ease;
      cy += (h / 2 + (ptr.y - h / 2) * 0.25 * ptr.strength - cy) * ease;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = Math.max(1, scale * 0.0018);
      for (const c of curves) {
        ctx.strokeStyle = hsl(c.hue, 85, 65, 0.55);
        ctx.beginPath();
        for (let i = 0; i <= points; i++) {
          const s = (i / points) * turns;
          const e = Math.exp(-decay * s);
          const x = (Math.sin(c.fx * s + c.px + t * c.drift) + Math.sin(c.fx2 * s + c.py)) * 0.5 * e;
          const y = (Math.sin(c.fy * s + c.py + t * c.drift * 0.6) + Math.sin(c.fy2 * s + c.px)) * 0.5 * e;
          if (i === 0) ctx.moveTo(cx + x * r, cy + y * r);
          else ctx.lineTo(cx + x * r, cy + y * r);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    },
  };
};

function background(ctx: Ctx, w: number, h: number, hue: number, rand: () => number) {
  const angle = rand() * Math.PI * 2;
  const bg = ctx.createLinearGradient(
    w / 2 - (Math.cos(angle) * w) / 2,
    h / 2 - (Math.sin(angle) * h) / 2,
    w / 2 + (Math.cos(angle) * w) / 2,
    h / 2 + (Math.sin(angle) * h) / 2,
  );
  // Kept very dark so warm hues read as glowing rather than brown.
  bg.addColorStop(0, hsl(hue + 200, 35, 5));
  bg.addColorStop(1, hsl(hue, 50, 11));
  return bg;
}

function hsl(h: number, s: number, l: number, a = 1) {
  return `hsla(${(((h % 360) + 360) % 360).toFixed(1)}, ${s}%, ${l}%, ${a})`;
}
