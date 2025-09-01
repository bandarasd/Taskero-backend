require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req, res) =>
  res.json({ status: "payment-service running" })
);

app.use("/payments", require("./routes/paymentRoutes"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("payment-service listening on port", PORT));
