const axios = require("axios");

const NOTIFICATION_URL =
  process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3006";
const INTERNAL_KEY = process.env.INTERNAL_API_KEY;

async function notifyUser({ user_id, title, body, type, data = {} }) {
  try {
    await axios.post(
      `${NOTIFICATION_URL}/notifications/internal/create`,
      { user_id, title, body, type, data },
      { headers: { "x-internal-key": INTERNAL_KEY }, timeout: 3000 }
    );
  } catch (err) {
    console.error("[notify] failed to send notification:", err.message);
  }
}

module.exports = { notifyUser };
