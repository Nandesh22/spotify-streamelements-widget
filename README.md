# Spotify → StreamElements Now Playing

A zero-API, zero-monthly-cost "now playing" music widget for streamers. A Chrome
extension reads the **Spotify Web Player** directly from the DOM and pushes track
data through a tiny WebSocket relay to a StreamElements / OBS overlay.

No Spotify API keys. No OAuth. No per-user tokens. No paid hosting.

## How it works

```
Spotify Web Player tab   →   Chrome Extension   →   WebSocket Relay   →   Widget (OBS/SE)
   (open.spotify.com)        (reads the DOM)         (tiny, free)         (renders overlay)
```

The extension (in the streamer's Chrome) and the widget (in OBS) are separate
browser processes, so they meet on a small WebSocket relay using a shared
**channel ID**. The relay holds no data and needs no database.

## Data captured

Track, artist(s), album art, duration, playback position, a live progress bar,
and play/pause state.

## Project layout

- `extension/` — the Chrome extension (Manifest V3)
- `relay/` — the tiny WebSocket relay (Node.js + `ws`)
- `widget/` — standalone overlay page for an OBS Browser Source
- `streamelements/` — the same widget split into SE Custom Widget fields

## Two audiences

- **You (the seller):** set things up once. See **`DEPLOY.md`**. You host one relay
  online, then customers never touch a terminal.
- **Your customers:** just install the extension and paste one link into OBS.

## Customer setup (after you've deployed — see DEPLOY.md)

1. Install the extension (from a zip or the Chrome Web Store).
2. Open [open.spotify.com](https://open.spotify.com) and play a track.
3. Click the extension icon → **Copy OBS link**.
4. In OBS: add a **Browser Source** → tick "Local file" off → paste the link as the URL.
   Set width 400, height 120.

That's it. No terminal, no channel to invent — the extension creates one automatically.

## Local testing (no deploy)

If you just want to try it on your own machine first:

```
cd relay
npm install
npm start          # serves widget + relay on http://localhost:8787
```

Leave `extension/config.js` at its localhost defaults. Load the extension via
`chrome://extensions` → Developer mode → **Load unpacked** → pick `extension/`.
Then use the **Copy OBS link** button in the popup.

## StreamElements Custom Widget (alternative to OBS Browser Source)

1. In the SE overlay editor, add a **Custom Widget**.
2. Paste `streamelements/HTML.html`, `CSS.css`, `JS.js` into the matching tabs.
3. Paste `streamelements/Fields.json` into the Fields/Settings (JSON) tab.
4. Set the Relay URL and Channel ID in the widget settings to match the extension
   (the channel is shown by the extension; relay is your deployed `wss://` URL).

## Notes & limitations

- The streamer must use the **Spotify Web Player** in Chrome, not the desktop app.
- DOM selectors in `content.js` track Spotify's current markup. If Spotify changes
  their layout, update the selectors there.
- For local-only use, `ws://localhost:8787` is fine. For a hosted relay, use `wss://`
  and a unique, hard-to-guess channel ID per customer (the relay is a public bridge).
- Scraping a site's DOM can break without notice and may conflict with the target
  site's terms of use. Review that before selling commercially.
```
