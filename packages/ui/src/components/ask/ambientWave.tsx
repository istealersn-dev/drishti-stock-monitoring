import { useEffect, useRef } from "react";
import type React from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const STROKE_COLOR = "#cbb460"; // --color-gold-line (Design.md §2 "ambient wave strokes")

function drawWave(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedMs: number,
): void {
  context.clearRect(0, 0, width, height);
  if (width === 0 || height === 0) return;

  const centerY = height / 2;
  const amplitude = Math.min(28, height * 0.12);
  const wavelength = Math.max(220, width / 3);
  const speed = 0.00025;

  context.strokeStyle = STROKE_COLOR;
  context.globalAlpha = 0.35;
  context.lineWidth = 1;
  context.beginPath();
  for (let x = 0; x <= width; x += 4) {
    const phase = (x / wavelength) * Math.PI * 2 + elapsedMs * speed;
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
 * time relative to that origin. Freezes to one static frame when the user
 * prefers reduced motion — the CSS blob drift is frozen separately via
 * `app.css`'s global `prefers-reduced-motion` override on
 * `.animate-wave-x`/`-y`/`-breathe`.
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

    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
      drawWave(context, canvas.width, canvas.height, 0);
      return (): void => {
        window.removeEventListener("resize", resize);
      };
    }

    let frameId: number;
    const tick = (): void => {
      drawWave(context, canvas.width, canvas.height, performance.now() - originReference.current);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return (): void => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameId);
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
