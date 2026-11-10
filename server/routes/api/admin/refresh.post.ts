import { defineHandler } from "nitro";
import { refreshPhotos } from "../../../lib/visited";

export default defineHandler(async () => {
  const { updatedAt } = await refreshPhotos();
  return { updatedAt };
});
