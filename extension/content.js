// content.js  (isolated world)
// Bridges messages from mediasession.js (MAIN world) to the background worker.
// MAIN-world scripts can't use chrome.* APIs, so this relays via runtime msgs.

(function () {
  "use strict";

  const log = (...a) => console.log("[MusicNP]", ...a);
  log("bridge loaded on", location.hostname);

  let lastSig = "";

  window.addEventListener("message", function (ev) {
    if (ev.source !== window) return;
    const m = ev.data;
    if (!m || m.__musicnp !== true || !m.data) return;

    const d = m.data;
    const sig = [d.source, d.track, d.artist, d.isPlaying, d.durationMs].join("|");
    if (sig !== lastSig) {
      lastSig = sig;
      log("now playing:", d.source, "-", d.track, "-", d.artist, "playing:", d.isPlaying, "dur:", d.durationMs);
    }
    // Send every tick (~1/s) so the widget always has fresh data and recovers
    // immediately if the background worker restarted.
    chrome.runtime.sendMessage({ type: "nowplaying", data: d }).catch(() => {});
  });
})();
