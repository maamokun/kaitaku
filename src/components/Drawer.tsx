import { ChevronUp } from "lucide-react";
import {
  animate,
  motion,
  useDragControls,
  useMotionValue,
  useReducedMotion,
  type MotionValue,
  type PanInfo,
} from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

// While closed, this much of the sheet (its handle) stays on screen as the button to open it.
const PEEK = 56;
const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;
const FLING = 500;

const restingY = (sheet: HTMLElement, closed: boolean) => (closed ? sheet.offsetHeight - PEEK : 0);
const slide = (y: MotionValue<number>, to: number) =>
  animate(y, to, { duration: 0.3, ease: EASE_DRAWER });

/**
 * A bottom sheet while `enabled` (phones): opened and closed by its handle, or dragged by it. When
 * not enabled it's an ordinary element, and `className` lays it out.
 */
export function Drawer({
  open,
  onOpenChange,
  enabled,
  label,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled: boolean;
  label: string;
  className: string;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLElement>(null);
  const y = useMotionValue(0);
  const [closedY, setClosedY] = useState(0);
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const dragged = useRef(false);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const to = restingY(sheet.current!, enabled && !open);
    // The first placement (and every one, with reduced motion) is instant.
    if (!placed.current || reduceMotion) {
      placed.current = true;
      y.jump(to);
      return;
    }
    return slide(y, to).stop;
  }, [open, enabled, reduceMotion, y]);

  // The sheet's height follows the viewport (rotation, the browser's toolbar), and so does where
  // it rests when closed.
  useEffect(() => {
    if (!enabled) return;
    const observer = new ResizeObserver(() => {
      setClosedY(sheet.current!.offsetHeight - PEEK);
      if (!open) y.jump(restingY(sheet.current!, true));
    });
    observer.observe(sheet.current!);
    return () => observer.disconnect();
  }, [enabled, open, y]);

  function settle(_: unknown, info: PanInfo) {
    // A quarter of the way from where it was is enough to change state; so is a fling.
    const threshold = open ? 0.25 : 0.75;
    const next =
      info.velocity.y > FLING
        ? false
        : info.velocity.y < -FLING
          ? true
          : y.get() < closedY * threshold;
    if (next === open) slide(y, restingY(sheet.current!, !open));
    else onOpenChange(next);
  }

  return (
    <motion.aside
      ref={sheet}
      aria-label={label}
      className={className}
      style={{ y }}
      drag={enabled ? "y" : false}
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: closedY }}
      dragElastic={{ top: 0.05, bottom: 0.2 }}
      dragMomentum={false}
      onDragStart={() => (dragged.current = true)}
      onDragEnd={settle}
    >
      {enabled && (
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? `Hide ${label}` : `Show ${label}`}
          className="flex h-14 w-full shrink-0 touch-none flex-col items-center justify-center gap-1 text-base-content/60"
          onPointerDown={(e) => {
            dragged.current = false;
            dragControls.start(e);
          }}
          onClick={() => {
            // Letting go after a drag isn't a press.
            if (dragged.current) return;
            onOpenChange(!open);
          }}
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-base-content/30" />
          <ChevronUp
            aria-hidden
            size={18}
            className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          />
        </button>
      )}
      {children}
    </motion.aside>
  );
}
