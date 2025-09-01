require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const chatRoutes = require("./routes/chatRoutes");

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => res.json({ status: "order-service running" }));

app.use("/chat", chatRoutes);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let clients = {};

// Broadcast function
const broadcastMessage = (thread_id, message) => {
  if (clients[thread_id]) {
    clients[thread_id].forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }
};

// Websocket connection
wss.on("connection", (ws, req) => {
  ws.on("message", (data) => {
    try {
      const parsed = JSON.parse(data);
      const {
        thread_id,
        sender_id,
        message_text,
        gig_id,
        task_id,
        attachments,
      } = parsed;

      // Save message to database
      pool.query(
        `INSERT INTO messages (thread_id, sender_id, message_text, gig_id, task_id, attachments)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [thread_id, sender_id, message_text, gig_id, task_id, attachments],
        (err, result) => {
          if (err) return console.error(err);
          const newMessage = result.rows[0];

          // Broadcast to all clients in this thread
          broadcastMessage(thread_id, newMessage);
        }
      );
    } catch (err) {
      console.error("Error handling WS message:", err);
    }
  });

  ws.on("close", () => {
    // Remove ws from all thread subscriptions
    Object.keys(clients).forEach((thread_id) => {
      clients[thread_id] = clients[thread_id].filter((client) => client !== ws);
    });
  });
});

// Subscribe to a thread
wss.on("connection", (ws) => {
  ws.on("message", (data) => {
    const parsed = JSON.parse(data);
    const { action, thread_id } = parsed;

    if (action === "subscribe") {
      if (!clients[thread_id]) clients[thread_id] = [];
      clients[thread_id].push(ws);
    }
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("order-service listening on port", PORT));
