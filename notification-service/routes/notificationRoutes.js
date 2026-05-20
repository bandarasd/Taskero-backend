const express = require("express");
const {
  registerToken,
  getNotifications,
  markRead,
  createNotification,
} = require("../controllers/notificationController");
const verifyFirebaseToken = require("../../shared/middleware/auth");
const requireInternalKey = require("../../shared/middleware/internalAuth");

const router = express.Router();

router.post("/register-token", verifyFirebaseToken, registerToken);
router.get("/:user_id", verifyFirebaseToken, getNotifications);
router.put("/:id/read", verifyFirebaseToken, markRead);

// Internal route — requires x-internal-key header matching INTERNAL_API_KEY env var
router.post("/internal/create", requireInternalKey, createNotification);

module.exports = router;
