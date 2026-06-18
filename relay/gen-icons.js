// Generates extension toolbar icons: a dark rounded tile with a 3-bar
// equalizer in the three service colors (Spotify green, gold, YouTube red).
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const OUT_DIR = path.join(__dirname, "..", "extension", "icons");
fs.mkdirSync(OUT_DIR, { recursive: true });

function gen(size, outPath, done) {
  const png = new PNG({ width: size, height: size });
  const r = size * 0.22;

  function inRounded(x, y) {
    if (x >= r && x <= size - 1 - r) return true;
    if (y >= r && y <= size - 1 - r) return true;
    const cx = x < r ? r : size - 1 - r;
    const cy = y < r ? r : size - 1 - r;
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  }

  const bars = [
    { c: [29, 185, 84], h: 0.50 },   // Spotify green
    { c: [231, 181, 74], h: 0.82 },  // gold accent
    { c: [255, 60, 60], h: 0.40 },   // YouTube red
  ];
  const barW = size * 0.15;
  const gap = size * 0.08;
  const totalW = bars.length * barW + (bars.length - 1) * gap;
  const startX = (size - totalW) / 2;
  const baseY = size * 0.76;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      if (!inRounded(x, y)) { png.data[idx + 3] = 0; continue; }

      let r0 = 20, g0 = 18, b0 = 16; // dark tile
      for (let i = 0; i < bars.length; i++) {
        const bx = startX + i * (barW + gap);
        const bh = size * bars[i].h;
        const by = baseY - bh;
        if (x >= bx && x < bx + barW && y >= by && y <= baseY) {
          r0 = bars[i].c[0]; g0 = bars[i].c[1]; b0 = bars[i].c[2];
          break;
        }
      }
      png.data[idx] = r0; png.data[idx + 1] = g0; png.data[idx + 2] = b0; png.data[idx + 3] = 255;
    }
  }

  png.pack().pipe(fs.createWriteStream(outPath)).on("finish", done);
}

let pending = 0;
[16, 48, 128].forEach((s) => {
  pending++;
  gen(s, path.join(OUT_DIR, "icon" + s + ".png"), () => {
    console.log("wrote icon" + s + ".png");
    if (--pending === 0) console.log("ICONS_DONE");
  });
});
