import { Howl } from "howler";

const tapBeep = new Howl({ src: ["https://cdn.mikn.dev/web/kaitaku/tapbeep.mp3"] });

export function playTapBeep() {
  tapBeep.play();
}
