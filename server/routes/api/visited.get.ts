import { defineHandler } from "nitro";
import { getVisited } from "../../lib/visited";

export default defineHandler(() => getVisited());
