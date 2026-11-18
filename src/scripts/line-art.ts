// Animated line art, the same family as the project images on prignano.ai.
// The seed (a post's slug) sets the shapes and motion, the hue sets the
// palette, and the style picks the look (see src/lib/art.ts), so a post always
// looks the same. The art reacts to the pointer while it's over the canvas,
// animates only while it's on screen, and holds a still frame under reduced
// motion.
//
// Usage: <line-art seed="my-post" hue="210" art-style="waves"></line-art>

import { createScene, STYLES, type Pointer, type Scene, type StyleName } from "../lib/art";

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
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    // A missing hue attribute means "pick one from the seed", not hue 0.
    const hue = Number(this.getAttribute("hue") ?? NaN);
    const style = this.getAttribute("art-style") as StyleName | null;
    this.scene = createScene(ctx, w, h, this.getAttribute("seed") ?? "", Number.isFinite(hue) ? hue : null, style && STYLES.includes(style) ? style : null);
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
