# Relay + widget server. Build context is the repo ROOT.
# Works on ARM (Oracle Ampere) and x86 alike.
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better build caching).
COPY relay/package.json relay/package-lock.json* ./
RUN npm install --omit=dev

# Copy the relay code into /app and the widget files it serves into /widget.
# server.js looks for the widget at ../widget, which resolves to /widget here.
COPY relay/ ./
COPY widget/ /widget/

EXPOSE 8787
CMD ["node", "server.js"]
