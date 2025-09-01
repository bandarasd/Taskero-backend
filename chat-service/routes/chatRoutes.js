const express = require("express");
const {
  getOrCreateThread,
  sendMessage,
  getMessagesByThread,
} = require("../controllers/chatController");

const router = express.Router();

router.post("/thread", getOrCreateThread);
router.post("/messages", sendMessage);
router.get("/messages/:thread_id", getMessagesByThread);

module.exports = router;
