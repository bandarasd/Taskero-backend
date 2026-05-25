require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

// Health check
app.get("/health", (req, res) =>
  res.json({ status: "search-service running" })
);

app.use("/search", require("./routes/searchRoute"));

const errorHandler = require('../shared/middleware/errorHandler');
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("search-service listening on port", PORT));
