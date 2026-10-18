// Animated line art, the same family as the project images on prignano.ai.
// The seed (a post's slug) picks the style, shapes and motion, and the hue
// sets the palette, so a post always looks the same and no two look alike.
// The art reacts to the pointer while it's over the canvas, animates only
// while it's on screen, and holds a still frame under reduced motion.
//
// Usage: <line-art seed="my-post" hue="210"></line-art>

import { hash, mulberry32 } from "../lib/random";

type Pointer = { x: number; y: number; strength: number };

type Scene = {
  // Advances the piece by dt seconds and draws it.
  step: (dt: number, pointer: Pointer) => void;
};

const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

class LineArt extends HTMLElement {
  private canvas = document.createElement("canvas");
  private scene: Scene | null = null;
  private frame = 0;
  private last = 0;
  private visible = false;
  // Pointer position in canvas pixels; strength eases in and out so the art
  // settles back smoothly when the pointer leaves.
  private pointer: Pointer = { x: 0, y: 0, strength: 0 };
  private pointerInside = false;
  private resize = new ResizeObserver(() => this.setup());
  private onScreen = new IntersectionObserver(([entry]) => {
    this.visible = entry.isIntersecting;
    this.visible ? this.start() : this.stop();
  });

  connectedCallback() {
    this.canvas.setAttribute("aria-hidden", "true");
    this.appendChild(this.canvas);
    this.resize.observe(this);
    this.onScreen.observe(this);
    // Listen on the element the art belongs to (a card or banner) when one is
    // named, so hovering anywhere on it moves the lines.
    const track = this.getAttribute("track");
    const target = (track && (this.closest(track) as HTMLElement | null)) || this;
    target.addEventListener("pointermove", this.move);
    target.addEventListener("pointerdown", this.move);
    target.addEventListener("pointerleave", this.leave);
  }

  disconnectedCallback() {
    this.resize.disconnect();
    this.onScreen.disconnect();
    this.stop();
  }

  private move = (e: PointerEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    const sx = this.canvas.width / (rect.width || 1);
    const sy = this.canvas.height / (rect.height || 1);
    this.pointer.x = (e.clientX - rect.left) * sx;
    this.pointer.y = (e.clientY - rect.top) * sy;
    this.pointerInside = true;
    // Under reduced motion, the art doesn't run, so don't track the pointer.
    if (!reduceMotion()) this.start();
  };

  private leave = () => {
    this.pointerInside = false;
  };

  private setup() {
    const { width, height } = this.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (this.scene && w === this.canvas.width && h === this.canvas.height) return;
    this.canvas.width = w;
    this.canvas.height = h;
    const hue = Number(this.getAttribute("hue"));
    this.scene = createScene(this.canvas, this.getAttribute("seed") ?? "", Number.isFinite(hue) ? hue : null);
    // A still frame for off-screen art, reduced motion, and the first paint.
    this.scene?.step(0, this.pointer);
  }

  private start() {
    if (this.frame || !this.visible || reduceMotion()) return;
    this.last = 0;
    this.frame = requestAnimationFrame(this.tick);
  }

  private stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private tick = (now: number) => {
    // Clamp the step so a backgrounded tab doesn't jump when it returns.
    const dt = this.last ? Math.min((now - this.last) / 1000, 1 / 20) : 0;
    this.last = now;
    const target = this.pointerInside ? 1 : 0;
    this.pointer.strength += (target - this.pointer.strength) * Math.min(1, dt * 4);
    this.scene?.step(dt, this.pointer);
    this.frame = requestAnimationFrame(this.tick);
  };
}

if (!customElements.get("line-art")) customElements.define("line-art", LineArt);

function createScene(canvas: HTMLCanvasElement, seed: string, hue: number | null): Scene | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const rand = mulberry32(hash(seed));
  const { width: w, height: h } = canvas;
  const baseHue = hue ?? rand() * 360;
  const spread = 25 + rand() * 45;
  const palette = {
    hues: [baseHue, baseHue + spread, baseHue - spread, baseHue + 180 + (rand() - 0.5) * 40],
    bg: background(ctx, w, h, baseHue, rand),
  };
  const styles = [flowTrails, waveLines, harmonograph];
  return styles[Math.floor(rand() * styles.length)](ctx, w, h, rand, palette);
}

type Palette = { hues: number[]; bg: CanvasGradient };
type Style = (ctx: CanvasRenderingContext2D, w: number, h: number, rand: () => number, p: Palette) => Scene;

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
  let centre = home;
  const width = 0.18 + rand() * 0.15;
  const points = 140;
  let t = rand() * 100;

  return {
    step: (dt, ptr) => {
      t += dt;
      const goal = home + (ptr.x / w - home) * ptr.strength;
      centre += (goal - centre) * Math.min(1, dt * 3);
      const swell = 1 + ptr.strength * 0.6;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = Math.max(1, scale * 0.0028);
      ctx.lineJoin = "round";
      for (let i = 0; i < lines; i++) {
        const y0 = top + i * gap;
        const k = i / (lines - 1);
        ctx.strokeStyle = hsl(hues[0] + (hues[1] - hues[0]) * k, 85, 62 + 18 * Math.sin(k * Math.PI), 0.85);
        const line = new Path2D();
        for (let j = 0; j <= points; j++) {
          const x = (j / points) * w;
          const env = Math.exp(-(((x / w - centre) / width) ** 2));
          let d = 0;
          for (const wv of waves) d += Math.sin(x * wv.f * Math.PI * 2 + t * wv.speed + i * wv.rowShift + wv.phase);
          const y = y0 - Math.abs(d / waves.length) * amp * swell * env;
          if (j === 0) line.moveTo(x, y);
          else line.lineTo(x, y);
        }
        // Fill under each line so the ones in front hide the ones behind.
        const under = new Path2D(line);
        under.lineTo(w, h);
        under.lineTo(0, h);
        under.closePath();
        ctx.fillStyle = bg;
        ctx.fill(under);
        ctx.stroke(line);
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

function background(ctx: CanvasRenderingContext2D, w: number, h: number, hue: number, rand: () => number) {
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
  return `hsl(${((h % 360) + 360) % 360} ${s}% ${l}% / ${a})`;
}
