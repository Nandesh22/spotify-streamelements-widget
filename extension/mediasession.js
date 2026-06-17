// mediasession.js  (runs in the page's MAIN world)
// Works across Spotify, Apple Music, and YouTube Music by reading the standard
// navigator.mediaSession metadata plus the active <audio>/<video> element.
// It cannot use chrome.* APIs (MAIN world), so it posts data to the isolated
// content script via window.postMessage.

(function () {
  "use strict";

  function serviceName() {
    const h = location.hostname;
    if (h.includes("spotify")) return "Spotify";
    if (h.includes("music.apple")) return "Apple Music";
    if (h.includes("music.youtube")) return "YouTube Music";
    return "Music";
  }

  // Pick the most relevant media element: prefer one that is playing and has a
  // real duration; fall back to any with a duration.
  function findMedia() {
    const els = Array.from(document.querySelectorAll("audio, video"));
    let best = null;
    for (const e of els) {
      if (!isFinite(e.duration) || e.duration <= 0) continue;
      if (!best) best = e;
      if (!e.paused) {
        best = e;
        break;
      }
    }
    return best;
  }

  function read() {
    const ms = navigator.mediaSession;
    const md = ms && ms.metadata;
    const media = findMedia();

    const track = md && md.title ? md.title : "";
    if (!track) return null; // nothing meaningful playing

    const artist = md && md.artist ? md.artist : "";
    const album = md && md.album ? md.album : "";

    let cover = "";
    if (md && md.artwork && md.artwork.length) {
      // Use the largest artwork available.
      cover = md.artwork[md.artwork.length - 1].src || md.artwork[0].src || "";
    }

    const durationMs = media && isFinite(media.duration) ? media.duration * 1000 : 0;
    const positionMs = media ? media.currentTime * 1000 : 0;

    let isPlaying;
    if (media) isPlaying = !media.paused;
    else isPlaying = ms && ms.playbackState === "playing";

    return {
      source: serviceName(),
      track,
      artist,
      album,
      cover,
      durationMs,
      positionMs,
      progress: durationMs ? Math.min(100, (positionMs / durationMs) * 100) : 0,
      isPlaying: !!isPlaying,
      ts: Date.now(),
    };
  }

  setInterval(function () {
    let data;
    try {
      data = read();
    } catch (e) {
      return;
    }
    if (data) window.postMessage({ __musicnp: true, data: data }, "*");
  }, 1000);
})();
