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

  function followPointer(e: PointerEvent<HTMLDivElement>) {
    if (pinned || e.pointerType !== "mouse" || !zoomLayer.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    zoomLayer.current.style.transformOrigin = `${x}% ${y}%`;
  }

  return (
    <div
      className="size-full overflow-hidden"
      onPointerEnter={(e) => {
        pointerInside.current = true;
        followPointer(e);
      }}
      onPointerMove={followPointer}
      onPointerLeave={() => {
        pointerInside.current = false;
        if (pinned) return;
        setZoomed(false);
        onHover(undefined);
      }}
    >
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
  );
}
