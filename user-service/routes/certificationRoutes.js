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
const attachUser = require("../../shared/middleware/attachUser");
const requireAdmin = require("../middlewares/adminAuth");
const pool = require("../db");

const router = express.Router();
const auth = [verifyFirebaseToken, attachUser(pool)];

// Admin routes — registered before parameterized /:userId routes
router.get("/admin/pending", ...auth, requireAdmin, getPendingCertifications);
router.put("/admin/:id/approve", ...auth, requireAdmin, approveCertification);
router.put("/admin/:id/reject", ...auth, requireAdmin, rejectCertification);

// Worker routes
router.post("/:userId/certifications", ...auth, uploadSingleDocument, submitCertification);
router.get("/:userId/certifications", ...auth, getWorkerCertifications);

module.exports = router;
