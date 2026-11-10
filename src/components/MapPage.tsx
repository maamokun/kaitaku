import { ImageIcon, Pin } from "lucide-react";
import { motion, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import type { Visited } from "../../shared/visited";
import { CrtCut, CrtPanel } from "./CrtPanel";
import { CrtScreen } from "./CrtScreen";
import { formatFirstVisitedJa, formatVisitCountJa } from "../format";
import { JapanMap } from "./JapanMap";
import { byDistanceFromOsaka, prefectureName, prefectureNames, prefectures } from "../prefectures";
import { SegmentCount } from "./SegmentCount";
import { playTapBeep } from "../sound";
import { COUNT_UP_SECONDS, useCountUp } from "../useCountUp";
import { AnimatedLogo } from "./AnimatedLogo";
import { TPoseRotate } from "./VrmTposeRotate";

type VisitedPrefecture = Visited["prefectures"][number];

const TOTAL = prefectures.features.length;

const evidenceUrl = (id: number) => `/api/evidence/${id}`;

// Screen content keys: "off" before power-on, "idle" with nothing to show, "about", or "p<prefecture id>".
const OFF = "off";
const ABOUT = "about";
const IDLE = "idle";
const prefectureKey = (id: number) => `p${id}`;
// New content on a cut becomes visible once the old has been swept out, which takes one sweep.
const crtSweepSeconds = () =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--crt-sweep")) / 1000;
const prefectureFromKey = (key: string) => (key.startsWith("p") ? Number(key.slice(1)) : undefined);

export default function MapPage() {
  const { data, error } = useSWR<Visited>("/api/visited");
  const visited = new Map(data?.prefectures.map((p) => [p.id, p]));
  const [selected, setSelected] = useState<number>();
  const [hovered, setHovered] = useState<number>();
  // `selected` is the pinned prefecture: it outranks whatever the mouse is over.
  const shown = selected ?? hovered;
  const total = data?.prefectures.length;
  // The count display: blank while off, 0 while the map is being revealed, then counting up (and
  // lighting the map) once it's fully shown. Runs at startup and again on every return from about.
  const [countPhase, setCountPhase] = useState<"off" | "zero" | "counting">("off");
  // Startup can finish after the about page was opened; the count stays off then.
  const markBooted = useCallback(() => setCountPhase((p) => (p === "off" ? p : "counting")), []);
  const [mapRevealing, setMapRevealing] = useState(false);
  const markMapReveal = useCallback(() => {
    setMapRevealing(true);
    setCountPhase("zero");
  }, []);
  const { count, shown: countShown } = useCountUp(countPhase === "counting" ? total : undefined);
  const progress = useTransform(count, (v) => v / TOTAL);
  const lit = new Set(
    byDistanceFromOsaka(data?.prefectures.map((p) => p.id) ?? []).slice(0, countShown),
  );
  const info = useRef<HTMLElement>(null);
  // The "?" button swaps every screen over to the about page. Changing between the two cuts to blank.
  const [about, setAbout] = useState(false);
  const scene = about ? "about" : "map";
  // Setting up the 3D view stalls the page for a moment, so it's done once, after the startup
  // count-up (or on the first "?" press if that comes sooner), and then kept.
  const [has3d, setHas3d] = useState(false);
  useEffect(() => {
    if (countPhase !== "counting" || has3d) return;
    const timer = setTimeout(() => setHas3d(true), COUNT_UP_SECONDS * 1000 + 100);
    return () => clearTimeout(timer);
  }, [countPhase, has3d]);

  useEffect(() => {
    for (const p of data?.prefectures ?? []) {
      if (!p.hasEvidence) continue;
      const img = new Image();
      img.fetchPriority = "low";
      img.src = evidenceUrl(p.id);
    }
  }, [data]);

  function unpin() {
    setSelected(undefined);
    setHovered(undefined);
  }

  function togglePin(id: number) {
    playTapBeep();
    if (id === selected) {
      setSelected(undefined);
      // The pointer is still on it, so keep showing it as hovered.
      setHovered(id);
      return;
    }
    setSelected(id);
    // On stacked (phone) layouts the screens are below the map, out of view.
    if (!matchMedia("(min-width: 64rem)").matches)
      info.current?.scrollIntoView({ behavior: "smooth" });
  }

  function toggleAbout() {
    playTapBeep();
    setAbout(!about);
    setHovered(undefined);
    if (!about) setCountPhase("off");
    setHas3d(true);
  }

  const infoKey = about
    ? ABOUT
    : !mapRevealing
      ? OFF
      : shown === undefined
        ? IDLE
        : prefectureKey(shown);
  const photoKey = about
    ? ABOUT
    : !mapRevealing
      ? OFF
      : shown !== undefined && visited.get(shown)?.hasEvidence
        ? prefectureKey(shown)
        : IDLE;

  return (
    <div className="grid min-h-dvh lg:h-dvh lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:overflow-hidden">
      <section className="relative h-[min(75vh,115vw)] p-4 lg:h-dvh lg:p-8">
        <CrtScreen onMapReveal={markMapReveal} onBooted={markBooted}>
          <div
            className={`size-full ${about ? "crt-leaving" : "crt-entering"}`}
            // Back from about: the map is now behind a blank screen that is about to sweep away.
            onAnimationEnd={(e) =>
              e.target === e.currentTarget &&
              e.animationName === "crt-wait-hidden" &&
              mapRevealing &&
              !about &&
              setCountPhase("zero")
            }
          >
            <JapanMap
              visited={visited}
              lit={lit}
              selected={selected}
              onSelect={togglePin}
              onSeaClick={unpin}
              onHover={setHovered}
            />
          </div>
          <div aria-hidden={!about} className={about ? "crt-entering" : "crt-leaving"}>
            <AboutScreen />
          </div>
          <CrtCut key={scene} onSwept={() => mapRevealing && !about && setCountPhase("counting")} />
        </CrtScreen>
        {!about && selected !== undefined && (
          <button
            type="button"
            aria-label={`Unpin ${prefectureName(selected)}`}
            className="btn btn-square btn-ghost btn-sm absolute top-6 left-6 text-primary lg:top-10 lg:left-10"
            onClick={() => {
              playTapBeep();
              unpin();
            }}
          >
            <Pin aria-hidden size={16} />
          </button>
        )}
        <p
          hidden={about}
          className="pointer-events-none absolute right-7 bottom-6 text-[10px] text-base-content/40 lg:right-11 lg:bottom-10"
        >
          Boundaries: 地球地図日本 (GSI Global Map Japan) via dataofjapan/land
        </p>
      </section>
      <aside ref={info} className="flex flex-col gap-6 bg-base-200 p-6 lg:h-dvh lg:p-8">
        <header className="flex flex-col gap-3">
          {error ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-error">Could not load visited prefectures.</p>
              <AboutButton pressed={about} disabled={!mapRevealing} onClick={toggleAbout} />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <p className="flex items-baseline gap-3">
                  <SegmentCount
                    value={
                      countPhase === "counting" ? countShown : countPhase === "zero" ? 0 : undefined
                    }
                    className="text-6xl"
                  />
                  <span className="text-3xl text-base-content/60">
                    / <span className="font-script">{TOTAL}</span>
                  </span>
                  <span className="sr-only">
                    {total === undefined ? "Loading" : `${total} of ${TOTAL}`}
                  </span>
                </p>
                <AboutButton pressed={about} disabled={!mapRevealing} onClick={toggleAbout} />
              </div>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={TOTAL}
                aria-valuenow={total ?? 0}
                className="h-2 w-full overflow-hidden rounded-full bg-primary/20"
              >
                <motion.div
                  className="h-full w-full origin-left rounded-full bg-primary"
                  style={{ scaleX: progress }}
                />
              </div>
            </>
          )}
        </header>

        <CrtPanel
          contentKey={infoKey}
          scene={scene}
          className="h-28 shrink-0"
          drawsItself={infoKey === ABOUT}
          render={(key) => (
            <InfoScreen contentKey={key} visit={visited.get(prefectureFromKey(key) ?? -1)} />
          )}
        />
        <CrtPanel
          contentKey={photoKey}
          scene={scene}
          className="aspect-[4/3] lg:aspect-auto lg:min-h-0 lg:flex-1"
          render={(key) => <PhotoScreen contentKey={key} />}
          behind={
            has3d && (
              <div className={`absolute inset-0 ${about ? "crt-entering" : "crt-leaving"}`}>
                <TPoseRotate active={about} />
              </div>
            )
          }
        />
      </aside>
    </div>
  );
}

function AboutButton({
  pressed,
  disabled,
  onClick,
}: {
  pressed: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="About"
      aria-pressed={pressed}
      disabled={disabled}
      className="retro-button shrink-0 font-dot text-2xl disabled:opacity-50"
      onClick={onClick}
    >
      ?
    </button>
  );
}

function AboutScreen() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-10 text-center">
      <h2 className="font-title text-5xl font-semibold text-primary">なにこれ？</h2>
      <p className="max-w-md font-dot text-base-content/80">
        元々チュウニズムで行った都道府県を記録してたけど、なんかサービス停止とかするし、友達に「チュウニズムするためだけに旅行してるんか！」
        とか言われたので、このサイトを作ってみました。証拠写真とともに行った都道府県の記録がされています！
        <br />
        撮った写真の位置情報データを基に、自動的に行った都道府県が記録されています。
        <br />
        大体AIで作られていますが、無駄にデザインを凝らせた遊び心あるサイトになっているかと思います。
      </p>
    </div>
  );
}

function InfoScreen({
  contentKey,
  visit,
}: {
  contentKey: string;
  visit: VisitedPrefecture | undefined;
}) {
  const id = prefectureFromKey(contentKey);
  if (contentKey === OFF) return null;
  if (contentKey === ABOUT) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <AnimatedLogo
          label="MikanDev"
          delay={crtSweepSeconds()}
          className="max-h-full max-w-full"
        />
      </div>
    );
  }
  if (id === undefined) {
    return (
      <div className="flex h-full items-center justify-center px-6 font-title text-xl font-semibold text-primary">
        都道府県を選んでください
      </div>
    );
  }
  return (
    <div className="flex h-full items-center justify-between gap-4 px-6">
      <span className="font-title text-3xl font-semibold text-primary">
        {prefectureNames(id).ja}
      </span>
      <span className="text-right font-dot text-sm text-base-content/80">
        {visit?.visitCount === null ? null : visit ? (
          <>
            <time className="block" dateTime={visit.firstVisited ?? undefined}>
              {formatFirstVisitedJa(visit.firstVisited)}に初訪問
            </time>
            {visit.visitCount !== null && visit.visitCount > 0 && (
              <span className="block">{formatVisitCountJa(visit.visitCount)}</span>
            )}
          </>
        ) : (
          "未訪問"
        )}
      </span>
    </div>
  );
}

function PhotoScreen({ contentKey }: { contentKey: string }) {
  const id = prefectureFromKey(contentKey);
  if (contentKey === OFF) return null;
  // The model itself is kept loaded behind the screen's content; see `behind`.
  if (contentKey === ABOUT) return null;
  if (id === undefined) {
    return (
      <div className="flex h-full items-center justify-center text-base-content/20">
        <ImageIcon aria-hidden size={56} strokeWidth={1.5} />
      </div>
    );
  }
  // Sized to the photo's own shape, so the frame hugs portrait and landscape photos alike.
  return (
    <div className="flex size-full items-center justify-center p-6 lg:p-8">
      <img
        src={evidenceUrl(id)}
        alt={`Photo taken in ${prefectureNames(id).en}`}
        className="max-h-full max-w-full rounded-field shadow-lg ring-1 ring-base-content/10"
      />
    </div>
  );
}
