import { defineHandler } from "nitro";
import { getRouterParam, HTTPError, readBody } from "nitro/h3";
import type { PrefectureSettings } from "../../../../../shared/visited";
import { parseAssetId } from "../../../../lib/immich";
import { setSettings } from "../../../../lib/settings";
import { parsePrefectureId } from "../../../../lib/visited";

export default defineHandler(async (event) => {
  const id = parsePrefectureId(getRouterParam(event, "id"));
  if (id === undefined) throw new HTTPError({ status: 404 });

  const body = await readBody<Record<string, unknown>>(event);
  const override = body?.override;
  const evidenceAssetId =
    body?.evidenceAssetId === null ? null : parseAssetId(body?.evidenceAssetId);
  const excludeVisits = body?.excludeVisits;
  if (
    (override !== "on" && override !== "off" && override !== null) ||
    evidenceAssetId === undefined ||
    typeof excludeVisits !== "boolean"
  ) {
    throw new HTTPError({
      status: 400,
      message:
        "Expected { override: 'on' | 'off' | null, evidenceAssetId: uuid | null, excludeVisits: boolean }",
    });
  }

  const settings: PrefectureSettings = { override, evidenceAssetId, excludeVisits };
  await setSettings(id, settings);
  return settings;
});
