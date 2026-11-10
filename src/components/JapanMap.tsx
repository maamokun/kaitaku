import { geoMercator, geoPath } from "d3-geo";
import type { MultiPoint } from "geojson";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Visited } from "../../shared/visited";
import { prefectureName, prefectures } from "../prefectures";

const WIDTH = 800;
const HEIGHT = 920;

// Frame Hokkaido's and Okinawa's outer edges; Tokyo's remote Pacific islands would otherwise shrink the map.
const FRAME: MultiPoint = {
  type: "MultiPoint",
  coordinates: [
    [122.93, 24.04],
    [148.9, 45.56],
  ],
};
const MARGIN = 0.05 * WIDTH;
const projection = geoMercator().fitExtent(
  [
    [MARGIN, MARGIN],
    [WIDTH - MARGIN, HEIGHT - MARGIN],
  ],
  FRAME,
);
const path = geoPath(projection);

// Within this distance of land the map zooms in and keeps the last prefecture shown, so crossing
// straits like the Kii Channel (Osaka to Tokushima) doesn't flash back to the overview.
const STICKY_KM = 25;
const KM_PER_DEGREE_LAT = 111.2;
const unitsPerKm =
  Math.abs(projection([135, 35])![1] - projection([135, 36])![1]) / KM_PER_DEGREE_LAT;
const coastBand = { d: path(prefectures) ?? undefined, width: 2 * STICKY_KM * unitsPerKm };

type Visit = Visited["prefectures"][number];

// Touch screens zoom by pinching, up to this scale. A touch that moves further than TAP_SLOP pixels
// is a pan, not a tap, so it doesn't select (or unpin) anything.
const MAX_PINCH = 4;
const TAP_SLOP = 8;
type Point = { x: number; y: number };

export function JapanMap({
  visited,
  lit,
  selected,
  onSelect,
  onSeaClick,
  onHover,
}: {
  visited: Map<number, Visit>;
  lit: Set<number>;
  selected: number | undefined;
  onSelect: (id: number) => void;
  onSeaClick: () => void;
  onHover: (id: number | undefined) => void;
}) {
  const zoomLayer = useRef<HTMLDivElement>(null);
  const [zoomed, setZoomed] = useState(false);
  // While a prefecture is pinned the map holds still. Unpinning with the mouse over the map leaves
  // the view as it is (the next move takes over); with the mouse elsewhere, it zooms back out.
  const pinned = selected !== undefined;
  const pointerInside = useRef(false);
  useEffect(() => {
    if (!pinned && !pointerInside.current) setZoomed(false);
  }, [pinned]);

  const pinchLayer = useRef<HTMLDivElement>(null);
  const touches = useRef(new Map<number, Point>());
  const pinch = useRef({ scale: 1, x: 0, y: 0 });
  const gesture = useRef({ start: { x: 0, y: 0 }, moved: false });

  function trackTouch(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    const point = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (e.type === "pointerdown") {
      touches.current.set(e.pointerId, point);
      if (touches.current.size === 1) gesture.current = { start: point, moved: false };
      else gesture.current.moved = true;
      return;
    }
    const previous = touches.current.get(e.pointerId);
    if (!previous) return;
    const before = [...touches.current.values()];
    touches.current.set(e.pointerId, point);
    const after = [...touches.current.values()];
    const g = gesture.current;
    if (Math.hypot(point.x - g.start.x, point.y - g.start.y) > TAP_SLOP) g.moved = true;

    let { scale, x, y } = pinch.current;
    if (after.length >= 2) {
      // Scale about the fingers' midpoint, keeping the map point under it beneath it.
      const [a0, b0] = before;
      const [a1, b1] = after;
      const mid0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
      const mid1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
      const ratio = Math.hypot(a1.x - b1.x, a1.y - b1.y) / Math.hypot(a0.x - b0.x, a0.y - b0.y);
      const next = Math.min(MAX_PINCH, Math.max(1, scale * ratio));
      x = mid1.x - ((mid0.x - x) / scale) * next;
      y = mid1.y - ((mid0.y - y) / scale) * next;
      scale = next;
    } else if (scale > 1) {
      x += point.x - previous.x;
      y += point.y - previous.y;
    }
    // Keep the map covering the frame: it can't be dragged away from any edge.
    x = Math.min(0, Math.max(r.width * (1 - scale), x));
    y = Math.min(0, Math.max(r.height * (1 - scale), y));
    pinch.current = { scale, x, y };
    pinchLayer.current!.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  function releaseTouch(e: PointerEvent<HTMLDivElement>) {
    touches.current.delete(e.pointerId);
  }

  function followPointer(e: PointerEvent<HTMLDivElement>) {
    if (pinned || e.pointerType !== "mouse" || !zoomLayer.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    zoomLayer.current.style.transformOrigin = `${x}% ${y}%`;
  }

  return (
    <div
      className="size-full touch-none overflow-hidden"
      onPointerDown={trackTouch}
      onPointerUp={releaseTouch}
      onPointerCancel={releaseTouch}
      onClickCapture={(e) => {
        // The end of a pan or pinch isn't a tap.
        if (!gesture.current.moved) return;
        gesture.current.moved = false;
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerEnter={(e) => {
        pointerInside.current = true;
        followPointer(e);
      }}
      onPointerMove={(e) => {
        trackTouch(e);
        followPointer(e);
      }}
      onPointerLeave={() => {
        pointerInside.current = false;
        if (pinned) return;
        setZoomed(false);
        onHover(undefined);
      }}
    >
      <div ref={pinchLayer} className="size-full origin-top-left">
        <div
          ref={zoomLayer}
          className={`size-full transition-transform duration-300 ease-out motion-reduce:transition-none ${zoomed ? "scale-250" : ""}`}
        >
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="size-full"
            role="group"
            aria-label="Map of Japan"
            onClick={(e) => {
              const target = e.target as Element;
              if (target === e.currentTarget || target.hasAttribute("data-sea")) onSeaClick();
            }}
            onPointerMove={(e) => {
              if (pinned) return;
              const nearLand = e.target !== e.currentTarget;
              if (e.pointerType === "mouse") setZoomed(nearLand);
              if (!nearLand) onHover(undefined);
            }}
          >
            <path
              d={coastBand.d}
              fill="none"
              stroke="transparent"
              strokeWidth={coastBand.width}
              strokeLinejoin="round"
              pointerEvents="stroke"
              data-sea
              aria-hidden
            />
            {prefectures.features.map((p) => {
              const { id } = p.properties;
              const v = visited.get(id);
              const isSelected = id === selected;
              return (
                <path
                  key={id}
                  d={path(p) ?? undefined}
                  onPointerEnter={(e) => !pinned && e.pointerType === "mouse" && onHover(id)}
                  className={[
                    "outline-none [stroke-width:0.5] stroke-base-content/30 transition-colors duration-300",
                    lit.has(id)
                      ? "fill-primary hover:fill-accent"
                      : "fill-base-300 hover:brightness-125",
                    v ? "cursor-pointer" : "",
                    "focus-visible:[stroke-width:2] focus-visible:stroke-base-content",
                    isSelected ? "prefecture-pinned" : "",
                  ].join(" ")}
                  {...(v && {
                    "data-prefecture": id,
                    role: "button",
                    tabIndex: 0,
                    "aria-label": `Show details for ${prefectureName(id)}`,
                    "aria-pressed": isSelected,
                    onClick: () => onSelect(id),
                    onKeyDown: (e: KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(id);
                      }
                    },
                  })}
                >
                  <title>{prefectureName(id)}</title>
                </path>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
