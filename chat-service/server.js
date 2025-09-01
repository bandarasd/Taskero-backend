require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const pool = require("./db"); // Make sure you require your pool
const chatRoutes = require("./routes/chatRoutes");

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => res.json({ status: "chat-service running" }));

// API routes
app.use("/chat", chatRoutes);

// Create HTTP server for WS
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server, path: "/ws" }); // Note the path

let clients = {}; // thread_id -> array of ws clients

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

// Handle WS connections
wss.on("connection", (ws) => {
  console.log("Client connected via WS");

  ws.on("message", async (data) => {
    try {
      const parsed = JSON.parse(data);

      // Subscribe to thread
      if (parsed.action === "subscribe") {
        const { thread_id } = parsed;
        if (!clients[thread_id]) clients[thread_id] = [];
        clients[thread_id].push(ws);
        return;
      }

      // Sending a message
      const {
        thread_id,
        sender_id,
        message_text,
        gig_id,
        task_id,
        attachments,
      } = parsed;

      const result = await pool.query(
        `INSERT INTO messages (thread_id, sender_id, message_text, gig_id, task_id, attachments)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [thread_id, sender_id, message_text, gig_id, task_id, attachments]
      );

      const newMessage = result.rows[0];
      broadcastMessage(thread_id, newMessage);
    } catch (err) {
      console.error("Error handling WS message:", err);
    }
  });

  ws.on("close", () => {
    Object.keys(clients).forEach((thread_id) => {
      clients[thread_id] = clients[thread_id].filter((client) => client !== ws);
    });
  });
});

// Listen using the HTTP server so WS works
const PORT = process.env.PORT || 5003;
server.listen(PORT, () =>
  console.log(`chat-service listening on port ${PORT}`)
);
