// background.js (MV3 service worker)
// Connects to the fixed production relay and forwards now-playing data.
// Arbitrates between multiple open music tabs: only the actively PLAYING
// source is sent, so two open platforms don't fight over the widget.

importScripts("config.js"); // provides RELAY_URL

let socket = null;
let reconnectTimer = null;
let currentChannel = "";

const PLACEHOLDER_CHANNELS = ["", "your-unique-name", "default"];

// tabId -> { data, isPlaying, ts }
const tabStates = new Map();

async function ensureConfig() {
  const cur = await chrome.storage.local.get({ channel: "" });
  let channel = cur.channel;
  if (PLACEHOLDER_CHANNELS.includes(channel)) {
    channel = "sp-" + Math.random().toString(36).slice(2, 10);
  }
  await chrome.storage.local.set({ channel, relayUrl: RELAY_URL });
  currentChannel = channel;
  return { channel, relayUrl: RELAY_URL };
}

chrome.runtime.onInstalled.addListener(ensureConfig);
chrome.runtime.onStartup.addListener(connect);

function connect() {
  clearTimeout(reconnectTimer);
  ensureConfig().then(({ channel }) => {
    if (!RELAY_URL || !channel) return;
    try {
      socket = new WebSocket(RELAY_URL);
    } catch (e) {
      console.log("[MusicNP-bg] connect threw", e);
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      console.log("[MusicNP-bg] connected, channel:", channel);
      socket.send(JSON.stringify({ role: "publisher", channel }));
      publishActive(); // push current state to any waiting widget
    };
    socket.onclose = () => { console.log("[MusicNP-bg] disconnected"); scheduleReconnect(); };
    socket.onerror = (e) => { console.log("[MusicNP-bg] error", e); try { socket.close(); } catch (_) {} };
  });
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, 3000);
}

// Decide which open tab the widget should show.
// Priority: a tab that is currently playing (most recent wins);
// otherwise the most recently updated tab (so a paused track still shows).
function chooseActive() {
  const now = Date.now();
  const states = Array.from(tabStates.values()).filter((s) => now - s.ts < 10000);
  if (!states.length) return null;
  const playing = states.filter((s) => s.isPlaying).sort((a, b) => b.ts - a.ts);
  if (playing.length) return playing[0];
  states.sort((a, b) => b.ts - a.ts);
  return states[0];
}

function publishActive() {
  const active = chooseActive();
  if (active && socket && socket.readyState === WebSocket.OPEN && currentChannel) {
    socket.send(JSON.stringify({ type: "nowplaying", channel: currentChannel, data: active.data }));
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "nowplaying") {
    const id = sender && sender.tab ? sender.tab.id : "ext";
    tabStates.set(id, { data: msg.data, isPlaying: !!msg.data.isPlaying, ts: Date.now() });
    publishActive();
  }
});

// Forget a tab when it closes so it can't keep "owning" the widget.
chrome.tabs.onRemoved.addListener((tabId) => tabStates.delete(tabId));

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.channel) {
    try { socket && socket.close(); } catch (_) {}
    connect();
  }
});

connect();
