require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const pool = require("./db");
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
  ws.on("message", async (data) => {
    try {
      const parsed = JSON.parse(data);

      if (parsed.action === "subscribe") {
        const { thread_id } = parsed;
        if (!clients[thread_id]) clients[thread_id] = [];
        if (!clients[thread_id].includes(ws)) {
          clients[thread_id].push(ws);
        }
        return;
      }

      const { thread_id, sender_id, message_text, attachments, message_type, ref_task_id } = parsed;
      const msgType = message_type || 'text';

      const result = await pool.query(
        `INSERT INTO messages (thread_id, sender_id, message_text, attachments, message_type, ref_task_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [thread_id, sender_id, message_text || '', attachments || [], msgType, ref_task_id || null]
      );

      const newMessage = result.rows[0];
      broadcastMessage(thread_id, newMessage);

      // Notify the other participant
      const threadResult = await pool.query(
        `SELECT customer_id, tasker_id FROM chat_threads WHERE id = $1`,
        [thread_id]
      );
      if (threadResult.rows.length > 0) {
        const { customer_id, tasker_id } = threadResult.rows[0];
        const recipient_id = sender_id === customer_id ? tasker_id : customer_id;
        notifyUser({
          user_id: recipient_id,
          title: "New message",
          body: msgType === 'booking_ref' ? 'Shared a booking' : message_text,
          type: "chat",
          data: { thread_id },
        });
      }
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
