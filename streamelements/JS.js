// StreamElements custom widget — animated card with REAL audio visualizer.
//
// Visualizer sources (in priority order):
//   1. OBS WebSocket (ws://127.0.0.1:<port>) InputVolumeMeters  -> real, zero-latency
//   2. Custom audio WebSocket (FFT/levels feed)
//   3. Animated equalizer (fallback, no audio source)
//
// The localhost connection works because OBS's Browser Source (CEF) exempts
// loopback addresses from mixed-content blocking.

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

// ---- OBS WebSocket v5 auth helpers -----------------------------------------
async function sha256b64(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
async function buildAuth(password, salt, challenge) {
  const secret = await sha256b64(password + salt);
  return await sha256b64(secret + challenge);
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
    try {
      const now = Date.now();
      const trackChanged = d.track !== state.track || d.source !== state.source;

      // Current smoothly-interpolated position from the existing clock.
      let interp = state.positionMs + (state.isPlaying ? now - state.lastSyncWall : 0);
      if (state.durationMs) interp = Math.min(interp, state.durationMs);

      const incoming = d.positionMs || 0;
      state.durationMs = d.durationMs || 0;

      if (trackChanged) {
        // New song: trust the incoming position.
        state.positionMs = incoming;
      } else if (Math.abs(incoming - interp) > 2500) {
        // Big jump = a real seek; resync to it.
        state.positionMs = incoming;
      } else {
        // Small ±1s noise from low-resolution sources: keep the smooth clock
        // so the timestamp never stutters backward.
        state.positionMs = interp;
      }
      state.lastSyncWall = now;
      state.isPlaying = !!d.isPlaying;

      if (d.cover !== state.cover) {
        state.cover = d.cover;
        if (d.cover) {
          els.cover.src = d.cover;
          if (AUTO_COLOR || PANEL_GLASS) sampleColors(d.cover);
        } else {
          els.cover.removeAttribute("src");
        }
      }
      if (d.source !== state.source) {
        state.source = d.source;
        els.logo.innerHTML = LOGOS[d.source] || LOGOS["Music"];
      }
      state.track = d.track;
      state.artist = d.artist;
      els.track.textContent = d.track || "";
      els.artist.textContent = d.artist || "";
      els.iconPlay.style.display = state.isPlaying ? "none" : "block";
      els.iconPause.style.display = state.isPlaying ? "block" : "none";
      const visible = d.track && (state.isPlaying || !HIDE_PAUSED);
      els.card.classList.toggle("show", !!visible);
    } catch (e) {
      /* never let a bad payload break the widget */
    }
  }

  // If album art fails to load, don't leave a broken white box.
  els.cover.onerror = function () { els.cover.removeAttribute("src"); };

  // ---- Visualizer ----------------------------------------------------------
  const canvas = document.getElementById("viz");
  const ctx = canvas.getContext("2d");
  const BARS = Math.max(8, Math.min(96, parseInt(FD.visualizerBars, 10) || 48));
  let vizColor = FD.visualizerColor || "#e7b54a";
  const AUDIO_GAIN = parseFloat(FD.audioGain) || 1.6;
  const AUTO_COLOR = FD.autoColor === "yes";
  const PANEL_GLASS = FD.panelGlass === "yes";

  // Pull the dominant/vibrant color from the album art and recolor the widget.
  function sampleColors(url) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      try {
        const n = 24, c = document.createElement("canvas");
        c.width = n; c.height = n;
        const cx = c.getContext("2d");
        cx.drawImage(img, 0, 0, n, n);
        const data = cx.getImageData(0, 0, n, n).data;
        let best = { score: -1, r: 231, g: 181, b: 74 };
        let ar = 0, ag = 0, ab = 0, cnt = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 128) continue;
          ar += r; ag += g; ab += b; cnt++;
          const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
          const sat = mx === 0 ? 0 : (mx - mn) / mx;
          const bright = mx / 255;
          const score = sat * 0.75 + bright * 0.25;
          if (bright > 0.18 && bright < 0.97 && score > best.score) best = { score, r, g, b };
        }
        if (!cnt) return;
        const avg = { r: Math.round(ar / cnt), g: Math.round(ag / cnt), b: Math.round(ab / cnt) };

        if (AUTO_COLOR) {
          const accent = "rgb(" + best.r + "," + best.g + "," + best.b + ")";
          setVar("--accent", accent);
          setVar("--border", accent);
          setVar("--glow", "rgba(" + best.r + "," + best.g + "," + best.b + ",0.55)");
          vizColor = accent;
        }
        if (PANEL_GLASS) {
          const g1 = "rgba(" + best.r + "," + best.g + "," + best.b + ",0.42)";
          const g2 = "rgba(" + avg.r + "," + avg.g + "," + avg.b + ",0.16)";
          setVar("--panelBg", "linear-gradient(135deg," + g1 + "," + g2 + "), rgba(20,18,16,0.92)");
          document.getElementById("panel").classList.add("glass");
        }
      } catch (e) {
        /* Album CDN didn't allow cross-origin reads; keep configured colors. */
      }
    };
    img.src = url;
  }

  const levels = new Array(BARS).fill(0.06);
  const targets = new Array(BARS).fill(0.06);
  const shape = new Array(BARS).fill(0.4); // per-bar spectrum shape (0..1)
  let lastShapeUpdate = 0;

  // Live audio state.
  let liveMode = "";          // "level" (OBS) | "bands" (custom WS)
  let liveLevel = 0;          // 0..1 overall amplitude (OBS)
  let audioBands = [];        // resampled bands (custom WS)
  let lastAudioMsg = 0;

  function resample(src, n) {
    if (!src || !src.length) return [];
    if (src.length === n) return src.slice();
    const out = new Array(n);
    const ratio = src.length / n;
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * ratio);
      const b = Math.max(a + 1, Math.floor((i + 1) * ratio));
      let s = 0, c = 0;
      for (let j = a; j < b && j < src.length; j++) { s += src[j]; c++; }
      out[i] = c ? s / c : 0;
    }
    return out;
  }

  function updateShape() {
    for (let i = 0; i < BARS; i++) {
      const center = 1 - Math.abs(i - BARS / 2) / (BARS / 2);
      shape[i] = 0.35 + Math.random() * 0.5 + center * 0.25;
    }
  }

  // ---- Source 1: OBS WebSocket ---------------------------------------------
  const OBS_PORT = (FD.obsPort || "4455").toString().replace(/\D/g, "") || "4455";
  const OBS_PASSWORD = FD.obsPassword || "";
  const OBS_SOURCE = (FD.obsSource || "").trim();
  const USE_OBS = FD.useObsAudio !== "no";

  function connectOBS() {
    let ws;
    try { ws = new WebSocket("ws://127.0.0.1:" + OBS_PORT); }
    catch (e) { setTimeout(connectOBS, 4000); return; }

    ws.onmessage = async (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch (_) { return; }

      if (m.op === 0) {
        const d = m.d || {};
        const identify = { op: 1, d: { rpcVersion: d.rpcVersion || 1, eventSubscriptions: (1 << 16) } };
        if (d.authentication) {
          identify.d.authentication = await buildAuth(OBS_PASSWORD, d.authentication.salt, d.authentication.challenge);
        }
        ws.send(JSON.stringify(identify));
      } else if (m.op === 5 && m.d && m.d.eventType === "InputVolumeMeters") {
        const inputs = (m.d.eventData && m.d.eventData.inputs) || [];
        let level = 0;
        for (const inp of inputs) {
          if (OBS_SOURCE && inp.inputName !== OBS_SOURCE) continue;
          const chans = inp.inputLevelsMul || [];
          for (const ch of chans) for (const v of ch) if (v > level) level = v;
          if (OBS_SOURCE) break;
        }
        liveLevel = level;
        liveMode = "level";
        lastAudioMsg = performance.now();
      }
    };
    ws.onclose = () => setTimeout(connectOBS, 4000);
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  }

  // ---- Source 2: Custom audio WebSocket ------------------------------------
  const AUDIO_URL = FD.audioWsUrl || "";
  function parseAudio(data) {
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
      return s.split(/[,\s]+/).map(Number).filter((x) => !isNaN(x));
    }
    return [];
  }
  function connectAudio() {
    let aws;
    try { aws = new WebSocket(AUDIO_URL); } catch (e) { setTimeout(connectAudio, 3000); return; }
    aws.binaryType = "arraybuffer";
    aws.onmessage = (ev) => {
      const arr = parseAudio(ev.data);
      if (!arr.length) return;
      const max = Math.max.apply(null, arr);
      const norm = max > 2 ? arr.map((v) => v / 255) : arr;
      audioBands = resample(norm, BARS);
      liveMode = "bands";
      lastAudioMsg = performance.now();
    };
    aws.onclose = () => setTimeout(connectAudio, 3000);
    aws.onerror = () => { try { aws.close(); } catch (_) {} };
  }

  if (USE_OBS) connectOBS();
  if (AUDIO_URL) connectAudio();

  // ---- Canvas drawing ------------------------------------------------------
  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 46;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  function drawViz(now) {
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 46;
    ctx.clearRect(0, 0, w, h);

    const fresh = lastAudioMsg && (performance.now() - lastAudioMsg < 600);

    if (fresh && liveMode === "bands" && audioBands.length) {
      for (let i = 0; i < BARS; i++) targets[i] = Math.min(1, (audioBands[i] || 0) * AUDIO_GAIN);
    } else if (fresh && liveMode === "level") {
      if (now - lastShapeUpdate > 90) { lastShapeUpdate = now; updateShape(); }
      const L = Math.min(1, Math.pow(liveLevel, 0.6) * AUDIO_GAIN);
      for (let i = 0; i < BARS; i++) targets[i] = Math.max(0.04, L * shape[i]);
    } else if (now - lastShapeUpdate > 110) {
      // Fallback animated equalizer.
      lastShapeUpdate = now;
      for (let i = 0; i < BARS; i++) {
        if (state.isPlaying) {
          const center = 1 - Math.abs(i - BARS / 2) / (BARS / 2);
          targets[i] = 0.15 + Math.random() * (0.5 + center * 0.5);
        } else {
          targets[i] = 0.06;
        }
      }
    }

    const ease = fresh ? 0.45 : 0.18;
    const gap = 2;
    const barW = (w - gap * (BARS - 1)) / BARS;
    ctx.fillStyle = vizColor;
    for (let i = 0; i < BARS; i++) {
      levels[i] += (targets[i] - levels[i]) * ease;
      const bh = Math.max(2, levels[i] * h);
      const x = i * (barW + gap);
      roundRect(ctx, x, h - bh, barW, bh, Math.min(barW / 2, 2));
    }
    requestAnimationFrame(drawViz);
  }

  sizeCanvas();
  window.addEventListener("resize", sizeCanvas);
  requestAnimationFrame(drawViz);

  // ---- Progress / time render ----------------------------------------------
  function render() {
    try {
      let pos = state.positionMs;
      if (state.isPlaying) pos += Date.now() - state.lastSyncWall;
      if (state.durationMs) pos = Math.min(pos, state.durationMs);

      if (state.durationMs > 0) {
        const pct = (pos / state.durationMs) * 100;
        els.fill.style.width = pct + "%";
        els.knob.style.left = pct + "%";
        els.knob.style.display = "";
        els.cur.textContent = fmt(pos);
        els.dur.textContent = fmt(state.durationMs);
        els.badge.textContent = fmt(state.durationMs);
      } else {
        // Unknown duration (some tracks/podcasts): show elapsed, no total.
        els.fill.style.width = "0%";
        els.knob.style.display = "none";
        els.cur.textContent = state.track ? fmt(pos) : "0:00";
        els.dur.textContent = "";
        els.badge.textContent = "";
      }
    } catch (e) {
      /* keep the animation loop alive no matter what */
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  // ---- Now-playing relay ---------------------------------------------------
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
