export type Override = "on" | "off";

export type PrefectureSettings = {
  override: Override | null;
  evidenceAssetId: string | null;
  /** Leave this prefecture's photos out of the visit log, e.g. where you live. */
  excludeVisits: boolean;
};

/** Local calendar date (YYYY-MM-DD) of the oldest photo taken there; null when there are no dated photos. */
export type FirstVisited = string | null;

/** One trip: a run of consecutive local dates (YYYY-MM-DD) with photos in the prefecture. */
export type VisitPeriod = { start: string; end: string };

/** Oldest first; null when the prefecture is excluded from the visit log. */
export type Visits = VisitPeriod[] | null;

/** Public data: only the number of trips, never their dates. Excluded prefectures get null for both. */
export type Visited = {
  updatedAt: string;
  prefectures: { id: number; hasEvidence: boolean; firstVisited: FirstVisited; visitCount: number | null }[];
};

export type AdminPrefecture = PrefectureSettings & {
  id: number;
  photoCount: number;
  visited: boolean;
  firstVisited: FirstVisited;
  visits: Visits;
};
