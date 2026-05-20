const express = require("express");
const {
  getOrCreateThread,
  getThreadsByUser,
  sendMessage,
  getMessagesByThread,
  markMessagesRead,
} = require("../controllers/chatController");
const verifyFirebaseToken = require("../../shared/middleware/auth");

const router = express.Router();

router.post("/thread", verifyFirebaseToken, getOrCreateThread);
router.get("/threads/:user_id", verifyFirebaseToken, getThreadsByUser);
router.post("/messages", verifyFirebaseToken, sendMessage);
router.get("/messages/:thread_id", verifyFirebaseToken, getMessagesByThread);
router.put("/messages/:thread_id/read", verifyFirebaseToken, markMessagesRead);

module.exports = router;
