import { useEffect, useRef } from "react";
import type React from "react";

import { tokens } from "../../tokens/tokens";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const STROKE_ALPHA = 0.35;
const STROKE_WIDTH = 1;
const MAX_AMPLITUDE_PX = 28; // peak vertical displacement of the wave line
const AMPLITUDE_HEIGHT_RATIO = 0.12; // scales amplitude down on short containers
const MIN_WAVELENGTH_PX = 220;
const WAVELENGTH_WIDTH_DIVISOR = 3; // roughly 3 wave cycles across the container width
const PHASE_SPEED_PER_MS = 0.00025; // one full cycle ≈ 25s, matching the wave-x/-y blob durations

function drawWave(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedMs: number,
): void {
  context.clearRect(0, 0, width, height);
  if (width === 0 || height === 0) return;

  const centerY = height / 2;
  const amplitude = Math.min(MAX_AMPLITUDE_PX, height * AMPLITUDE_HEIGHT_RATIO);
  const wavelength = Math.max(MIN_WAVELENGTH_PX, width / WAVELENGTH_WIDTH_DIVISOR);

  context.strokeStyle = tokens.color.goldLine;
  context.globalAlpha = STROKE_ALPHA;
  context.lineWidth = STROKE_WIDTH;
  context.beginPath();
  for (let x = 0; x <= width; x += 4) {
    const phase = (x / wavelength) * Math.PI * 2 + elapsedMs * PHASE_SPEED_PER_MS;
    const y = centerY + Math.sin(phase) * amplitude;
    if (x === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
}

/**
 * Ambient canvas wave + drifting blobs (Design.md §4-5) — renders only on the
 * empty Ask Drishti hero, `aria-hidden` decoration, unmounts the moment a
 * question is asked. Persists a time origin in a ref so re-renders never
 * reset the animation phase; a single continuously-running
 * `requestAnimationFrame` loop redraws the canvas each frame from elapsed
 * time relative to that origin. Starts/stops that loop live in response to
 * the `prefers-reduced-motion` media query changing (not just its value at
 * mount), freezing to one static frame when reduced motion is preferred —
 * the CSS blob drift is frozen separately via `app.css`'s global
 * `prefers-reduced-motion` override on `.animate-wave-x`/`-y`/`-breathe`.
 * @returns Ambient wave decoration element
 */
export function AmbientWave(): React.ReactElement {
  const canvasReference = useRef<HTMLCanvasElement | null>(null);
  const originReference = useRef(performance.now());

  useEffect(() => {
    const canvas = canvasReference.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const resize = (): void => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resize();
    window.addEventListener("resize", resize);

    const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    let frameId: number | null = null;

    const stop = (): void => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    const start = (): void => {
      stop();
      const tick = (): void => {
        drawWave(context, canvas.width, canvas.height, performance.now() - originReference.current);
        frameId = requestAnimationFrame(tick);
      };
      frameId = requestAnimationFrame(tick);
    };

    const applyMotionPreference = (): void => {
      if (reducedMotionQuery.matches) {
        stop();
        drawWave(context, canvas.width, canvas.height, 0);
      } else {
        start();
      }
    };

    applyMotionPreference();
    reducedMotionQuery.addEventListener("change", applyMotionPreference);

    return (): void => {
      window.removeEventListener("resize", resize);
      reducedMotionQuery.removeEventListener("change", applyMotionPreference);
      stop();
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvasReference} className="absolute inset-0 h-full w-full" />
      <div className="absolute left-1/4 top-1/3 h-64 w-64 animate-wave-x animate-breathe rounded-full bg-gold/20 blur-3xl" />
      <div className="absolute bottom-1/3 right-1/4 h-72 w-72 animate-wave-y animate-breathe rounded-full bg-info/15 blur-3xl" />
    </div>
  );
}
