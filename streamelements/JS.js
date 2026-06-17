// StreamElements custom widget JS.
// Reads relayUrl + channel from the widget Fields, then behaves like widget.js.

let SE_RELAY = "ws://localhost:8787";
let SE_CHANNEL = "default";
let SE_HIDE_PAUSED = true;

window.addEventListener("onWidgetLoad", function (obj) {
  const fd = (obj.detail && obj.detail.fieldData) || {};
  SE_RELAY = fd.relayUrl || SE_RELAY;
  SE_CHANNEL = fd.channel || SE_CHANNEL;
  SE_HIDE_PAUSED = fd.hideWhenPaused !== "no";
  start();
});

function start() {
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
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  };

  let state = { positionMs: 0, durationMs: 0, isPlaying: false, lastSyncWall: Date.now(), track: "", artist: "", cover: "" };

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
    els.dur.textContent = fmt(state.durationMs);
    const visible = d.track && (state.isPlaying || !SE_HIDE_PAUSED);
    els.card.classList.toggle("show", !!visible);
  }

  function render() {
    let pos = state.positionMs;
    if (state.isPlaying) pos += Date.now() - state.lastSyncWall;
    if (state.durationMs) pos = Math.min(pos, state.durationMs);
    els.fill.style.width = (state.durationMs ? (pos / state.durationMs) * 100 : 0) + "%";
    els.pos.textContent = fmt(pos);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  let ws = null;
  function connect() {
    try { ws = new WebSocket(SE_RELAY); } catch (e) { setTimeout(connect, 3000); return; }
    ws.onopen = () => ws.send(JSON.stringify({ role: "subscriber", channel: SE_CHANNEL }));
    ws.onmessage = (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch (_) { return; }
      if (msg.type === "nowplaying" && msg.data) applyData(msg.data);
    };
    ws.onclose = () => setTimeout(connect, 3000);
    ws.onerror = () => { try { ws.close(); } catch (_) {} };
  }
  connect();
}
