const express = require("express");
const {
  submitVerification,
  getVerificationStatus,
} = require("../controllers/verificationController");

const router = express.Router();

router.post("/submit", submitVerification);
router.get("/status", getVerificationStatus);

module.exports = router;
