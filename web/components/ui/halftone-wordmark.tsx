"use client";

import * as React from "react";

export interface HalftoneWordmarkProps {
  /** The wordmark text. */
  wordmark?: string;
  /** Distance between dot centres, in CSS px. Defaults to 5. */
  dotGap?: number;
  /** How far the pointer pushes, in CSS px. Defaults to 80. */
  radius?: number;
  /** Print grain over the wordmark, 0–1. Defaults to 0.4. */
  grain?: number;
  /** Pointer and click response. Defaults to true. */
  interactive?: boolean;
  /** Background color for canvas fill / clearing. Defaults to dark green '#093A2F'. */
  background?: string;
  /** Rest color for dots. Defaults to cream '#FFFAEC'. */
  ink?: string;
  /** Displaced hover color. Defaults to mint '#B5F2C6' or warm accent. */
  warm?: string;
  /** Font family for the wordmark. */
  fontFamily?: string;
  /** Font weight for the wordmark. Defaults to 800. */
  fontWeight?: number;
  /** Extra class name for the wrapper. */
  className?: string;
  /** Optional click callback (e.g. scroll to top). */
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

/** Hex → [r, g, b] in 0–255. */
function hwfHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Dot radius for a cell coverage in [0, 1]: area-true, so tone stays even. */
function hwfRadius(coverage: number, gap: number): number {
  const c = coverage < 0 ? 0 : coverage > 1 ? 1 : coverage;
  return Math.sqrt(c) * gap * 0.58;
}

/**
 * One step of a dot's spring back to home, plus the push from a pointer at
 * (px, py) within radius r. Returns [x, y, vx, vy].
 */
function hwfStep(
  x: number,
  y: number,
  vx: number,
  vy: number,
  hx: number,
  hy: number,
  px: number,
  py: number,
  r: number
): [number, number, number, number] {
  const dx = x - px;
  const dy = y - py;
  const d2 = dx * dx + dy * dy;
  if (r > 0 && d2 < r * r) {
    const d = Math.sqrt(d2) + 0.001;
    const f = (1 - d / r) * 2.8;
    vx += (dx / d) * f;
    vy += (dy / d) * f;
  }
  vx = (vx + (hx - x) * 0.06) * 0.82;
  vy = (vy + (hy - y) * 0.06) * 0.82;
  return [x + vx, y + vy, vx, vy];
}

/** How warm/accent a dot is drawn: 0 at home, 1 once it is `span` px or more away. */
function hwfWarmth(x: number, y: number, hx: number, hy: number, span: number): number {
  const d = Math.hypot(x - hx, y - hy);
  return span > 0 ? Math.min(1, d / span) : 0;
}

export function HalftoneWordmark({
  wordmark = "Orderfit",
  dotGap = 5,
  radius = 90,
  grain = 0.35,
  interactive = true,
  background = "#093A2F",
  ink = "#FFFAEC",
  warm = "#B5F2C6",
  fontFamily = '"IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontWeight = 800,
  className = "",
  onClick,
}: HalftoneWordmarkProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const options = React.useMemo(() => ({
    wordmark,
    dotGap,
    radius,
    grain,
    interactive,
    background,
    ink,
    warm,
    fontFamily,
    fontWeight,
  }), [background, dotGap, fontFamily, fontWeight, grain, ink, interactive, radius, warm, wordmark]);

  React.useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let px = -1e5;
    let py = -1e5;
    let raf = 0;
    let visible = true;
    let awake = true;
    let ring = { x: 0, y: 0, t: -1 };

    // Flat array layout: x, y, vx, vy, hx, hy, r per dot
    let dots = new Float32Array(0);
    let count = 0;
    let grainTile: HTMLCanvasElement | null = null;

    const inkRgb = hwfHex(options.ink) || [255, 250, 236];
    const warmRgb = hwfHex(options.warm) || [181, 242, 198];

    const layout = () => {
      const o = options;
      const rect = container.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);

      // Create a 1x offscreen mask to measure and render the complete wordmark
      const mask = document.createElement("canvas");
      mask.width = w;
      mask.height = h;
      const m = mask.getContext("2d", { willReadFrequently: true });
      if (!m) return;

      const word = o.wordmark || " ";

      // Measure text width at 100px base size
      m.font = `${o.fontWeight} 100px ${o.fontFamily}`;
      const baseMetrics = m.measureText(word);
      const measuredWidth = (baseMetrics && baseMetrics.width > 0) ? baseMetrics.width : 500;

      // Fit by width (leave 4% margin horizontally)
      const fitByWidth = (w * 0.94 / measuredWidth) * 100;
      // Fit by height (cap font size so ascenders and descenders easily fit without clipping)
      const fitByHeight = h * 0.82;
      const finalFontSize = Math.max(16, Math.floor(Math.min(fitByWidth, fitByHeight)));

      m.font = `${o.fontWeight} ${finalFontSize}px ${o.fontFamily}`;
      m.textBaseline = "middle";
      m.textAlign = "center";

      m.fillStyle = "#000000";
      m.fillText(word, w / 2, h / 2);

      const img = m.getImageData(0, 0, w, h).data;
      const gap = Math.max(3, o.dotGap);
      const cols = Math.ceil(w / gap);
      const rows = Math.ceil(h / gap);
      const tmp: number[] = [];

      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          // Average alpha coverage over a 3x3 grid inside the cell
          let sum = 0;
          for (let sy = 0; sy < 3; sy++) {
            for (let sx = 0; sx < 3; sx++) {
              const cx = Math.min(w - 1, Math.floor(gx * gap + ((sx + 0.5) * gap) / 3));
              const cy = Math.min(h - 1, Math.floor(gy * gap + ((sy + 0.5) * gap) / 3));
              sum += img[(cy * w + cx) * 4 + 3];
            }
          }
          const cov = sum / (9 * 255);
          if (cov < 0.04) continue;

          const hx = gx * gap + gap / 2;
          const hy = gy * gap + gap / 2;
          tmp.push(hx, hy, 0, 0, hx, hy, hwfRadius(cov, gap));
        }
      }

      dots = new Float32Array(tmp);
      count = tmp.length / 7;

      // Generate a subtle print grain tile
      grainTile = document.createElement("canvas");
      grainTile.width = 128;
      grainTile.height = 128;
      const g = grainTile.getContext("2d");
      if (g) {
        const id = g.createImageData(128, 128);
        for (let i = 0; i < id.data.length; i += 4) {
          const v = Math.random() * 255;
          id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
          id.data[i + 3] = Math.random() < 0.5 ? 0 : 255;
        }
        g.putImageData(id, 0, 0);
      }

      awake = true;
    };

    const draw = (now: number) => {
      const o = options;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = o.background;
      ctx.fillRect(0, 0, w, h);

      const r = o.interactive && !reduced ? Math.max(0, o.radius) : 0;
      const ringAge = ring.t < 0 ? 1e9 : now - ring.t;
      const ringR = ringAge * 0.9;
      let moving = false;

      for (let i = 0; i < count; i++) {
        const j = i * 7;
        let x = dots[j];
        let y = dots[j + 1];
        let vx = dots[j + 2];
        let vy = dots[j + 3];
        const hx = dots[j + 4];
        const hy = dots[j + 5];

        if (!reduced) {
          // Shockwave ripple expansion on click
          if (ringAge < 900) {
            const dx = hx - ring.x;
            const dy = hy - ring.y;
            const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
            const band = 1 - Math.min(1, Math.abs(d - ringR) / 26);
            if (band > 0) {
              const f = band * 3.4 * (1 - ringAge / 900);
              vx += (dx / d) * f;
              vy += (dy / d) * f;
            }
          }

          // Pointer push & spring back
          const s = hwfStep(x, y, vx, vy, hx, hy, px, py, r);
          x = s[0];
          y = s[1];
          vx = s[2];
          vy = s[3];

          if (Math.abs(vx) + Math.abs(vy) > 0.02 || Math.abs(x - hx) + Math.abs(y - hy) > 0.05) {
            moving = true;
          } else {
            x = hx;
            y = hy;
            vx = 0;
            vy = 0;
          }

          dots[j] = x;
          dots[j + 1] = y;
          dots[j + 2] = vx;
          dots[j + 3] = vy;
        }

        const k = hwfWarmth(x, y, hx, hy, 28);
        ctx.fillStyle =
          k > 0.02
            ? "rgb(" +
              Math.round(inkRgb[0] + (warmRgb[0] - inkRgb[0]) * k) +
              "," +
              Math.round(inkRgb[1] + (warmRgb[1] - inkRgb[1]) * k) +
              "," +
              Math.round(inkRgb[2] + (warmRgb[2] - inkRgb[2]) * k) +
              ")"
            : o.ink;

        ctx.beginPath();
        ctx.arc(x, y, dots[j + 6], 0, 6.2832);
        ctx.fill();
      }

      if (grainTile && o.grain > 0) {
        ctx.globalAlpha = Math.min(1, o.grain) * 0.08;
        ctx.globalCompositeOperation = "overlay";
        const pattern = ctx.createPattern(grainTile, "repeat");
        if (pattern) {
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, w, h);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }

      // Stop loop when settled and cursor is outside
      awake = moving || ringAge < 900 || px > -1e4;
    };

    const loop = (now: number) => {
      raf = 0;
      if (!visible) return;
      draw(now);
      if (awake) raf = requestAnimationFrame(loop);
    };

    const wake = () => {
      awake = true;
      if (!raf && visible) raf = requestAnimationFrame(loop);
    };

    const toLocal = (e: PointerEvent): [number, number] => {
      const b = canvas.getBoundingClientRect();
      return [e.clientX - b.left, e.clientY - b.top];
    };

    const onMove = (e: PointerEvent) => {
      if (!options.interactive) return;
      const p = toLocal(e);
      px = p[0];
      py = p[1];
      wake();
    };

    const onLeave = () => {
      px = -1e5;
      py = -1e5;
      wake();
    };

    const onDown = (e: PointerEvent) => {
      if (!options.interactive || reduced) return;
      const p = toLocal(e);
      ring = { x: p[0], y: p[1], t: performance.now() };
      wake();
    };

    layout();
    draw(performance.now());
    wake();

    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);
    container.addEventListener("pointerdown", onDown);

    const ro = new ResizeObserver(() => {
      layout();
      wake();
    });
    ro.observe(container);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0] ? entries[0].isIntersecting : true;
      if (visible) wake();
    });
    io.observe(container);

    let alive = true;
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (!alive) return;
        layout();
        wake();
      });
    }

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", onLeave);
      container.removeEventListener("pointerdown", onDown);
    };
  }, [options]);

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={`relative w-full overflow-hidden select-none touch-none ${className}`}
      style={{ isolation: "isolate" }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="block w-full h-full max-w-none"
      />
      {/* Screen-reader accessible label */}
      <span className="sr-only">{wordmark}</span>
    </div>
  );
}
