const express = require("express");
const {
  getOrCreateThread,
  getThreadsByUser,
  sendMessage,
  getMessagesByThread,
  markMessagesRead,
} = require("../controllers/chatController");
const verifyFirebaseToken = require("../../shared/middleware/auth");
const attachUser = require("../../shared/middleware/attachUser");
const pool = require("../db");

const router = express.Router();
const auth = [verifyFirebaseToken, attachUser(pool)];

router.post("/thread", ...auth, getOrCreateThread);
router.get("/threads", ...auth, getThreadsByUser);
router.post("/messages", ...auth, sendMessage);
router.get("/messages/:thread_id", ...auth, getMessagesByThread);
router.put("/messages/:thread_id/read", ...auth, markMessagesRead);

module.exports = router;
