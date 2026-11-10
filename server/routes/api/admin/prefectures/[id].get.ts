import { defineHandler } from "nitro";
import { getRouterParam, HTTPError } from "nitro/h3";
import { getPhotos, parsePrefectureId } from "../../../../lib/visited";

export default defineHandler(async (event) => {
  const id = parsePrefectureId(getRouterParam(event, "id"));
  if (id === undefined) throw new HTTPError({ status: 404 });
  const { byPrefecture } = await getPhotos();
  return { assetIds: byPrefecture.get(id)?.assetIds ?? [] };
});
