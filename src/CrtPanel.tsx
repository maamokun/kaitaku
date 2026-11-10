import { useState, type ReactNode } from "react";

/**
 * A small CRT screen. When `contentKey` changes, the new content is drawn row by row over the old
 * (odd rows from the top, even rows from the bottom), so there is never a blank frame in between.
 */
export function CrtPanel({
  contentKey,
  render,
  className = "",
}: {
  contentKey: string;
  render: (key: string) => ReactNode;
  className?: string;
}) {
  const [keys, setKeys] = useState<{ current: string; previous: string | null }>({
    current: contentKey,
    previous: null,
  });
  if (keys.current !== contentKey) setKeys({ current: contentKey, previous: keys.current });

  return (
    <div className={`relative overflow-hidden rounded-box bg-base-100 ${className}`}>
      {keys.previous !== null && (
        <div aria-hidden className="absolute inset-0">
          {render(keys.previous)}
        </div>
      )}
      <div key={`${contentKey}:odd`} className="crt-swap crt-swap-down crt-rows-odd">
        {render(contentKey)}
      </div>
      <div key={`${contentKey}:even`} aria-hidden className="crt-swap crt-swap-up crt-rows-even">
        {render(contentKey)}
      </div>
      <div aria-hidden className="crt-overlay pointer-events-none absolute inset-0" />
    </div>
  );
}
