// content.js  (isolated world)
// Bridges messages from mediasession.js (MAIN world) to the background worker.
// MAIN-world scripts can't use chrome.* APIs, so this relays via runtime msgs.

(function () {
  "use strict";

  const log = (...a) => console.log("[MusicNP]", ...a);
  log("bridge loaded on", location.hostname);

  let lastSig = "";
  let beat = 0;

  window.addEventListener("message", function (ev) {
    if (ev.source !== window) return;
    const m = ev.data;
    if (!m || m.__musicnp !== true || !m.data) return;

    const d = m.data;
    const sig = [d.source, d.track, d.artist, d.isPlaying, d.durationMs].join("|");
    const changed = sig !== lastSig;

    // Send on change, plus a heartbeat every ~5s to resync position.
    if (changed || beat++ % 5 === 0) {
      lastSig = sig;
      if (changed) log("sending", d.source, "-", d.track, "-", d.artist, "playing:", d.isPlaying);
      chrome.runtime.sendMessage({ type: "nowplaying", data: d }).catch(() => {});
    }
  });
})();
