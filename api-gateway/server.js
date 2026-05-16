require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

// Middleware
app.use(cors());
app.use((req, _res, next) => {
  console.log(`[gateway] ${req.method} ${req.url} from ${req.ip}`);
  next();
});
app.use(morgan("dev")); // Request logging
// NOTE: Do NOT add express.json() here — it consumes the request body stream,
// which prevents http-proxy-middleware from forwarding the body to downstream services.

// Service URLs from environment variables
const services = {
  users: process.env.USER_SERVICE_URL || "http://localhost:3001",
  tasks: process.env.TASK_SERVICE_URL || "http://localhost:3002",
  chat: process.env.CHAT_SERVICE_URL || "http://localhost:3003",
  payments: process.env.PAYMENT_SERVICE_URL || "http://localhost:3004",
  search: process.env.SEARCH_SERVICE_URL || "http://localhost:3005",
  notifications:
    process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3006",
  email: process.env.EMAIL_SERVICE_URL || "http://localhost:3007",
};

// Proxy options factory
const createProxy = (target) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path, req) => path, // Keep the path as-is
    onError: (err, req, res) => {
      console.error(`Proxy error: ${err.message}`);
      res.status(503).json({ error: "Service temporarily unavailable" });
    },
  });
};

// Health check for the gateway itself
app.get("/health", (req, res) => {
  res.json({
    status: "API Gateway running",
    timestamp: new Date().toISOString(),
  });
});

// Health check for all services
app.get("/health/all", async (req, res) => {
  const healthChecks = {};
  for (const [name, url] of Object.entries(services)) {
    try {
      const response = await fetch(`${url}/health`);
      healthChecks[name] = response.ok ? "healthy" : "unhealthy";
    } catch (error) {
      healthChecks[name] = "unavailable";
    }
  }
  res.json({ gateway: "healthy", services: healthChecks });
});

// ============== Route Proxies ==============
// Routes are mapped to match the actual service endpoints

// User Service: /auth/*, /users/*, /verifications/*
app.use("/auth", createProxy(services.users));
app.use("/users", createProxy(services.users));
app.use("/verifications", createProxy(services.users));

// Task Service: /tasks/*, /gigs/*, /reviews/*, /taskers/*
app.use("/tasks", createProxy(services.tasks));
app.use("/gigs", createProxy(services.tasks));
app.use("/reviews", createProxy(services.tasks));
app.use("/taskers", createProxy(services.tasks));

// Chat Service: /chat/*
app.use("/chat", createProxy(services.chat));

// Payment Service: /payments/*
app.use("/payments", createProxy(services.payments));

// Search Service: /search/*
app.use("/search", createProxy(services.search));

// Email Service: /email/*
app.use("/email", createProxy(services.email));

// Notification Service: /notifications/*
app.use("/notifications", createProxy(services.notifications));

// ============== WebSocket Proxy for Chat ==============
// Note: For WebSocket support, you may need additional configuration
// The chat service WebSocket is available at ws://localhost:5003/ws

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Gateway error:", err);
  res.status(500).json({ error: "Internal gateway error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 API Gateway running on port ${PORT}`);
  console.log("\nProxying to services:");
  Object.entries(services).forEach(([name, url]) => {
    console.log(`  - ${name}: ${url}`);
  });
});
