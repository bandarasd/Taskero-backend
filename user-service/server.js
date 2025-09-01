require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const userRoutes = require("./routes/userRoutes");

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) => res.json({ status: "User service running" }));

// User routes
app.use("/users", userRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("user-service listening on port", PORT));
