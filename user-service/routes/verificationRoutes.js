const express = require("express");
const {
  submitVerification,
  getVerificationStatus,
  getAllVerifications,
  getPendingVerifications,
  approveVerification,
  rejectVerification,
} = require("../controllers/verificationController");
const {
  uploadVerificationDocuments,
  uploadSingleDocument,
} = require("../middlewares/verificationUploadMiddleware");

const router = express.Router();

// User verification routes
router.post("/:userId/submit", uploadVerificationDocuments, submitVerification);
router.post("/:userId/submit-single", uploadSingleDocument, submitVerification);
router.get("/:userId/status", getVerificationStatus);
router.get("/:userId/all", getAllVerifications);

// Admin verification routes
router.get("/admin/pending", getPendingVerifications);
router.put("/admin/:id/approve", approveVerification);
router.put("/admin/:id/reject", rejectVerification);

module.exports = router;
