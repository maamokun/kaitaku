import { defineTask } from "nitro/task";
import { refreshPhotos } from "../../lib/visited";

export default defineTask({
  meta: { description: "Recompute which prefectures each Immich photo was taken in" },
  async run() {
    const { byPrefecture } = await refreshPhotos();
    return { result: `photos found in ${byPrefecture.size}/47 prefectures` };
  },
});
