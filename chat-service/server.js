require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const pool = require("./db");
const admin = require("../shared/firebaseAdmin");
const chatRoutes = require("./routes/chatRoutes");
const { notifyUser } = require("./utils/notify");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "chat-service running" }));
app.use("/chat", chatRoutes);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws" });

const clients = {}; // thread_id -> WebSocket[]

const broadcastMessage = (thread_id, message) => {
  if (clients[thread_id]) {
    clients[thread_id].forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }
};

wss.on("connection", (ws) => {
  ws.authenticatedUserId = null; // set after "auth" handshake

  ws.on("message", async (data) => {
    try {
      const parsed = JSON.parse(data);

      // Auth handshake must be first frame
      if (parsed.action === "auth") {
        try {
          const decoded = await admin.auth().verifyIdToken(parsed.token);
          const dbRow = await pool.query(
            "SELECT id FROM users WHERE firebase_uid = $1",
            [decoded.uid]
          );
          ws.authenticatedUserId = dbRow.rows[0]?.id ?? null;
          ws.send(JSON.stringify({ action: "auth_ok" }));
        } catch {
          ws.send(JSON.stringify({ error: "Authentication failed" }));
          ws.close();
        }
        return;
      }

      if (parsed.action === "subscribe") {
        if (!ws.authenticatedUserId) {
          ws.send(JSON.stringify({ error: "Not authenticated" }));
          return;
        }
        const { thread_id } = parsed;
        // Verify user belongs to this thread before subscribing
        const threadCheck = await pool.query(
          `SELECT customer_id, tasker_id FROM chat_threads WHERE id = $1`,
          [thread_id]
        );
        if (!threadCheck.rows[0]) { ws.send(JSON.stringify({ error: "Thread not found" })); return; }
        const { customer_id, tasker_id } = threadCheck.rows[0];
        if (ws.authenticatedUserId !== customer_id && ws.authenticatedUserId !== tasker_id) {
          ws.send(JSON.stringify({ error: "Forbidden" }));
          return;
        }
        if (!clients[thread_id]) clients[thread_id] = [];
        if (!clients[thread_id].includes(ws)) {
          clients[thread_id].push(ws);
        }
        return;
      }

      // All other actions require authentication
      if (!ws.authenticatedUserId) {
        ws.send(JSON.stringify({ error: "Not authenticated" }));
        return;
      }

      const sender_id = ws.authenticatedUserId;
      const { thread_id, message_text, attachments, message_type, ref_task_id } = parsed;
      const msgType = message_type || 'text';

      // Verify sender belongs to this thread
      const threadResult = await pool.query(
        `SELECT customer_id, tasker_id FROM chat_threads WHERE id = $1`,
        [thread_id]
      );
      if (!threadResult.rows[0]) { ws.send(JSON.stringify({ error: "Thread not found" })); return; }
      const { customer_id, tasker_id } = threadResult.rows[0];
      if (sender_id !== customer_id && sender_id !== tasker_id) {
        ws.send(JSON.stringify({ error: "Forbidden" }));
        return;
      }

      const result = await pool.query(
        `INSERT INTO messages (thread_id, sender_id, message_text, attachments, message_type, ref_task_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [thread_id, sender_id, message_text || '', attachments || [], msgType, ref_task_id || null]
      );

      const newMessage = result.rows[0];
      broadcastMessage(thread_id, newMessage);

      const recipient_id = sender_id === customer_id ? tasker_id : customer_id;
      notifyUser({
        user_id: recipient_id,
        title: "New message",
        body: msgType === 'booking_ref' ? 'Shared a booking' : message_text,
        type: "chat",
        data: { thread_id },
      });
    } catch (err) {
      console.error("Error handling WS message:", err);
    }
  });

  ws.on("close", () => {
    Object.keys(clients).forEach((thread_id) => {
      clients[thread_id] = clients[thread_id].filter((c) => c !== ws);
      if (clients[thread_id].length === 0) delete clients[thread_id];
    });
  });
});

const PORT = process.env.PORT || 3003;
server.listen(PORT, () => console.log(`chat-service listening on port ${PORT}`));
