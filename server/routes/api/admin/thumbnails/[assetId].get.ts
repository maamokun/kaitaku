import { defineHandler } from "nitro";
import { getRouterParam, HTTPError } from "nitro/h3";
import { fetchImage, parseAssetId } from "../../../../lib/immich";

export default defineHandler((event) => {
  const assetId = parseAssetId(getRouterParam(event, "assetId"));
  if (!assetId) throw new HTTPError({ status: 404 });
  return fetchImage(assetId, "thumbnail", "private, max-age=86400");
});
