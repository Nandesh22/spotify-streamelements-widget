// mediasession.js  (runs in the page's MAIN world)
// Primary: navigator.mediaSession (works for YouTube Music, Apple Music).
// Fallback: Spotify's web player often leaves mediaSession empty, so we scrape
// its now-playing DOM (and page title) directly.
// Posts data to the isolated content script via window.postMessage.

(function () {
  "use strict";

  function serviceName() {
    const h = location.hostname;
    if (h.includes("spotify")) return "Spotify";
    if (h.includes("music.apple")) return "Apple Music";
    if (h.includes("music.youtube")) return "YouTube Music";
    return "Music";
  }

  function pick(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function timeToMs(text) {
    if (!text) return 0;
    const parts = text.trim().split(":").map((n) => parseInt(n, 10));
    if (parts.some(isNaN)) return 0;
    let s = 0;
    for (const p of parts) s = s * 60 + p;
    return s * 1000;
  }

  function findMedia() {
    const els = Array.from(document.querySelectorAll("audio, video"));
    let best = null;
    for (const e of els) {
      if (!isFinite(e.duration) || e.duration <= 0) continue;
      if (!best) best = e;
      if (!e.paused) { best = e; break; }
    }
    return best;
  }

  // Spotify-specific DOM scrape (used when mediaSession is empty).
  function readSpotifyDOM() {
    const trackEl = pick([
      '[data-testid="context-item-link"]',
      '[data-testid="now-playing-widget"] a[href*="/track/"]',
      'a[data-testid="context-item-link"]',
    ]);
    let track = trackEl ? trackEl.textContent.trim() : "";

    if (!track) {
      const t = document.title || "";
      const sep = t.includes("•") ? "•" : t.includes("·") ? "·" : null;
      if (sep) track = t.split(sep)[0].trim();
    }
    if (!track) return null;

    let artist = "";
    const al = document.querySelectorAll(
      '[data-testid="now-playing-widget"] a[href*="/artist/"], footer a[href*="/artist/"]'
    );
    if (al.length) {
      artist = Array.from(al).map((a) => a.textContent.trim()).filter(Boolean).join(", ");
    }

    const coverEl = pick([
      '[data-testid="cover-art-image"]',
      '[data-testid="now-playing-widget"] img',
      'footer img',
      'aside img',
    ]);
    const posEl = pick(['[data-testid="playback-position"]']);
    const durEl = pick(['[data-testid="playback-duration"]']);
    const pp = pick(['[data-testid="control-button-playpause"]']);

    let isPlaying = false;
    if (pp) {
      const label = (pp.getAttribute("aria-label") || "").toLowerCase();
      isPlaying = label.includes("pause");
    }

    return {
      track,
      artist,
      cover: coverEl ? coverEl.src : "",
      durationMs: timeToMs(durEl ? durEl.textContent : ""),
      positionMs: timeToMs(posEl ? posEl.textContent : ""),
      isPlaying,
    };
  }

  function read() {
    const ms = navigator.mediaSession;
    const md = ms && ms.metadata;
    const media = findMedia();

    let track = md && md.title ? md.title : "";
    let artist = md && md.artist ? md.artist : "";
    let album = md && md.album ? md.album : "";
    let cover = "";
    if (md && md.artwork && md.artwork.length) {
      cover = md.artwork[md.artwork.length - 1].src || md.artwork[0].src || "";
    }
    let durationMs = media && isFinite(media.duration) ? media.duration * 1000 : 0;
    let positionMs = media ? media.currentTime * 1000 : 0;
    let isPlaying = media ? !media.paused : !!(ms && ms.playbackState === "playing");

    // Spotify fallback: fill anything mediaSession didn't provide.
    if (location.hostname.includes("spotify") && (!track || !durationMs)) {
      const dom = readSpotifyDOM();
      if (dom) {
        if (!track) track = dom.track;
        if (!artist) artist = dom.artist;
        if (!cover) cover = dom.cover;
        if (!durationMs) durationMs = dom.durationMs;
        if (!positionMs) positionMs = dom.positionMs;
        if (!media) isPlaying = dom.isPlaying;
      }
    }

    if (!track) return null;

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
    try { data = read(); } catch (e) { return; }
    if (data) window.postMessage({ __musicnp: true, data: data }, "*");
  }, 1000);
})();
