// popup.js
// Shows whether Spotify is open and gives one OBS link to copy.
// The relay URL always comes from config.js (RELAY_URL); the channel is
// auto-generated and persisted. Customers never type anything.

const statusEl = document.getElementById("status");
const obsLinkEl = document.getElementById("obsLink");
const spotifyStatusEl = document.getElementById("spotifyStatus");

const PLACEHOLDER_CHANNELS = ["", "your-unique-name", "default"];

// Ensure a valid channel exists, fixing any stale/placeholder value.
async function ensureChannel() {
  const { channel } = await chrome.storage.local.get({ channel: "" });
  let ch = channel;
  if (PLACEHOLDER_CHANNELS.includes(ch)) {
    ch = "sp-" + Math.random().toString(36).slice(2, 10);
  }
  // Pin relay to config value too, so old localhost data is cleared.
  await chrome.storage.local.set({ channel: ch, relayUrl: RELAY_URL });
  return ch;
}

async function buildLink() {
  const channel = await ensureChannel();
  const url =
    WIDGET_BASE_URL +
    "?relay=" +
    encodeURIComponent(RELAY_URL) +
    "&channel=" +
    encodeURIComponent(channel);
  obsLinkEl.textContent = url;
  return url;
}

async function checkSpotify() {
  try {
    const tabs = await chrome.tabs.query({ url: "https://open.spotify.com/*" });
    if (tabs.length) {
      spotifyStatusEl.innerHTML = '<span class="ok">&#10003; Spotify is open. You are good to go.</span>';
    } else {
      spotifyStatusEl.innerHTML =
        '<span class="warn">&#9888; Open open.spotify.com and play a song.</span>';
    }
  } catch (e) {
    spotifyStatusEl.textContent = "";
  }
}

document.getElementById("copy").addEventListener("click", async () => {
  const url = await buildLink();
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    statusEl.style.color = "#1db954";
    statusEl.textContent = "Copied! Paste it into an OBS Browser Source.";
  } catch (e) {
    statusEl.style.color = "#e22";
    statusEl.textContent = "Copy failed — select the link above and copy manually.";
  }
});

buildLink();
checkSpotify();
