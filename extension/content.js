// content.js
// Runs inside open.spotify.com. Scrapes the now-playing bar from the DOM
// (with a document.title fallback) and forwards it to the background service
// worker, which relays it onward.

(function () {
  "use strict";

  const log = (...a) => console.log("[SpotifyNP]", ...a);
  log("content script loaded on", location.href);

  const pick = (selectors) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  };

  const timeToMs = (text) => {
    if (!text) return 0;
    const parts = text.trim().split(":").map((n) => parseInt(n, 10));
    if (parts.some(isNaN)) return 0;
    let s = 0;
    for (const p of parts) s = s * 60 + p;
    return s * 1000;
  };

  // Fallback: Spotify sets the page title to "Track • Artist" while playing.
  function readFromTitle() {
    const t = document.title || "";
    if (!t || /^spotify/i.test(t) && !t.includes("•") && !t.includes("·")) return null;
    const sep = t.includes("•") ? "•" : t.includes("·") ? "·" : null;
    if (!sep) return null;
    const [track, artist] = t.split(sep).map((x) => x.trim());
    if (!track) return null;
    return { track, artist: artist || "" };
  }

  function readNowPlaying() {
    const widget = pick([
      '[data-testid="now-playing-widget"]',
      'footer [data-testid="now-playing-bar"]',
      'aside[aria-label] [data-testid="now-playing-widget"]',
      'footer',
    ]);

    const trackEl = pick([
      '[data-testid="context-item-link"]',
      '[data-testid="now-playing-widget"] a[href*="/track/"]',
      'a[data-testid="context-item-link"]',
    ]);

    let artist = "";
    const artistLinks = document.querySelectorAll(
      '[data-testid="now-playing-widget"] a[href*="/artist/"], footer a[href*="/artist/"]'
    );
    if (artistLinks.length) {
      artist = Array.from(artistLinks)
        .map((a) => a.textContent.trim())
        .filter(Boolean)
        .join(", ");
    }

    const coverImg = pick([
      '[data-testid="cover-art-image"]',
      '[data-testid="now-playing-widget"] img',
      'footer img',
      'aside img',
    ]);

    const positionEl = pick(['[data-testid="playback-position"]']);
    const durationEl = pick(['[data-testid="playback-duration"]']);
    const playPauseBtn = pick(['[data-testid="control-button-playpause"]']);

    let isPlaying = false;
    if (playPauseBtn) {
      const label = (playPauseBtn.getAttribute("aria-label") || "").toLowerCase();
      isPlaying = label.includes("pause");
    }

    let track = trackEl ? trackEl.textContent.trim() : "";

    // Fallback to the page title if the DOM scrape failed.
    if (!track) {
      const fromTitle = readFromTitle();
      if (fromTitle) {
        track = fromTitle.track;
        if (!artist) artist = fromTitle.artist;
        // If the title shows a song, assume it is playing.
        if (!playPauseBtn) isPlaying = true;
      }
    }

    if (!track) return null;

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

  let last = "";
  let warnedOnce = false;

  function tick() {
    let data;
    try {
      data = readNowPlaying();
    } catch (e) {
      log("scrape error", e);
      return;
    }

    if (!data) {
      if (!warnedOnce) {
        log("No track found yet. Make sure a song is playing in this tab.");
        warnedOnce = true;
      }
      return;
    }
    warnedOnce = false;

    const sig = [data.track, data.artist, data.isPlaying, data.durationMs].join("|");
    const changed = sig !== last;

    if (changed || tick._beat++ % 5 === 0) {
      last = sig;
      log("sending", data.track, "-", data.artist, "playing:", data.isPlaying);
      chrome.runtime.sendMessage({ type: "nowplaying", data }).catch((e) => {
        log("sendMessage failed", e);
      });
    }
  }
  tick._beat = 0;

  setInterval(tick, 1000);
  tick();
})();
