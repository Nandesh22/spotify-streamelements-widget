# Deploy Guide (for YOU, the seller) — do this once

The goal: host the relay online once so your **customers never open a terminal**.
After this, customer setup is just "install extension + paste one link into OBS".

## Step 1 — Put this project on GitHub

Create a free GitHub repo and push this whole folder to it.

## Step 2 — Deploy the relay on Render (free)

1. Go to [render.com](https://render.com) and sign up (free).
2. Click **New → Blueprint**, choose your GitHub repo. Render reads `relay/render.yaml`.
3. Click **Apply**. Wait for it to deploy.
4. Render gives you a URL like `https://spotify-se-relay.onrender.com`.

That single URL is both your relay and your widget host.

> Other free options work too (Railway, Fly.io, Cyclic). Any Node host is fine.

## Step 3 — Put your URL into the extension config

Open `extension/config.js` and change the two lines to your Render URL:

```js
// Use wss:// (secure) and your Render hostname:
const RELAY_URL = "wss://spotify-se-relay.onrender.com";
const WIDGET_BASE_URL = "https://spotify-se-relay.onrender.com/widget";
```

Note: `https` host → use `wss` (not `ws`) for the relay. Render gives you https,
so always use `wss` in production.

## Step 4 — Package the extension for customers

- Zip the `extension/` folder, OR
- Publish it to the Chrome Web Store (one-time $5 developer fee) so customers
  install with one click.

## Done

Now every customer who installs the extension automatically gets their own
channel and a ready-to-paste OBS link. You never touch a terminal again, and
neither do they.

## Cost reality

- Render free tier sleeps after inactivity and may cold-start slowly. For a paid
  product, the $7/mo Render plan (or similar) keeps it always-on. Still one flat
  cost for all customers, not per-customer.
- One small relay handles many simultaneous customers because traffic per
  customer is tiny (a few small messages per song).
