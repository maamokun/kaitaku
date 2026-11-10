import { useState, type ReactNode } from "react";

type Shown = { current: string; previous: string | null; scene: string; cut: boolean };

/**
 * A small CRT screen. When `contentKey` changes within the same `scene`, the new content is drawn row
 * by row over the old (odd rows from the top, even rows from the bottom), with no blank in between.
 * When the `scene` changes, the old content is swept out to a blank screen and the new one swept in.
 */
export function CrtPanel({
  contentKey,
  scene,
  render,
  className = "",
  drawsItself = false,
  behind,
}: {
  contentKey: string;
  scene: string;
  render: (key: string) => ReactNode;
  className?: string;
  /** The new content animates itself in, so after a cut it appears without the scanline sweep. */
  drawsItself?: boolean;
  /** Kept mounted beneath the content, whatever is showing, e.g. something slow to set up. */
  behind?: ReactNode;
}) {
  const [shown, setShown] = useState<Shown>({
    current: contentKey,
    previous: null,
    scene,
    cut: false,
  });
  if (shown.current !== contentKey || shown.scene !== scene) {
    const cut = shown.scene !== scene;
    setShown({ current: contentKey, previous: shown.current, scene, cut });
  }

  return (
    <div className={`relative overflow-hidden rounded-box bg-base-100 ${className}`}>
      {behind}
      {shown.cut ? (
        <>
          <div key={contentKey} className="crt-entering absolute inset-0">
            {render(contentKey)}
          </div>
          {shown.previous !== null && (
            <div
              // Same key as when it was current, so it isn't remounted (and the 3D model not reloaded).
              key={shown.previous}
              aria-hidden
              className="crt-leaving absolute inset-0"
              // Unmount it once it's gone, so nothing (like the 3D model) keeps running hidden.
              onAnimationEnd={(e) =>
                e.target === e.currentTarget && setShown({ ...shown, previous: null })
              }
            >
              {render(shown.previous)}
            </div>
          )}
          <CrtCut key={`${contentKey}:cut`} sweepIn={!drawsItself} />
        </>
      ) : (
        <>
          {shown.previous !== null && (
            <div aria-hidden className="absolute inset-0">
              {render(shown.previous)}
            </div>
          )}
          <div key={`${contentKey}:odd`} className="crt-swap crt-swap-down crt-rows-odd">
            {render(contentKey)}
          </div>
          <div
            key={`${contentKey}:even`}
            aria-hidden
            className="crt-swap crt-swap-up crt-rows-even"
          >
            {render(contentKey)}
          </div>
        </>
      )}
      <div aria-hidden className="crt-overlay pointer-events-none absolute inset-0" />
    </div>
  );
}

/**
 * Blank covers that sweep in over the old content, then sweep away to reveal what's under them (or,
 * without `sweepIn`, just vanish). Give it a new `key` to cut again.
 */
export function CrtCut({ onSwept, sweepIn = true }: { onSwept?: () => void; sweepIn?: boolean }) {
  const instant = sweepIn ? "" : "crt-cut-instant";
  return (
    <>
      <div
        aria-hidden
        className={`crt-cut crt-cut-down crt-rows-odd ${instant}`}
        onAnimationEnd={(e) =>
          // The second animation, the cover sweeping away (a fade with reduced motion).
          (e.animationName === "crt-sweep-down" || e.animationName === "crt-fade-out") &&
          onSwept?.()
        }
      />
      <div aria-hidden className={`crt-cut crt-cut-up crt-rows-even ${instant}`} />
    </>
  );
}
