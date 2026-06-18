# Music Now-Playing Widget — Setup Guide

Show your currently playing song (Spotify, Apple Music, or YouTube Music) on your
stream, with album art, a progress bar, and a live audio visualizer.

**You need:** Google Chrome, OBS, and a few minutes. No coding, no subscriptions.

---

## Part 1 — Install the extension (one time)

1. Unzip the extension folder I gave you somewhere permanent (don't delete it later).
2. In Chrome, go to `chrome://extensions`
3. Turn on **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the unzipped **extension** folder
5. Pin it: click the puzzle-piece icon in Chrome's toolbar → pin "Music Now Playing"

> If you ever reinstall the extension, your Channel ID changes — just re-copy it
> into the widget (Part 3).

---

## Part 2 — Play your music

- Open one of these in a Chrome tab and play a song:
  - https://open.spotify.com
  - https://music.apple.com
  - https://music.youtube.com
- Keep that tab open while you stream.

Click the extension icon — it should say **"Music tab open. You are good to go."**

---

## Part 3 — Add the widget to your stream

You have two options. **Option A (OBS link)** is the simplest.

### Option A — OBS Browser Source (easiest)

1. Click the extension icon → **Copy OBS link**
2. In OBS: **Sources → + → Browser**
3. Paste the link into the **URL** field
4. Set Width `460`, Height `640` (a bit larger than the card so the glow shows)
5. Click OK

### Option B — StreamElements Custom Widget

1. Click the extension icon → note the **Channel ID** (the `sp-xxxx` in the link)
2. In StreamElements: **My Overlays → open an overlay → Add Widget → Static / Custom → Custom Widget**
3. Open the widget editor and paste each provided file into its tab: **HTML, CSS, JS, FIELDS**
4. In the widget **settings**, set **Channel ID** to your `sp-xxxx`
   (Relay URL is already filled in)

---

## Part 4 — Live audio visualizer (optional, recommended)

The bars can react to your real audio through OBS.

1. In OBS: **Tools → WebSocket Server Settings**
   - Tick **Enable WebSocket server**
   - Note the **Port** (usually `4455`)
   - Set a **Password**, or untick authentication for none
2. In OBS, add an **Application Audio Capture** source for your music app, and
   name it exactly **Music** (or any name you'll reuse)
3. In the widget settings (Audio Source group):
   - **Use OBS audio** → Yes
   - **OBS WebSocket port** → `4455`
   - **OBS WebSocket password** → same as OBS (or blank)
   - **OBS audio source name** → `Music`
   - Adjust **Audio sensitivity** if the bars are too small/large

If you skip this, the visualizer still animates while music plays.

---

## Customizing the look

In the widget settings everything is grouped into tabs:

- **Connection** — relay + channel (channel must match the extension)
- **Audio Source** — OBS audio settings + sensitivity
- **Visualizer** — style (Bars, Mirror, Blocks, Wave, Dots), bar count, color mode
  (Album / Solid / Custom gradient), colors
- **Layout & Size** — overall size %, width, art height, corner radius, font,
  alignment (left/center/right, top/middle/bottom)
- **Display Toggles** — show/hide visualizer, progress, times, badge, logo, play button
- **Colors** — auto-color from album art, glass panel, and all manual colors

---

## Troubleshooting

**Nothing shows up**
- Make sure a song is actually **playing** in a Chrome tab.
- Check the **Channel ID** in the widget matches the one in the extension popup
  (it changes if you reinstall the extension).

**Shows the previous song / lags on fast skips**
- Reload the extension at `chrome://extensions` (refresh icon) and try again.

**Album art looks blurry**
- Reload the extension; it upgrades Spotify art to high resolution automatically.

**The glow is cut off on one edge**
- Make the OBS Browser Source a bit larger than the card, and set
  **Horizontal alignment** to Center in the widget settings.

**Visualizer doesn't react to audio**
- Confirm OBS WebSocket server is enabled, the port/password match, and the
  **OBS audio source name** in the widget exactly matches your audio source in OBS.

**Two music tabs open**
- The widget follows whichever song is actually playing; pause one to switch.

---

## Notes

- Keep the music tab open in Chrome and OBS running while you stream.
- Use the **Spotify Web Player** (open.spotify.com), not the desktop app.
- Everything runs on your machine + a shared relay; there's nothing to subscribe to.
