// server.js
// A tiny all-in-one server:
//   1. Serves the widget page (so customers get one URL, no files to host)
//   2. Acts as a WebSocket relay between the Chrome extension and the widget
//
// Zero state, zero database. Run locally for free, or deploy to any free tier.
//
//   npm install
//   npm start
//
// Env: PORT (default 8787)

const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8787;
const WIDGET_DIR = path.join(__dirname, "..", "widget");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

// --- HTTP: serve the widget files -----------------------------------------

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/" || urlPath === "/widget" || urlPath === "/widget/") {
    urlPath = "/widget.html";
  } else {
    urlPath = urlPath.replace(/^\/widget\//, "/");
  }

  const filePath = path.join(WIDGET_DIR, urlPath);
  // Prevent path traversal.
  if (!filePath.startsWith(WIDGET_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "text/plain" });
    res.end(data);
  });
});

// --- WebSocket: relay between extension and widget -------------------------

const wss = new WebSocketServer({ server });

// channel -> { publishers:Set, subscribers:Set, last:payload }
const channels = new Map();

function getChannel(name) {
  if (!channels.has(name)) {
    channels.set(name, { publishers: new Set(), subscribers: new Set(), last: null });
  }
  return channels.get(name);
}

function cleanup(name) {
  const ch = channels.get(name);
  if (ch && ch.publishers.size === 0 && ch.subscribers.size === 0) {
    channels.delete(name);
  }
}

wss.on("connection", (ws) => {
  ws._channel = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch (_) {
      return;
    }

    if (msg.role === "publisher" && msg.channel) {
      ws._channel = msg.channel;
      getChannel(msg.channel).publishers.add(ws);
      return;
    }
    if (msg.role === "subscriber" && msg.channel) {
      ws._channel = msg.channel;
      const ch = getChannel(msg.channel);
      ch.subscribers.add(ws);
      if (ch.last) ws.send(JSON.stringify({ type: "nowplaying", data: ch.last }));
      return;
    }

    if (msg.type === "nowplaying" && msg.channel) {
      const ch = getChannel(msg.channel);
      ch.last = msg.data;
      const out = JSON.stringify({ type: "nowplaying", data: msg.data });
      for (const sub of ch.subscribers) {
        if (sub.readyState === sub.OPEN) sub.send(out);
      }
    }
  });

  ws.on("close", () => {
    if (!ws._channel) return;
    const ch = channels.get(ws._channel);
    if (!ch) return;
    ch.publishers.delete(ws);
    ch.subscribers.delete(ws);
    cleanup(ws._channel);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`  Widget page:  http://localhost:${PORT}/widget`);
  console.log(`  Relay (ws):   ws://localhost:${PORT}`);
});
