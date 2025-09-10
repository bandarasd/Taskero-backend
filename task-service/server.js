require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => res.json({ status: "task-service running" }));

// Gig routes
app.use("/gigs", require("./routes/gigRoutes"));

// Task routes
app.use("/tasks", require("./routes/taskRoutes"));

// Review routes
app.use("/review", require("./routes/reviewRoutes"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("task-service listening on port", PORT));
