// background.js (MV3 service worker)
// Connects to the fixed production relay (from config.js) and forwards
// now-playing data from the content script on a per-user channel.

importScripts("config.js"); // provides RELAY_URL

let socket = null;
let reconnectTimer = null;
let lastPayload = null;

const PLACEHOLDER_CHANNELS = ["", "your-unique-name", "default"];

// Returns a valid, persisted channel. Generates one if missing/placeholder.
// The relay URL is ALWAYS the config value — never read from storage — so
// stale per-user data can't point customers at the wrong server.
async function ensureConfig() {
  const cur = await chrome.storage.local.get({ channel: "" });
  let channel = cur.channel;
  if (PLACEHOLDER_CHANNELS.includes(channel)) {
    channel = "sp-" + Math.random().toString(36).slice(2, 10);
  }
  // Pin storage to the correct values (self-heals old installs).
  await chrome.storage.local.set({ channel, relayUrl: RELAY_URL });
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
      console.log("[SpotifyNP-bg] connect threw", e);
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      console.log("[SpotifyNP-bg] connected to relay, channel:", channel);
      socket.send(JSON.stringify({ role: "publisher", channel }));
      if (lastPayload) {
        socket.send(JSON.stringify({ type: "nowplaying", channel, data: lastPayload }));
      }
    };

    socket.onclose = () => {
      console.log("[SpotifyNP-bg] relay disconnected, retrying in 3s");
      scheduleReconnect();
    };
    socket.onerror = (e) => {
      console.log("[SpotifyNP-bg] relay error", e);
      try { socket.close(); } catch (_) {}
    };
  });
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, 3000);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "nowplaying") {
    lastPayload = msg.data;
    ensureConfig().then(({ channel }) => {
      if (socket && socket.readyState === WebSocket.OPEN && channel) {
        socket.send(JSON.stringify({ type: "nowplaying", channel, data: msg.data }));
      }
    });
  }
});

connect();
