import { defineHandler } from "nitro";
import { getRouterParam, HTTPError } from "nitro/h3";
import { fetchImage } from "../../../lib/immich";
import { getEvidenceAssetId, parsePrefectureId } from "../../../lib/visited";

export default defineHandler(async (event) => {
  const id = parsePrefectureId(getRouterParam(event, "id"));
  const assetId = id === undefined ? undefined : await getEvidenceAssetId(id);
  if (!assetId) throw new HTTPError({ status: 404 });
  return fetchImage(assetId, "preview", "public, max-age=300");
});
