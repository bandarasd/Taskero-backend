require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

// Health check
app.get("/health", (req, res) => res.json({ status: "task-service running" }));

// Gig routes
app.use("/gigs", require("./routes/gigRoutes"));

// Task routes
app.use("/tasks", require("./routes/taskRoutes"));

// Review routes
app.use("/review", require("./routes/reviewRoutes"));

// Tasker schedule & availability routes
app.use("/taskers", require("./routes/taskerScheduleRoutes"));

const errorHandler = require('../shared/middleware/errorHandler');
app.use(errorHandler);

// Auto-cancel quotes that have passed their expiry deadline
const EXPIRY_INTERVAL_MS = 60 * 1000; // run every minute
setInterval(async () => {
  try {
    const result = await pool.query(
      `UPDATE tasks SET status = 'cancelled'
       WHERE status = 'quoted'
         AND quote_expires_at IS NOT NULL
         AND quote_expires_at < NOW()`
    );
    if (result.rowCount > 0) {
      console.log(`[quote-expiry] Auto-cancelled ${result.rowCount} expired quote(s)`);
    }
  } catch (err) {
    console.error("[quote-expiry] Error running expiry job:", err.message);
  }
}, EXPIRY_INTERVAL_MS);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("task-service listening on port", PORT));
