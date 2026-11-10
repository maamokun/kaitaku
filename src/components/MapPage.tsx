import { ImageIcon, Pin } from "lucide-react";
import { motion, useTransform } from "motion/react";
import { useCallback, useEffect, useState } from "react";
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
import { Drawer } from "./Drawer";
import { useMediaQuery } from "../useMediaQuery";

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
  // On phones the screens live in a bottom drawer, which opens to show what was selected.
  const isPhone = !useMediaQuery("(min-width: 48rem)");
  const [drawerOpen, setDrawerOpen] = useState(false);
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
    setDrawerOpen(false);
  }

  function togglePin(id: number) {
    playTapBeep();
    if (id === selected) {
      setSelected(undefined);
      // The pointer is still on it, so keep showing it as hovered.
      setHovered(id);
      setDrawerOpen(false);
      return;
    }
    setSelected(id);
    setDrawerOpen(true);
  }

  function toggleAbout() {
    playTapBeep();
    setAbout(!about);
    setHovered(undefined);
    if (!about) {
      setCountPhase("off");
      setDrawerOpen(true);
    }
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
    <div className="h-dvh overflow-hidden md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:grid-rows-[auto_minmax(0,1fr)]">
      {/* On phones the map screen fits above the drawer, so an open drawer never hides the
          selected prefecture. It resizes along with the drawer, on the same curve. */}
      <section
        className={`relative h-dvh px-3 pt-20 transition-[padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none md:row-span-2 md:p-8 md:transition-none ${drawerOpen ? "pb-[calc(55dvh+0.75rem)]" : "pb-[4.25rem]"}`}
      >
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
            className="btn btn-square btn-ghost btn-sm absolute top-[5.5rem] left-5 text-primary md:top-10 md:left-10"
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
          className="pointer-events-none absolute right-5 bottom-[4.75rem] text-[10px] text-base-content/40 md:right-11 md:bottom-10"
        >
          Boundaries: 地球地図日本 (GSI Global Map Japan) via dataofjapan/land
        </p>
      </section>
      {/* Phones: a floating pill over the map. From md: the top of the right-hand column. */}
      <header className="fixed top-3 left-1/2 z-20 grid w-[min(22rem,calc(100%-1.5rem))] -translate-x-1/2 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-full bg-base-200/90 py-1.5 pr-1.5 pl-5 shadow-lg backdrop-blur md:static md:col-start-2 md:row-start-1 md:w-auto md:translate-x-0 md:gap-y-3 md:rounded-none md:bg-base-200 md:p-8 md:pb-0 md:shadow-none md:backdrop-blur-none">
        {error ? (
          <p className="text-error">Could not load visited prefectures.</p>
        ) : (
          <>
            <p className="flex items-baseline gap-2 md:gap-3">
              <SegmentCount
                value={
                  countPhase === "counting" ? countShown : countPhase === "zero" ? 0 : undefined
                }
                className="text-3xl md:text-6xl"
              />
              <span className="text-lg text-base-content/60 md:text-3xl">
                / <span className="font-script">{TOTAL}</span>
              </span>
              <span className="sr-only">
                {total === undefined ? "Loading" : `${total} of ${TOTAL}`}
              </span>
            </p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={TOTAL}
              aria-valuenow={total ?? 0}
              className="col-start-1 row-start-2 h-1 w-full overflow-hidden rounded-full bg-primary/20 md:col-span-2 md:h-2"
            >
              <motion.div
                className="h-full w-full origin-left rounded-full bg-primary"
                style={{ scaleX: progress }}
              />
            </div>
          </>
        )}
        <div className="col-start-2 row-span-2 row-start-1 md:row-span-1">
          <AboutButton pressed={about} disabled={!mapRevealing} onClick={toggleAbout} />
        </div>
      </header>

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        enabled={isPhone}
        label="details"
        className="fixed inset-x-0 bottom-0 z-30 flex h-[55dvh] flex-col rounded-t-box bg-base-200 shadow-[0_-8px_24px_rgb(0_0_0/0.4)] md:static md:col-start-2 md:row-start-2 md:h-auto md:min-h-0 md:rounded-none md:shadow-none"
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-4 md:gap-6 md:p-8 md:pt-6">
          <CrtPanel
            contentKey={infoKey}
            scene={scene}
            className="h-20 shrink-0 md:h-28"
            drawsItself={infoKey === ABOUT}
            render={(key) => (
              <InfoScreen contentKey={key} visit={visited.get(prefectureFromKey(key) ?? -1)} />
            )}
          />
          <CrtPanel
            contentKey={photoKey}
            scene={scene}
            className="min-h-0 flex-1"
            render={(key) => <PhotoScreen contentKey={key} />}
            behind={
              has3d && (
                <div className={`absolute inset-0 ${about ? "crt-entering" : "crt-leaving"}`}>
                  <TPoseRotate active={about} />
                </div>
              )
            }
          />
        </div>
      </Drawer>
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
      className="retro-button size-9 shrink-0 rounded-full md:rounded-field font-dot text-xl disabled:opacity-50 md:size-12 md:text-2xl"
      onClick={onClick}
    >
      ?
    </button>
  );
}

function AboutScreen() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-y-auto p-4 text-center md:gap-6 md:p-10">
      <h2 className="font-title text-2xl font-semibold text-primary md:text-5xl">なにこれ？</h2>
      <p className="max-w-md font-dot text-xs text-base-content/80 md:text-base">
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
    <div className="flex size-full items-center justify-center p-6 md:p-8">
      <img
        src={evidenceUrl(id)}
        alt={`Photo taken in ${prefectureNames(id).en}`}
        className="max-h-full max-w-full rounded-field shadow-lg ring-1 ring-base-content/10"
      />
    </div>
  );
}
