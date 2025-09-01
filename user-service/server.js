require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
<<<<<<< Updated upstream
app.get('/health', (req, res) => res.json({ status: 'user-service running' }));
=======
app.get("/health", (req, res) => res.json({ status: "User service running" }));

// User routes
app.use("/users", userRoutes);
>>>>>>> Stashed changes

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('user-service listening on port', PORT));
