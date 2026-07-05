import { useEffect, useRef } from "react";
import type React from "react";

import { tokens } from "../../tokens/tokens";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const MAX_DEVICE_PIXEL_RATIO = 2;

// Ported directly from Drishti.dc.html's `startWave()` — a bundle of LINE_COUNT
// strands that fan out vertically but pinch together at a slowly-drifting
// "fold" point (the gaussian bump below), rather than N independent parallel
// sine waves. That convergent pinch is the animation's actual visual
// signature, not a detail that can be dropped for a simpler approximation.
const LINE_COUNT = 40;
const SEGMENTS_PER_LINE = 110;
const LINE_WIDTH = 0.7;

const FOLD_X_BASE = 0.46; // horizontal position (0..1) the bundle pinches toward
const FOLD_X_DRIFT = 0.06;
const FOLD_X_DRIFT_SPEED = 0.11;
const FOLD_GAUSSIAN_VARIANCE = 0.016; // narrower = tighter pinch

const SWAY_1_AMPLITUDE = 1.15;
const SWAY_1_SPEED = 0.17;
const SWAY_2_AMPLITUDE = 0.85;
const SWAY_2_SPEED = 0.23;
const SWAY_2_OFFSET = 1.0;
const SWAY_3_AMPLITUDE = 1.25;
const SWAY_3_SPEED = 0.13;
const SWAY_3_OFFSET = 2.0;

const AMPLITUDE_MODULATION_DEPTH = 0.1;
const AMPLITUDE_MODULATION_SPEED = 0.29;

const MID_Y_RATIO = 0.52; // bundle's vertical center, as a fraction of container height
const TILT_HEIGHT_RATIO = 0.26; // diagonal sweep across the width
const SPREAD_HEIGHT_RATIO = 0.52; // how far the bundle fans out vertically
const SPREAD_FOLD_COLLAPSE = 0.82; // how much the fan-out collapses at the fold point
const SWING_FREQUENCY = 1.7;
const SWING_HEIGHT_RATIO = 0.135;
const SWING_LINE_OFFSET_MULTIPLIER = 1.9;
const RIPPLE_FREQUENCY = 3.2;
const RIPPLE_HEIGHT_RATIO = 0.028;
const RIPPLE_LINE_OFFSET_MULTIPLIER = 2.5;
const FOLD_TWIST_FREQUENCY = 2.0;
const FOLD_TWIST_HEIGHT_RATIO = 0.16;

const ALPHA_FLOOR = 0.05; // outermost lines in the bundle
const ALPHA_CENTER_BOOST = 0.16; // added on top of the floor for the centermost lines

function drawWave(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedSeconds: number,
): void {
  context.clearRect(0, 0, width, height);
  if (width === 0 || height === 0) return;

  const foldX = FOLD_X_BASE + FOLD_X_DRIFT * Math.sin(elapsedSeconds * FOLD_X_DRIFT_SPEED);
  const sway1 = SWAY_1_AMPLITUDE * Math.sin(elapsedSeconds * SWAY_1_SPEED);
  const sway2 = SWAY_2_AMPLITUDE * Math.sin(elapsedSeconds * SWAY_2_SPEED + SWAY_2_OFFSET);
  const sway3 = SWAY_3_AMPLITUDE * Math.sin(elapsedSeconds * SWAY_3_SPEED + SWAY_3_OFFSET);
  const amplitudeModulation =
    1 + AMPLITUDE_MODULATION_DEPTH * Math.sin(elapsedSeconds * AMPLITUDE_MODULATION_SPEED);
  const midY = height * MID_Y_RATIO;

  context.lineWidth = LINE_WIDTH;
  context.lineJoin = "round";
  context.strokeStyle = tokens.color.goldLine;

  // x/foldProximity/tilt depend only on the segment position and this frame's
  // foldX/width/height — not on which line is being drawn — so precompute
  // them once per frame instead of recomputing them LINE_COUNT times over.
  const segments: { xn: number; x: number; foldProximity: number; tilt: number }[] = [];
  for (let segment = 0; segment <= SEGMENTS_PER_LINE; segment += 1) {
    const xn = segment / SEGMENTS_PER_LINE;
    segments.push({
      xn,
      x: xn * width,
      foldProximity: Math.exp(-((xn - foldX) ** 2) / (2 * FOLD_GAUSSIAN_VARIANCE)),
      tilt: (xn - 0.5) * height * TILT_HEIGHT_RATIO,
    });
  }

  for (let line = 0; line < LINE_COUNT; line += 1) {
    const lineOffset = line / (LINE_COUNT - 1); // 0..1 position within the bundle
    context.beginPath();
    for (let segment = 0; segment <= SEGMENTS_PER_LINE; segment += 1) {
      const { xn, x, foldProximity, tilt } = segments[segment];
      const spread =
        (lineOffset - 0.5) *
        height *
        SPREAD_HEIGHT_RATIO *
        (1 - SPREAD_FOLD_COLLAPSE * foldProximity);
      const swing =
        Math.sin(
          xn * Math.PI * SWING_FREQUENCY + sway1 + lineOffset * SWING_LINE_OFFSET_MULTIPLIER,
        ) *
        height *
        SWING_HEIGHT_RATIO *
        amplitudeModulation;
      const ripple =
        Math.sin(
          xn * Math.PI * RIPPLE_FREQUENCY + sway2 - lineOffset * RIPPLE_LINE_OFFSET_MULTIPLIER,
        ) *
        height *
        RIPPLE_HEIGHT_RATIO;
      const foldTwist =
        foldProximity *
        Math.sin(lineOffset * Math.PI * FOLD_TWIST_FREQUENCY + sway3) *
        height *
        FOLD_TWIST_HEIGHT_RATIO;
      const y = midY + tilt + spread + swing + ripple + foldTwist;
      if (segment === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    // Peaks at the bundle's center line, fades toward both edges.
    const centerness = Math.sin(lineOffset * Math.PI);
    context.globalAlpha = ALPHA_FLOOR + ALPHA_CENTER_BOOST * centerness;
    context.stroke();
  }
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

    const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    let frameId: number | null = null;

    const stop = (): void => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    // Sizes the canvas's backing store to the real device pixel ratio (capped
    // at 2x) each frame, matching Drishti.dc.html's own crisp-on-retina
    // handling — a canvas left at its CSS size renders visibly blurrier than
    // the prototype on any HiDPI display.
    const renderFrame = (elapsedSeconds: number): void => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
      const backingWidth = Math.round(width * dpr);
      const backingHeight = Math.round(height * dpr);
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawWave(context, width, height, elapsedSeconds);
    };

    const start = (): void => {
      stop();
      const tick = (now: number): void => {
        renderFrame((now - originReference.current) / 1000);
        frameId = requestAnimationFrame(tick);
      };
      frameId = requestAnimationFrame(tick);
    };

    const applyMotionPreference = (): void => {
      if (reducedMotionQuery.matches) {
        stop();
        renderFrame(0);
      } else {
        start();
      }
    };

    // While the rAF loop runs, renderFrame re-reads canvas.clientWidth/Height
    // every frame, so it self-corrects on resize. But when reduced-motion is
    // active, applyMotionPreference only calls renderFrame(0) once — with no
    // loop to catch a later resize, the backing store would stay pinned to
    // whatever size it was at that single call, stretching the drawing
    // relative to the CSS box on the next window/orientation resize.
    const handleResize = (): void => {
      if (reducedMotionQuery.matches) renderFrame(0);
    };

    applyMotionPreference();
    reducedMotionQuery.addEventListener("change", applyMotionPreference);
    window.addEventListener("resize", handleResize);

    return (): void => {
      reducedMotionQuery.removeEventListener("change", applyMotionPreference);
      window.removeEventListener("resize", handleResize);
      stop();
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvasReference} className="absolute inset-0 h-full w-full" />
      <div className="absolute -top-[12%] left-[10%] h-ask-blob-lg w-ask-blob-lg animate-wave-x">
        <div className="h-full w-full animate-wave-y animate-breathe rounded-full bg-gold/[0.09] blur-3xl" />
      </div>
      <div className="absolute -bottom-[16%] right-[6%] h-ask-blob-sm w-ask-blob-sm animate-wave-x">
        <div className="h-full w-full animate-wave-y animate-breathe rounded-full bg-gold/[0.06] blur-3xl" />
      </div>
    </div>
  );
}
