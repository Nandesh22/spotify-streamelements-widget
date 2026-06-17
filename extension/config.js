// config.js
// EDIT THIS ONE LINE after you deploy your relay (see DEPLOY.md).
// This is the address every customer's extension and widget will connect to.
// While testing locally, leave it as the localhost value.

const RELAY_URL = "ws://localhost:8787";

// The public web address where you host the widget page (widget/widget.html).
// Customers paste this (with their channel) into OBS. See DEPLOY.md.
const WIDGET_BASE_URL = "http://localhost:5500/widget/widget.html";
