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
const verifyFirebaseToken = require("../../shared/middleware/auth");

const router = express.Router();

// All verification routes require authentication
router.post("/:userId/submit", verifyFirebaseToken, uploadVerificationDocuments, submitVerification);
router.post("/:userId/submit-single", verifyFirebaseToken, uploadSingleDocument, submitVerification);
router.get("/:userId/status", verifyFirebaseToken, getVerificationStatus);
router.get("/:userId/all", verifyFirebaseToken, getAllVerifications);

// Admin verification routes
router.get("/admin/pending", verifyFirebaseToken, getPendingVerifications);
router.put("/admin/:id/approve", verifyFirebaseToken, approveVerification);
router.put("/admin/:id/reject", verifyFirebaseToken, rejectVerification);

module.exports = router;
