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
const attachUser = require("../../shared/middleware/attachUser");
const requireAdmin = require("../middlewares/adminAuth");
const pool = require("../db");

const router = express.Router();
const auth = [verifyFirebaseToken, attachUser(pool)];

// Admin routes must be registered before parameterized /:userId routes
router.get("/admin/pending", ...auth, requireAdmin, getPendingVerifications);
router.put("/admin/:id/approve", ...auth, requireAdmin, approveVerification);
router.put("/admin/:id/reject", ...auth, requireAdmin, rejectVerification);

// User verification routes
router.post("/:userId/submit", ...auth, uploadVerificationDocuments, submitVerification);
router.post("/:userId/submit-single", ...auth, uploadSingleDocument, submitVerification);
router.get("/:userId/status", ...auth, getVerificationStatus);
router.get("/:userId/all", ...auth, getAllVerifications);

module.exports = router;
