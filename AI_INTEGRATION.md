# AI Integration Guide — "Now Playing" System

Use this guide to add the **music now-playing data system** (and optional
**real audio visualizer**) to any new StreamElements / OBS widget.

This system streams the currently playing track from a viewer's browser
(Spotify, Apple Music, YouTube Music) to an overlay widget, with zero cloud cost
to the customer. Audio levels for visualizers come straight from OBS.

---

## 1. Architecture

```
Music site (Spotify/Apple/YouTube)        OBS (the streamer's machine)
        │  (page MAIN world reads             │
        │   navigator.mediaSession + DOM)     │
        ▼                                     ▼
Chrome Extension  ──wss──►  Relay (Coolify/Oracle)  ──wss──►  Widget (Browser Source)
  content + bg sw           channel-based fan-out            renders the card
                                                                 │
                            OBS WebSocket (ws://127.0.0.1:4455) ◄┘  (audio levels)
```

- **Extension** scrapes now-playing data and publishes it to the relay on a
  unique **channel**.
- **Relay** is a tiny WebSocket fan-out keyed by channel (no DB, no state beyond
  the last payload per channel).
- **Widget** subscribes to the same channel and renders.
- **Audio visualizer** data does NOT go through the relay. The widget connects
  directly to the local **OBS WebSocket** to read real audio levels.

Production relay: `wss://music.noblenestel.giize.com`
Widget host (also the relay): `https://music.noblenestel.giize.com/widget`

---

## 2. Now-Playing data contract

Every now-playing message the widget receives:

```json
{
  "type": "nowplaying",
  "data": {
    "source": "Spotify",          // "Spotify" | "Apple Music" | "YouTube Music" | "Music"
    "track": "Song Title",
    "artist": "Artist, Artist",
    "album": "Album Name",        // may be ""
    "cover": "https://...jpg",    // album art URL (may be "")
    "durationMs": 215000,          // 0 if unknown
    "positionMs": 42000,           // 0 if unknown
    "progress": 19.5,              // 0..100 (derived)
    "isPlaying": true,
    "ts": 1718900000000            // producer timestamp (ms)
  }
}
```

Treat `durationMs === 0` as "unknown duration" and degrade gracefully (show
elapsed only, hide total/knob).

---

## 3. Connecting a NEW widget to the relay

Minimal subscriber. Read `relayUrl` + `channel` from the widget Fields.

```js
let ws;
function connect() {
  try { ws = new WebSocket(RELAY_URL); }
  catch (e) { setTimeout(connect, 3000); return; }
  ws.onopen = () => ws.send(JSON.stringify({ role: "subscriber", channel: CHANNEL }));
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (_) { return; }
    if (m.type === "nowplaying" && m.data) applyData(m.data);
  };
  ws.onclose = () => setTimeout(connect, 3000);  // auto-reconnect
  ws.onerror = () => { try { ws.close(); } catch (_) {} };
}
connect();
```

The relay sends the last known track immediately on subscribe, so a freshly
loaded widget fills in without waiting for the next update.

---

## 4. Smooth position clock (REQUIRED to avoid timestamp jitter)

Position sources are 1-second resolution. Do NOT re-sync to every incoming
`positionMs` or the timer stutters backward. Keep a local clock; only hard-sync
on a track change or a real seek (> 2.5s delta).

```js
function applyData(d) {
  const now = Date.now();
  const trackChanged = d.track !== state.track || d.source !== state.source;
  let interp = state.positionMs + (state.isPlaying ? now - state.lastSyncWall : 0);
  if (state.durationMs) interp = Math.min(interp, state.durationMs);

  const incoming = d.positionMs || 0;
  state.durationMs = d.durationMs || 0;
  if (trackChanged)                       state.positionMs = incoming;
  else if (Math.abs(incoming - interp) > 2500) state.positionMs = incoming; // seek
  else                                    state.positionMs = interp;        // ignore ±1s noise
  state.lastSyncWall = now;
  state.isPlaying = !!d.isPlaying;
  // ... update DOM ...
}

// render loop (requestAnimationFrame): pos = positionMs + (isPlaying ? now - lastSyncWall : 0)
```

Wrap `applyData` and the render loop in try/catch so a bad payload never breaks
the widget.

---

## 5. Album art: resolution + auto color

- **Spotify covers are 64px thumbnails.** Upgrade the CDN size code to 640px:
  `url.replace(/(i\.scdn\.co\/image\/ab67616d)0000[0-9a-f]{4}/i, "$10000b273")`
  (done in the extension, so widgets already receive hi-res URLs.)
- **Auto color**: sample the cover via a hidden `Image` with
  `crossOrigin="anonymous"` → draw to a small canvas → read pixels. Pick the most
  vibrant pixel for the accent and the average for tints. Wrap in try/catch:
  some hosts block CORS, in which case keep configured colors. Never set
  `crossOrigin` on the *visible* `<img>` (it would fail to display on blocked
  hosts) — always use a separate sampling image.

---

## 6. Service logos

Map `data.source` to an inline SVG. Keep a `LOGOS` object with keys
`"Spotify"`, `"Apple Music"`, `"YouTube Music"`, `"Music"` (fallback).

---

## 7. Real audio visualizer via OBS WebSocket (the "localhost loophole")

OBS Browser Source (CEF) exempts loopback addresses from mixed-content blocking,
so an HTTPS-hosted widget can open `ws://127.0.0.1:4455` to OBS's built-in
WebSocket server. `InputVolumeMeters` gives per-source audio levels ~20×/sec.

Handshake (obs-websocket v5):

```js
// op 0 Hello -> op 1 Identify (subscribe InputVolumeMeters = 1<<16) -> op 2 Identified -> op 5 Events
async function sha256b64(s){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));let x="";new Uint8Array(b).forEach(c=>x+=String.fromCharCode(c));return btoa(x);}
async function buildAuth(pw,salt,ch){return sha256b64(await sha256b64(pw+salt)+ch);}

ws.onmessage = async (ev) => {
  const m = JSON.parse(ev.data);
  if (m.op === 0) {
    const d = m.d, id = { op:1, d:{ rpcVersion: d.rpcVersion||1, eventSubscriptions: (1<<16) } };
    if (d.authentication) id.d.authentication = await buildAuth(PASSWORD, d.authentication.salt, d.authentication.challenge);
    ws.send(JSON.stringify(id));
  } else if (m.op === 5 && m.d.eventType === "InputVolumeMeters") {
    let level = 0;
    for (const inp of m.d.eventData.inputs) {
      if (SOURCE && inp.inputName !== SOURCE) continue;
      for (const ch of (inp.inputLevelsMul||[])) for (const v of ch) if (v > level) level = v;
      if (SOURCE) break;
    }
    liveLevel = level;            // 0..1 amplitude; drive bar heights
    lastAudioMsg = performance.now();
  }
};
```

Notes:
- `InputVolumeMeters` is **amplitude**, not an FFT spectrum. Drive a per-bar
  shape and scale its height by `liveLevel` (apply a `pow(level, 0.6)` curve +
  gain). For a true spectrum, accept a custom audio WebSocket feed instead.
- Custom audio feed format (optional): JSON array, `{fft|data|levels|bars}`,
  CSV numbers, or binary `Uint8Array` (0–255). Resample to your bar count.

---

## 8. StreamElements widget conventions

- Read settings in `window.addEventListener("onWidgetLoad", e => { const fd = e.detail.fieldData; ... })`.
- `Fields.json` field types used: `text`, `dropdown` (with `options`),
  `slider` (min/max/step), `colorpicker`, `googleFont`, `hidden`.
- **Group fields** with `"group": "Section Name"` to create categorized tabs.
- Apply dynamic styles via CSS variables: `card.style.setProperty("--accent", val)`
  and reference `var(--accent)` in CSS.
- Give the widget breathing room (`body { padding: 32px }`) so glows/shadows
  aren't clipped, and offer alignment via `justify-content/align-items` vars.

---

## 9. Reuse checklist for a new widget

1. Copy the relay subscriber (section 3) + smooth clock (section 4).
2. Add `relayUrl` (default `wss://music.noblenestel.giize.com`) and `channel`
   fields, grouped under "Connection".
3. If it shows album art, add hi-res handling + optional auto-color (section 5).
4. If it has a visualizer, add the OBS WebSocket client (section 7) with
   `obsPort` / `obsPassword` / `obsSource` fields under "Audio Source".
5. Wrap render + data handling in try/catch.
6. Keep the customer flow identical: they paste the same Channel ID from the
   extension popup. One extension feeds any number of widgets.
