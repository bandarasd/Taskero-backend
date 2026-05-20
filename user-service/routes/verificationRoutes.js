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
const requireAdmin = require("../middlewares/adminAuth");

const router = express.Router();

// Admin routes must be registered before parameterized /:userId routes
router.get("/admin/pending", verifyFirebaseToken, requireAdmin, getPendingVerifications);
router.put("/admin/:id/approve", verifyFirebaseToken, requireAdmin, approveVerification);
router.put("/admin/:id/reject", verifyFirebaseToken, requireAdmin, rejectVerification);

// User verification routes
router.post("/:userId/submit", verifyFirebaseToken, uploadVerificationDocuments, submitVerification);
router.post("/:userId/submit-single", verifyFirebaseToken, uploadSingleDocument, submitVerification);
router.get("/:userId/status", verifyFirebaseToken, getVerificationStatus);
router.get("/:userId/all", verifyFirebaseToken, getAllVerifications);

module.exports = router;
