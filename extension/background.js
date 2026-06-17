// background.js (MV3 service worker)
// Maintains a WebSocket connection to the relay and forwards now-playing data
// from the content script on a per-user channel.

importScripts("config.js"); // provides RELAY_URL

let socket = null;
let reconnectTimer = null;
let lastPayload = null;

const DEFAULTS = {
  relayUrl: RELAY_URL,
  channel: "",
};

// On install, give the customer a ready-to-use channel automatically so they
// never have to invent one. They can still change it in the popup.
chrome.runtime.onInstalled.addListener(async () => {
  const cur = await chrome.storage.local.get({ channel: "", relayUrl: "" });
  const updates = {};
  if (!cur.channel) {
    updates.channel = "sp-" + Math.random().toString(36).slice(2, 10);
  }
  if (!cur.relayUrl) {
    updates.relayUrl = RELAY_URL;
  }
  if (Object.keys(updates).length) await chrome.storage.local.set(updates);
});

async function getConfig() {
  const cfg = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...cfg };
}

function connect() {
  clearTimeout(reconnectTimer);
  getConfig().then(({ relayUrl, channel }) => {
    if (!relayUrl || !channel) return; // not configured yet

    try {
      socket = new WebSocket(relayUrl);
    } catch (e) {
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      socket.send(JSON.stringify({ role: "publisher", channel }));
      // Re-send last known state so a freshly connected widget gets it.
      if (lastPayload) {
        socket.send(JSON.stringify({ type: "nowplaying", channel, data: lastPayload }));
      }
    };

    socket.onclose = () => scheduleReconnect();
    socket.onerror = () => {
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
    getConfig().then(({ channel }) => {
      if (socket && socket.readyState === WebSocket.OPEN && channel) {
        socket.send(JSON.stringify({ type: "nowplaying", channel, data: msg.data }));
      }
    });
  }
});

// Reconnect when settings change.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.relayUrl || changes.channel)) {
    try { socket && socket.close(); } catch (_) {}
    connect();
  }
});

connect();
