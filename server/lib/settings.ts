import { useKV } from "nitro/kv";
import type { PrefectureSettings } from "../../shared/visited";

// Rows saved before a field existed lack it; readers merge DEFAULT_SETTINGS over them.
type AllSettings = Record<number, Partial<PrefectureSettings>>;

const KEY = "prefecture-settings";
const kv = () => useKV("data");

export const DEFAULT_SETTINGS: PrefectureSettings = {
  override: null,
  evidenceAssetId: null,
  excludeVisits: false,
};

export async function getAllSettings(): Promise<AllSettings> {
  return (await kv().getItem<AllSettings>(KEY)) ?? {};
}

export async function setSettings(id: number, settings: PrefectureSettings): Promise<void> {
  const all = await getAllSettings();
  all[id] = settings;
  await kv().setItem(KEY, all);
}
