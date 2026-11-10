export type TakenAt = { utcMs: number; localDate: string };

export type PhotoLocation = {
  assetId: string;
  point: [lon: number, lat: number];
  takenAt: TakenAt | undefined;
};

const ASSET_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseAssetId(value: unknown): string | undefined {
  return typeof value === "string" && ASSET_ID.test(value) ? value : undefined;
}

function immich(path: string) {
  const { IMMICH_URL, IMMICH_API_KEY } = process.env;
  if (!IMMICH_URL || !IMMICH_API_KEY) throw new Error("IMMICH_URL and IMMICH_API_KEY must be set");
  const base = IMMICH_URL.replace(/\/+$/, "").replace(/\/api$/, "");
  return fetch(`${base}/api${path}`, { headers: { "x-api-key": IMMICH_API_KEY } });
}

async function immichJson<T>(path: string): Promise<T> {
  const res = await immich(path);
  if (!res.ok) throw new Error(`Immich ${res.status} on ${path}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

type TimeBucket = { id: string[]; fileCreatedAt: string[]; localOffsetHours: number[] };

// Map markers carry no dates, so join them with the timeline, which has dates but no coordinates.
async function fetchTakenAt(): Promise<Map<string, TakenAt>> {
  const buckets = await immichJson<{ timeBucket: string }[]>("/timeline/buckets");
  const columns = await Promise.all(
    buckets.map((b) =>
      immichJson<TimeBucket>(`/timeline/bucket?timeBucket=${encodeURIComponent(b.timeBucket)}`),
    ),
  );
  const takenAt = new Map<string, TakenAt>();
  for (const { id, fileCreatedAt, localOffsetHours } of columns) {
    id.forEach((assetId, i) => {
      const utcMs = Date.parse(`${fileCreatedAt[i]}Z`);
      const localDate = new Date(utcMs + localOffsetHours[i] * 3_600_000)
        .toISOString()
        .slice(0, 10);
      takenAt.set(assetId, { utcMs, localDate });
    });
  }
  return takenAt;
}

export async function fetchPhotoLocations(): Promise<PhotoLocation[]> {
  const [markers, takenAt] = await Promise.all([
    immichJson<{ id: string; lat: number; lon: number }[]>("/map/markers"),
    fetchTakenAt(),
  ]);
  return markers.map((m) => ({ assetId: m.id, point: [m.lon, m.lat], takenAt: takenAt.get(m.id) }));
}

// Immich previews are re-encoded without EXIF, so no GPS data leaks through.
export async function fetchImage(
  assetId: string,
  size: "thumbnail" | "preview",
  cacheControl: string,
): Promise<Response> {
  const res = await immich(`/assets/${assetId}/thumbnail?size=${size}`);
  if (!res.ok) return new Response(null, { status: res.status === 404 ? 404 : 502 });
  return new Response(res.body, {
    headers: {
      "content-type": res.headers.get("content-type") ?? "image/jpeg",
      "cache-control": cacheControl,
    },
  });
}
