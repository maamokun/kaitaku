import { defineHandler } from "nitro";
import { getAdminPrefectures } from "../../../lib/visited";

export default defineHandler(() => getAdminPrefectures());
