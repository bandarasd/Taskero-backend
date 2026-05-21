const express = require("express");
const {
  submitCertification,
  getWorkerCertifications,
  getPendingCertifications,
  approveCertification,
  rejectCertification,
} = require("../controllers/certificationController");
const { uploadSingleDocument } = require("../middlewares/verificationUploadMiddleware");
const verifyFirebaseToken = require("../../shared/middleware/auth");
const requireAdmin = require("../middlewares/adminAuth");

const router = express.Router();

// Admin routes — registered before parameterized /:userId routes
router.get("/admin/pending", verifyFirebaseToken, requireAdmin, getPendingCertifications);
router.put("/admin/:id/approve", verifyFirebaseToken, requireAdmin, approveCertification);
router.put("/admin/:id/reject", verifyFirebaseToken, requireAdmin, rejectCertification);

// Worker routes
router.post("/:userId/certifications", verifyFirebaseToken, uploadSingleDocument, submitCertification);
router.get("/:userId/certifications", verifyFirebaseToken, getWorkerCertifications);

module.exports = router;
