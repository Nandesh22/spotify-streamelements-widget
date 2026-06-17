// widget.js
// Connects to the relay, subscribes to the channel, and renders now-playing.
// Smoothly advances the progress bar between updates using local interpolation.

(function () {
  "use strict";

  // Settings can come from the URL (?relay=...&channel=...) so a single hosted
  // widget page works for every customer, or from window.WIDGET_CONFIG as a
  // fallback for local use.
  const params = new URLSearchParams(location.search);
  const cfg = window.WIDGET_CONFIG || {};
  const RELAY = params.get("relay") || cfg.relayUrl || "ws://localhost:8787";
  const CHANNEL = params.get("channel") || cfg.channel || "default";
  const HIDE_WHEN_PAUSED =
    params.get("hidePaused") === "0" ? false : cfg.hideWhenPaused !== false;

  const els = {
    card: document.getElementById("card"),
    cover: document.getElementById("cover"),
    track: document.getElementById("track"),
    artist: document.getElementById("artist"),
    fill: document.getElementById("fill"),
    pos: document.getElementById("pos"),
    dur: document.getElementById("dur"),
  };

  const fmt = (ms) => {
    if (!ms || ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ":" + String(r).padStart(2, "0");
  };

  // Local playback model so the bar moves smoothly between relay messages.
  let state = {
    positionMs: 0,
    durationMs: 0,
    isPlaying: false,
    lastSyncWall: Date.now(),
    track: "",
    artist: "",
    cover: "",
  };

  function applyData(d) {
    const trackChanged = d.track !== state.track || d.artist !== state.artist;

    state.track = d.track;
    state.artist = d.artist;
    state.durationMs = d.durationMs || 0;
    state.positionMs = d.positionMs || 0;
    state.isPlaying = !!d.isPlaying;
    state.lastSyncWall = Date.now();

    if (trackChanged || d.cover !== state.cover) {
      state.cover = d.cover;
      if (d.cover) els.cover.src = d.cover;
    }

    els.track.textContent = d.track || "";
    els.artist.textContent = d.artist || "";
    els.dur.textContent = fmt(state.durationMs);

    const visible = d.track && (state.isPlaying || !HIDE_WHEN_PAUSED);
    els.card.classList.toggle("show", !!visible);
  }

  function render() {
    let pos = state.positionMs;
    if (state.isPlaying) {
      pos += Date.now() - state.lastSyncWall;
    }
    if (state.durationMs) pos = Math.min(pos, state.durationMs);

    const pct = state.durationMs ? (pos / state.durationMs) * 100 : 0;
    els.fill.style.width = pct + "%";
    els.pos.textContent = fmt(pos);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // ----- WebSocket connection with auto-reconnect ---------------------------

  let ws = null;
  function connect() {
    try {
      ws = new WebSocket(RELAY);
    } catch (e) {
      setTimeout(connect, 3000);
      return;
    }

    ws.onopen = () => {
      ws.send(JSON.stringify({ role: "subscriber", channel: CHANNEL }));
    };
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch (_) {
        return;
      }
      if (msg.type === "nowplaying" && msg.data) applyData(msg.data);
    };
    ws.onclose = () => setTimeout(connect, 3000);
    ws.onerror = () => {
      try { ws.close(); } catch (_) {}
    };
  }
  connect();
})();
