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
    const isSpotify = location.hostname.includes("spotify");

    let track = "", artist = "", album = "", cover = "";
    let durationMs = 0, positionMs = 0, isPlaying = false;

    if (isSpotify) {
      // Spotify's mediaSession lags by a track on fast skips, so the live
      // now-playing bar in the DOM is the source of truth here.
      const dom = readSpotifyDOM();
      if (dom) {
        track = dom.track;
        artist = dom.artist;
        cover = dom.cover;
        durationMs = dom.durationMs;
        positionMs = dom.positionMs;
        isPlaying = dom.isPlaying;
      }
      if (!cover && md && md.artwork && md.artwork.length) {
        cover = md.artwork[md.artwork.length - 1].src || "";
      }
      // Only fall back to mediaSession if the DOM gave us nothing at all.
      if (!track && md && md.title) {
        track = md.title;
        artist = md.artist || "";
      }
    } else {
      // YouTube Music / Apple Music: mediaSession is accurate and timely.
      track = md && md.title ? md.title : "";
      artist = md && md.artist ? md.artist : "";
      album = md && md.album ? md.album : "";
      if (md && md.artwork && md.artwork.length) {
        cover = md.artwork[md.artwork.length - 1].src || md.artwork[0].src || "";
      }
      durationMs = media && isFinite(media.duration) ? media.duration * 1000 : 0;
      positionMs = media ? media.currentTime * 1000 : 0;
      isPlaying = media ? !media.paused : !!(ms && ms.playbackState === "playing");
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
  }, 600);
})();
