// StreamElements custom widget — animated card with visualizer.
// The visualizer animates while music plays and freezes when paused.

let FD = {};
let SE_RELAY = "wss://music.noblenestel.giize.com";
let SE_CHANNEL = "default";

const LOGOS = {
  "Spotify":
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#1DB954"/><path fill="#000" d="M17.5 17.3c-.2.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.84-.18-.96-.6-.12-.42.18-.84.6-.96 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.14zm1.44-3.3c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14C9.6 9.9 15 10.56 18.72 12.84c.36.18.48.78.22 1.16zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z"/></svg>',
  "Apple Music":
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#FA243C"/><path fill="#fff" d="M16 6.5l-6 1.3v6.4c-.3-.1-.7-.2-1.1-.1-1 .1-1.8.9-1.7 1.8.1.9 1 1.4 2 1.3 1-.1 1.8-.8 1.8-1.8V10l4.4-1v3.6c-.3-.1-.7-.2-1.1-.1-1 .1-1.8.9-1.7 1.8.1.9 1 1.4 2 1.3 1-.1 1.7-.8 1.7-1.8V6.5z"/></svg>',
  "YouTube Music":
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#FF0000"/><circle cx="12" cy="12" r="7" fill="none" stroke="#fff" stroke-width="1.4"/><path fill="#fff" d="M10 8.7l5 3.3-5 3.3z"/></svg>',
  "Music":
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#888"/><path fill="#fff" d="M15 7l-6 1.4V15c-.3-.1-.7-.2-1.1-.1-1 .1-1.7.8-1.6 1.7.1.9.9 1.3 1.9 1.2s1.7-.8 1.7-1.7v-5.3l4-1V14c-.3-.1-.7-.2-1.1-.1-1 .1-1.7.8-1.6 1.7.1.9.9 1.3 1.9 1.2s1.7-.8 1.7-1.7V7z"/></svg>',
};

window.addEventListener("onWidgetLoad", function (obj) {
  FD = (obj.detail && obj.detail.fieldData) || {};
  SE_RELAY = FD.relayUrl || SE_RELAY;
  SE_CHANNEL = FD.channel || SE_CHANNEL;
  applyStyles();
  start();
});

function setVar(name, val) {
  if (val !== undefined && val !== null && val !== "") {
    document.getElementById("card").style.setProperty(name, val);
  }
}

function applyStyles() {
  const card = document.getElementById("card");
  if (FD.font) card.style.fontFamily = '"' + FD.font + '", sans-serif';

  setVar("--width", (FD.cardWidth || 360) + "px");
  setVar("--radius", (FD.cornerRadius || 28) + "px");
  setVar("--artHeight", (FD.albumHeight || 470) + "px");
  setVar("--cardBg", FD.cardBg);
  setVar("--panelBg", FD.panelBg);
  setVar("--border", FD.borderColor);
  setVar("--glow", FD.glowColor);
  setVar("--accent", FD.accentColor);
  setVar("--track", FD.titleColor);
  setVar("--sub", FD.artistColor);
  setVar("--time", FD.timeColor);
  setVar("--progressTrack", FD.progressTrackColor);
  setVar("--titleSize", (FD.titleSize || 21) + "px");
  setVar("--artistSize", (FD.artistSize || 15) + "px");

  // Toggles
  if (FD.showVisualizer === "no") document.getElementById("vizwrap").style.display = "none";
  if (FD.showTimes === "no") {
    document.getElementById("cur").style.display = "none";
    document.getElementById("dur").style.display = "none";
  }
  if (FD.showLogo === "no") document.getElementById("logo").style.display = "none";
  if (FD.showPlayButton === "no") document.getElementById("playbtn").style.display = "none";
  if (FD.showProgress === "no") document.getElementById("progress").style.display = "none";
  if (FD.showTotalBadge === "no") document.getElementById("totalBadge").style.display = "none";
}

function start() {
  const els = {
    card: document.getElementById("card"),
    cover: document.getElementById("cover"),
    track: document.getElementById("track"),
    artist: document.getElementById("artist"),
    fill: document.getElementById("fill"),
    knob: document.getElementById("knob"),
    cur: document.getElementById("cur"),
    dur: document.getElementById("dur"),
    badge: document.getElementById("totalBadge"),
    logo: document.getElementById("logo"),
    iconPlay: document.getElementById("iconPlay"),
    iconPause: document.getElementById("iconPause"),
  };

  const HIDE_PAUSED = FD.hideWhenPaused === "yes";
  const fmt = (ms) => {
    if (!ms || ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };

  let state = {
    positionMs: 0, durationMs: 0, isPlaying: false,
    lastSyncWall: Date.now(), track: "", artist: "", cover: "", source: "",
  };

  function applyData(d) {
    state.track = d.track;
    state.artist = d.artist;
    state.durationMs = d.durationMs || 0;
    state.positionMs = d.positionMs || 0;
    state.isPlaying = !!d.isPlaying;
    state.lastSyncWall = Date.now();

    if (d.cover !== state.cover) {
      state.cover = d.cover;
      if (d.cover) els.cover.src = d.cover;
    }
    if (d.source !== state.source) {
      state.source = d.source;
      els.logo.innerHTML = LOGOS[d.source] || LOGOS["Music"];
    }
    els.track.textContent = d.track || "";
    els.artist.textContent = d.artist || "";
    els.iconPlay.style.display = state.isPlaying ? "none" : "block";
    els.iconPause.style.display = state.isPlaying ? "block" : "none";

    const visible = d.track && (state.isPlaying || !HIDE_PAUSED);
    els.card.classList.toggle("show", !!visible);
  }

  // ---- Visualizer ----------------------------------------------------------
  const canvas = document.getElementById("viz");
  const ctx = canvas.getContext("2d");
  const BARS = Math.max(8, Math.min(96, parseInt(FD.visualizerBars, 10) || 48));
  const VIZ_COLOR = FD.visualizerColor || "#e7b54a";
  const levels = new Array(BARS).fill(0.1);
  const targets = new Array(BARS).fill(0.1);
  let lastTargetUpdate = 0;

  // ---- Real audio feed (optional) -----------------------------------------
  // If an audio WebSocket is provided, use live FFT data for the bars.
  const AUDIO_URL = FD.audioWsUrl || "";
  const AUDIO_GAIN = parseFloat(FD.audioGain) || 1.4;
  let audioBands = [];   // resampled to BARS, normalized 0..1
  let lastAudioMsg = 0;

  // Resample an arbitrary-length array down/up to `n` bins by averaging.
  function resample(src, n) {
    if (!src || !src.length) return [];
    if (src.length === n) return src.slice();
    const out = new Array(n);
    const ratio = src.length / n;
    for (let i = 0; i < n; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.max(start + 1, Math.floor((i + 1) * ratio));
      let sum = 0, c = 0;
      for (let j = start; j < end && j < src.length; j++) { sum += src[j]; c++; }
      out[i] = c ? sum / c : 0;
    }
    return out;
  }

  // Turn an incoming message into a numeric array of band magnitudes.
  function parseAudio(data) {
    // Binary (e.g., AnalyserNode.getByteFrequencyData -> Uint8 0..255).
    if (data instanceof ArrayBuffer) return Array.from(new Uint8Array(data));
    if (typeof data === "string") {
      const s = data.trim();
      if (s[0] === "[" || s[0] === "{") {
        try {
          const j = JSON.parse(s);
          if (Array.isArray(j)) return j;
          return j.fft || j.data || j.levels || j.bars || j.magnitudes || [];
        } catch (_) { return []; }
      }
      // Comma/space separated numbers.
      return s.split(/[,\s]+/).map(Number).filter((x) => !isNaN(x));
    }
    return [];
  }

  function connectAudio() {
    if (!AUDIO_URL) return;
    let aws;
    try { aws = new WebSocket(AUDIO_URL); } catch (e) { setTimeout(connectAudio, 3000); return; }
    aws.binaryType = "arraybuffer";
    aws.onmessage = (ev) => {
      const arr = parseAudio(ev.data);
      if (!arr.length) return;
      // Auto-detect range: byte data (0..255) vs normalized (0..1).
      const max = Math.max.apply(null, arr);
      const norm = max > 2 ? arr.map((v) => v / 255) : arr;
      audioBands = resample(norm, BARS);
      lastAudioMsg = performance.now();
    };
    aws.onclose = () => setTimeout(connectAudio, 3000);
    aws.onerror = () => { try { aws.close(); } catch (_) {} };
  }
  connectAudio();

  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 46;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawViz(now) {
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 46;
    ctx.clearRect(0, 0, w, h);

    const audioFresh = AUDIO_URL && audioBands.length && (performance.now() - lastAudioMsg < 500);

    if (audioFresh) {
      // Live audio drives the targets directly (responsive).
      for (let i = 0; i < BARS; i++) {
        targets[i] = Math.min(1, (audioBands[i] || 0) * AUDIO_GAIN);
      }
    } else if (now - lastTargetUpdate > 110) {
      // Fallback: animated equalizer (no live audio).
      lastTargetUpdate = now;
      for (let i = 0; i < BARS; i++) {
        if (state.isPlaying) {
          const center = 1 - Math.abs(i - BARS / 2) / (BARS / 2);
          targets[i] = 0.15 + Math.random() * (0.5 + center * 0.5);
        } else {
          targets[i] = 0.06;
        }
      }
    }

    const ease = audioFresh ? 0.4 : 0.18;
    const gap = 2;
    const barW = (w - gap * (BARS - 1)) / BARS;
    ctx.fillStyle = VIZ_COLOR;
    for (let i = 0; i < BARS; i++) {
      levels[i] += (targets[i] - levels[i]) * ease;
      const bh = Math.max(2, levels[i] * h);
      const x = i * (barW + gap);
      const y = h - bh;
      const r = Math.min(barW / 2, 2);
      roundRect(ctx, x, y, barW, bh, r);
    }
    requestAnimationFrame(drawViz);
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
    c.fill();
  }

  sizeCanvas();
  window.addEventListener("resize", sizeCanvas);
  requestAnimationFrame(drawViz);

  // ---- Progress / time render ---------------------------------------------
  function render() {
    let pos = state.positionMs;
    if (state.isPlaying) pos += Date.now() - state.lastSyncWall;
    if (state.durationMs) pos = Math.min(pos, state.durationMs);

    const pct = state.durationMs ? (pos / state.durationMs) * 100 : 0;
    els.fill.style.width = pct + "%";
    els.knob.style.left = pct + "%";
    els.cur.textContent = fmt(pos);
    els.dur.textContent = fmt(state.durationMs);
    els.badge.textContent = fmt(state.durationMs);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // ---- Relay connection ----------------------------------------------------
  let ws = null;
  function connect() {
    try { ws = new WebSocket(SE_RELAY); }
    catch (e) { setTimeout(connect, 3000); return; }
    ws.onopen = () => ws.send(JSON.stringify({ role: "subscriber", channel: SE_CHANNEL }));
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch (_) { return; }
      if (msg.type === "nowplaying" && msg.data) applyData(msg.data);
    };
    ws.onclose = () => setTimeout(connect, 3000);
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  }
  connect();
}
