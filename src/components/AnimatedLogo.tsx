import { easeInOut, motion, useReducedMotion } from "motion/react";
import { logoPaths, logoViewBox } from "../constants/LogoPath";
import { CRT_FPS } from "../crt";

const TRACE_DURATION = 1.2;
const STROKE_WIDTH = 20;
const FRAMES = Math.round(TRACE_DURATION * CRT_FPS);

/** Holds each eased value for a whole frame, so the trace moves in visible steps. */
const lowFramerate = (t: number) => easeInOut(Math.floor(t * FRAMES) / FRAMES);

/** The logo as an orange outline, traced in once when it appears, after `delay` seconds. */
export function AnimatedLogo({
  label,
  delay = 0,
  className = "",
}: {
  label: string;
  delay?: number;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <svg
      viewBox={logoViewBox}
      fill="none"
      role="img"
      aria-label={label}
      className={`text-primary ${className}`}
    >
      {logoPaths.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: reduceMotion ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay, duration: TRACE_DURATION, ease: lowFramerate }}
        />
      ))}
    </svg>
  );
}
