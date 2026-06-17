// content.js
// Runs inside open.spotify.com. Scrapes the now-playing bar from the DOM
// and forwards it to the background service worker, which relays it onward.

(function () {
  "use strict";

  // ----- Helpers -------------------------------------------------------------

  const pick = (selectors) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  };

  // Convert "m:ss" or "h:mm:ss" to milliseconds.
  const timeToMs = (text) => {
    if (!text) return 0;
    const parts = text.trim().split(":").map((n) => parseInt(n, 10));
    if (parts.some(isNaN)) return 0;
    let s = 0;
    for (const p of parts) s = s * 60 + p;
    return s * 1000;
  };

  // ----- DOM scraping --------------------------------------------------------

  function readNowPlaying() {
    // The now-playing bar lives at the bottom-left of the web player.
    const widget = pick([
      '[data-testid="now-playing-widget"]',
      'footer [data-testid="now-playing-bar"]',
      'footer',
    ]);
    if (!widget) return null;

    const trackEl = pick([
      '[data-testid="context-item-link"]',
      '[data-testid="now-playing-widget"] a[href*="/track/"]',
    ]);

    const artistContainer = pick([
      '[data-testid="context-item-info-artist"]',
      '[data-testid="now-playing-widget"] a[href*="/artist/"]',
    ]);

    // Multiple artists may be present.
    let artist = "";
    const artistLinks = document.querySelectorAll(
      '[data-testid="now-playing-widget"] a[href*="/artist/"]'
    );
    if (artistLinks.length) {
      artist = Array.from(artistLinks)
        .map((a) => a.textContent.trim())
        .filter(Boolean)
        .join(", ");
    } else if (artistContainer) {
      artist = artistContainer.textContent.trim();
    }

    const coverImg = pick([
      '[data-testid="cover-art-image"]',
      '[data-testid="now-playing-widget"] img',
      'footer img',
    ]);

    const positionEl = pick(['[data-testid="playback-position"]']);
    const durationEl = pick(['[data-testid="playback-duration"]']);

    const playPauseBtn = pick([
      '[data-testid="control-button-playpause"]',
    ]);

    // aria-label is "Pause" when playing, "Play" when paused.
    let isPlaying = false;
    if (playPauseBtn) {
      const label = (playPauseBtn.getAttribute("aria-label") || "").toLowerCase();
      isPlaying = label.includes("pause");
    }

    const track = trackEl ? trackEl.textContent.trim() : "";
    if (!track) return null; // nothing meaningful playing yet

    const positionMs = timeToMs(positionEl ? positionEl.textContent : "");
    const durationMs = timeToMs(durationEl ? durationEl.textContent : "");

    return {
      track,
      artist,
      cover: coverImg ? coverImg.src : "",
      positionMs,
      durationMs,
      progress: durationMs ? Math.min(100, (positionMs / durationMs) * 100) : 0,
      isPlaying,
      ts: Date.now(),
    };
  }

  // ----- Change detection + push --------------------------------------------

  let last = "";

  function tick() {
    let data;
    try {
      data = readNowPlaying();
    } catch (e) {
      return;
    }
    if (!data) return;

    // Only send when something meaningful changed (ignore the constantly
    // ticking position to avoid spamming; position is re-derived in widget).
    const sig = [data.track, data.artist, data.isPlaying, data.durationMs].join("|");
    const changed = sig !== last;

    // Send on change, otherwise send a lightweight heartbeat every ~5s so the
    // widget can resync position.
    if (changed || tick._beat++ % 5 === 0) {
      last = sig;
      chrome.runtime.sendMessage({ type: "nowplaying", data }).catch(() => {});
    }
  }
  tick._beat = 0;

  setInterval(tick, 1000);
  tick();
})();
