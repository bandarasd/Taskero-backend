require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'notification-service running' }));

// Notification routes
const notificationRoutes = require('./routes/notificationRoutes');
app.use('/notifications', notificationRoutes);

const errorHandler = require('../shared/middleware/errorHandler');
app.use(errorHandler);

const PORT = process.env.PORT || 3006;
app.listen(PORT, () => console.log(`notification-service listening on port ${PORT}`));
