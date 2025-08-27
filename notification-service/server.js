require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'notification-service running' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log('notification-service listening on port', PORT));
