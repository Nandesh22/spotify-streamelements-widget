// config.js
// Production relay, hosted on Oracle Cloud + Coolify.
// This is the address every customer's extension and widget connect to.

const RELAY_URL = "wss://music.noblenestel.giize.com";

// The public web address where the widget page is served (the relay also
// serves it). Customers paste this (with their channel) into OBS.
const WIDGET_BASE_URL = "https://music.noblenestel.giize.com/widget";
