// StreamElements custom widget JS.
// Card-style now-playing display (album art + play button + countdown + progress).
// Reads relayUrl + channel from the widget Fields.

let SE_RELAY = "wss://music.noblenestel.giize.com";
let SE_CHANNEL = "default";
let SE_HIDE_PAUSED = false;

window.addEventListener("onWidgetLoad", function (obj) {
  const fd = (obj.detail && obj.detail.fieldData) || {};
  SE_RELAY = fd.relayUrl || SE_RELAY;
  SE_CHANNEL = fd.channel || SE_CHANNEL;
  SE_HIDE_PAUSED = fd.hideWhenPaused === "yes";
  start();
});

function start() {
  const els = {
    card: document.getElementById("card"),
    cover: document.getElementById("cover"),
    track: document.getElementById("track"),
    artist: document.getElementById("artist"),
    fill: document.getElementById("fill"),
    time: document.getElementById("time"),
    iconPlay: document.getElementById("iconPlay"),
    iconPause: document.getElementById("iconPause"),
  };

  const fmt = (ms) => {
    if (!ms || ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };

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
    els.track.textContent = d.track || "";
    els.artist.textContent = d.artist || "";

    // Toggle play/pause icon.
    els.iconPlay.style.display = state.isPlaying ? "none" : "block";
    els.iconPause.style.display = state.isPlaying ? "block" : "none";

    const visible = d.track && (state.isPlaying || !SE_HIDE_PAUSED);
    els.card.classList.toggle("show", !!visible);
  }

  function render() {
    let pos = state.positionMs;
    if (state.isPlaying) pos += Date.now() - state.lastSyncWall;
    if (state.durationMs) pos = Math.min(pos, state.durationMs);

    els.fill.style.width = (state.durationMs ? (pos / state.durationMs) * 100 : 0) + "%";

    // Countdown (remaining) time, like the reference design: -1:20
    const remaining = state.durationMs ? state.durationMs - pos : 0;
    els.time.textContent = state.durationMs ? "-" + fmt(remaining) : "";

    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  let ws = null;
  function connect() {
    try {
      ws = new WebSocket(SE_RELAY);
    } catch (e) {
      setTimeout(connect, 3000);
      return;
    }
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
