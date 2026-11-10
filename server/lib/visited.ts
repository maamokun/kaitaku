import { geoBounds, geoContains, geoDistance } from "d3-geo";
import type { Feature, MultiPolygon, Polygon, Position } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import topo from "../../src/data/japan-prefectures.topo.json";
import type {
  AdminPrefecture,
  PrefectureSettings,
  Visited,
  VisitPeriod,
} from "../../shared/visited";
import { fetchPhotoLocations, type PhotoLocation, type TakenAt } from "./immich";
import { DEFAULT_SETTINGS, getAllSettings } from "./settings";

type Point = PhotoLocation["point"];
type PrefectureProps = { id: number; nam: string; nam_ja: string };
type PrefecturePhotos = {
  assetIds: string[];
  oldest: TakenAt | undefined;
  localDates: Set<string>;
};
type PhotosByPrefecture = { updatedAt: string; byPrefecture: Map<number, PrefecturePhotos> };

// Simplified outlines drop small islands and piers, so allow a near miss.
const MAX_SNAP_KM = 10;
const EARTH_RADIUS_KM = 6371;
const SNAP_MARGIN_DEG = 0.15;

const topology = topo as unknown as Topology<{ japan: GeometryCollection<PrefectureProps> }>;
const prefectures = feature(topology, topology.objects.japan)
  .features.map((f) => {
    const shape = f as Feature<Polygon | MultiPolygon, PrefectureProps>;
    const [[west, south], [east, north]] = geoBounds(shape);
    const rings =
      shape.geometry.type === "Polygon" ? [shape.geometry.coordinates] : shape.geometry.coordinates;
    return {
      id: shape.properties.id,
      shape,
      west,
      south,
      east,
      north,
      vertices: rings.flat(2) as Position[],
    };
  })
  .sort((a, b) => a.id - b.id);

export function parsePrefectureId(value: unknown): number | undefined {
  const id = Number(value);
  return prefectures.some((p) => p.id === id) ? id : undefined;
}

function withinBounds(p: (typeof prefectures)[number], [lon, lat]: Point, margin: number) {
  return (
    lon >= p.west - margin &&
    lon <= p.east + margin &&
    lat >= p.south - margin &&
    lat <= p.north + margin
  );
}

function prefectureAt(point: Point): number | undefined {
  const inside = prefectures.find((p) => withinBounds(p, point, 0) && geoContains(p.shape, point));
  if (inside) return inside.id;

  let nearest: { id: number; km: number } | undefined;
  for (const p of prefectures) {
    if (!withinBounds(p, point, SNAP_MARGIN_DEG)) continue;
    for (const v of p.vertices) {
      const km = geoDistance(point, v as Point) * EARTH_RADIUS_KM;
      if (km <= MAX_SNAP_KM && (!nearest || km < nearest.km)) nearest = { id: p.id, km };
    }
  }
  return nearest?.id;
}

export function groupByPrefecture(photos: PhotoLocation[]): Map<number, PrefecturePhotos> {
  const groups = new Map<number, PrefecturePhotos>();
  for (const { assetId, point, takenAt } of photos) {
    const id = prefectureAt(point);
    if (id === undefined) continue;
    let group = groups.get(id);
    if (!group)
      groups.set(id, (group = { assetIds: [], oldest: undefined, localDates: new Set() }));
    group.assetIds.push(assetId);
    if (!takenAt) continue;
    group.localDates.add(takenAt.localDate);
    if (!group.oldest || takenAt.utcMs < group.oldest.utcMs) group.oldest = takenAt;
  }
  return groups;
}

const DAY_MS = 86_400_000;
const nextDay = (date: string) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);

/** Groups photo dates into trips: consecutive days are one visit, a day without photos starts the next. */
export function toVisits(localDates: Iterable<string>): VisitPeriod[] {
  const visits: VisitPeriod[] = [];
  for (const date of [...localDates].sort()) {
    const last = visits.at(-1);
    if (last && nextDay(last.end) === date) last.end = date;
    else visits.push({ start: date, end: date });
  }
  return visits;
}

let latest: PhotosByPrefecture | undefined;
let inflight: Promise<PhotosByPrefecture> | undefined;

export function refreshPhotos(): Promise<PhotosByPrefecture> {
  inflight ??= fetchPhotoLocations()
    .then(
      (photos) =>
        (latest = { updatedAt: new Date().toISOString(), byPrefecture: groupByPrefecture(photos) }),
    )
    .finally(() => (inflight = undefined));
  return inflight;
}

export function getPhotos(): Promise<PhotosByPrefecture> {
  return latest ? Promise.resolve(latest) : refreshPhotos();
}

function isVisited(photoCount: number, { override }: PrefectureSettings): boolean {
  return override === "on" || (override !== "off" && photoCount > 0);
}

export async function getAdminPrefectures(): Promise<AdminPrefecture[]> {
  const [photos, settings] = await Promise.all([getPhotos(), getAllSettings()]);
  return prefectures.map(({ id }) => {
    const s = { ...DEFAULT_SETTINGS, ...settings[id] };
    const group = photos.byPrefecture.get(id);
    const photoCount = group?.assetIds.length ?? 0;
    const firstVisited = group?.oldest?.localDate ?? null;
    const visits = s.excludeVisits ? null : toVisits(group?.localDates ?? []);
    return { id, photoCount, visited: isVisited(photoCount, s), firstVisited, visits, ...s };
  });
}

export async function getVisited(): Promise<Visited> {
  const [{ updatedAt }, all] = await Promise.all([getPhotos(), getAdminPrefectures()]);
  return {
    updatedAt,
    prefectures: all
      .filter((p) => p.visited)
      .map((p) => ({
        id: p.id,
        hasEvidence: p.evidenceAssetId !== null,
        // An excluded prefecture is usually home; don't publish when you first went there.
        firstVisited: p.excludeVisits ? null : p.firstVisited,
        visitCount: p.visits?.length ?? null,
      })),
  };
}

export async function getEvidenceAssetId(id: number): Promise<string | undefined> {
  const p = (await getAdminPrefectures()).find((p) => p.id === id);
  return (p?.visited && p.evidenceAssetId) || undefined;
}
