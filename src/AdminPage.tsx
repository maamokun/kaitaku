import { useState } from "react";
import useSWR from "swr";
import type { AdminPrefecture, Override, PrefectureSettings, Visited } from "../shared/visited";
import { formatFirstVisited, formatVisitCount } from "./format";
import { prefectureName } from "./prefectures";

const ASSET_ID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const thumbnail = (assetId: string) => `/api/admin/thumbnails/${assetId}`;

export default function AdminPage() {
  const { data, error, mutate } = useSWR<AdminPrefecture[]>("/api/admin/prefectures");
  const { data: visited, mutate: mutateVisited } = useSWR<Visited>("/api/visited");
  const [picking, setPicking] = useState<AdminPrefecture>();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string>();

  async function refresh() {
    setRefreshing(true);
    setRefreshError(undefined);
    try {
      const res = await fetch("/api/admin/refresh", { method: "POST" });
      if (!res.ok) throw new Error(`Refreshing failed: ${res.status}`);
      await Promise.all([mutate(), mutateVisited()]);
    } catch (e) {
      setRefreshError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }

  async function save(p: AdminPrefecture, change: Partial<PrefectureSettings>) {
    const settings: PrefectureSettings = {
      override: p.override,
      evidenceAssetId: p.evidenceAssetId,
      excludeVisits: p.excludeVisits,
      ...change,
    };
    const res = await fetch(`/api/admin/prefectures/${p.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error(`Saving ${prefectureName(p.id)} failed: ${res.status}`);
    await mutate();
  }

  if (error) return <p className="p-4 text-error">Could not load prefectures.</p>;
  if (!data) return <p className="p-4">Loading…</p>;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <div className="flex items-center gap-3">
          {refreshError ? (
            <span className="text-sm text-error">{refreshError}</span>
          ) : (
            visited && (
              <span className="text-sm text-base-content/60">
                Updated{" "}
                <time dateTime={visited.updatedAt}>
                  {new Date(visited.updatedAt).toLocaleString()}
                </time>
              </span>
            )
          )}
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={refreshing}
            onClick={refresh}
          >
            {refreshing && <span className="loading loading-spinner loading-xs" />}
            Refresh data
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Prefecture</th>
              <th>Photos</th>
              <th>First visited</th>
              <th>Visits</th>
              <th>Override</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className={p.visited ? "" : "opacity-60"}>
                <td>
                  <span
                    className={`badge badge-xs mr-2 ${p.visited ? "badge-primary" : "badge-ghost"}`}
                  />
                  {prefectureName(p.id)}
                </td>
                <td>{p.photoCount}</td>
                <td>{formatFirstVisited(p.firstVisited)}</td>
                <td className="whitespace-nowrap">
                  <div>{p.visits ? formatVisitCount(p.visits.length) : "Excluded"}</div>
                  <label className="label text-xs">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
                      checked={p.excludeVisits}
                      onChange={(e) => save(p, { excludeVisits: e.target.checked })}
                    />
                    Exclude
                  </label>
                </td>
                <td>
                  <select
                    className="select select-sm w-28"
                    value={p.override ?? "auto"}
                    onChange={(e) =>
                      save(p, {
                        override: e.target.value === "auto" ? null : (e.target.value as Override),
                      })
                    }
                  >
                    <option value="auto">Auto</option>
                    <option value="on">On</option>
                    <option value="off">Off</option>
                  </select>
                </td>
                <td className="flex items-center gap-2">
                  {p.evidenceAssetId && (
                    <img
                      src={thumbnail(p.evidenceAssetId)}
                      alt=""
                      className="size-12 rounded object-cover"
                    />
                  )}
                  <button type="button" className="btn btn-sm" onClick={() => setPicking(p)}>
                    {p.evidenceAssetId ? "Change" : "Choose"}
                  </button>
                  {p.evidenceAssetId && (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => save(p, { evidenceAssetId: null })}
                    >
                      Clear
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {picking && (
        <EvidencePicker
          prefecture={picking}
          onPick={async (assetId) => {
            await save(picking, { evidenceAssetId: assetId });
            setPicking(undefined);
          }}
          onClose={() => setPicking(undefined)}
        />
      )}
    </main>
  );
}

function EvidencePicker({
  prefecture,
  onPick,
  onClose,
}: {
  prefecture: AdminPrefecture;
  onPick: (assetId: string) => void;
  onClose: () => void;
}) {
  const { data } = useSWR<{ assetIds: string[] }>(`/api/admin/prefectures/${prefecture.id}`);
  const [pasted, setPasted] = useState("");
  const pastedId = pasted.match(ASSET_ID)?.[0];

  return (
    <dialog className="modal" open>
      <div className="modal-box flex max-w-4xl flex-col gap-4">
        <h2 className="text-lg font-bold">Evidence for {prefectureName(prefecture.id)}</h2>
        <form
          className="join"
          onSubmit={(e) => {
            e.preventDefault();
            if (pastedId) onPick(pastedId);
          }}
        >
          <input
            className="input join-item w-full"
            placeholder="Paste an Immich photo URL or asset ID"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <button type="submit" className="btn join-item" disabled={!pastedId}>
            Use
          </button>
        </form>
        {!data ? (
          <p>Loading photos…</p>
        ) : data.assetIds.length === 0 ? (
          <p className="text-base-content/70">
            No photos were taken here. Paste a link to one above.
          </p>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-6">
            {data.assetIds.map((id) => (
              <button
                key={id}
                type="button"
                className={`aspect-square overflow-hidden rounded ${id === prefecture.evidenceAssetId ? "ring-4 ring-primary" : ""}`}
                onClick={() => onPick(id)}
              >
                <img src={thumbnail(id)} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="modal-action">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
      <button type="button" className="modal-backdrop" onClick={onClose} aria-label="Close" />
    </dialog>
  );
}
