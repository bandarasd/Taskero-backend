const express = require("express");
const {
  registerToken,
  getNotifications,
  markRead,
  createNotification,
} = require("../controllers/notificationController");
const verifyFirebaseToken = require("../../shared/middleware/auth");

const router = express.Router();

router.post("/register-token", verifyFirebaseToken, registerToken);
router.get("/:user_id", verifyFirebaseToken, getNotifications);
router.put("/:id/read", verifyFirebaseToken, markRead);

// Internal route (called by other services, no user auth needed)
router.post("/internal/create", createNotification);

module.exports = router;
