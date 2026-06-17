// popup.js
// Customer-facing: shows whether Spotify is open and gives one OBS link to copy.

const statusEl = document.getElementById("status");
const obsLinkEl = document.getElementById("obsLink");
const spotifyStatusEl = document.getElementById("spotifyStatus");

// Build the ready-to-paste OBS URL from the stored channel + relay.
async function buildLink() {
  const { channel, relayUrl } = await chrome.storage.local.get({
    channel: "",
    relayUrl: RELAY_URL,
  });

  if (!channel) {
    obsLinkEl.textContent = "Generating your link…";
    return "";
  }

  const url =
    WIDGET_BASE_URL +
    "?relay=" +
    encodeURIComponent(relayUrl) +
    "&channel=" +
    encodeURIComponent(channel);

  obsLinkEl.textContent = url;
  return url;
}

// Check if a Spotify Web Player tab is open.
async function checkSpotify() {
  try {
    const tabs = await chrome.tabs.query({ url: "https://open.spotify.com/*" });
    if (tabs.length) {
      spotifyStatusEl.innerHTML = '<span class="ok">✓ Spotify is open. You are good to go.</span>';
    } else {
      spotifyStatusEl.innerHTML =
        '<span class="warn">⚠ Open open.spotify.com and play a song.</span>';
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
