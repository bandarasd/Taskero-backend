const express = require("express");
const {
  getUsers,
  getUserById,
  getUserByPhone,
  getUserByFirebaseUid,
  updateUser,
  deleteUser,
  uploadProfilePicture,
  recordJobCompleted,
  recordNoShowCancellation,
  incrementCancellationCount,
} = require("../controllers/userController");
const { uploadSingle } = require("../middlewares/uploadMiddleware");
const verifyFirebaseToken = require("../../shared/middleware/auth");
const attachUser = require("../../shared/middleware/attachUser");
const requireInternalKey = require("../../shared/middleware/internalAuth");
const rateLimit = require("express-rate-limit");
const pool = require("../db");

const router = express.Router();
const auth = [verifyFirebaseToken, attachUser(pool)];

const lookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

// Public routes (no auth required)
router.get("/phone/:phoneNumber", lookupLimiter, getUserByPhone);
router.get("/firebase/:uid", lookupLimiter, getUserByFirebaseUid);
router.get("/:id", getUserById);

// Protected routes (require Firebase auth)
router.get("/", ...auth, getUsers);
router.put("/:id", ...auth, updateUser);
router.delete("/:id", ...auth, deleteUser);
router.post("/:id/upload-avatar", ...auth, uploadSingle, uploadProfilePicture);
router.post("/:id/stats/completed", requireInternalKey, recordJobCompleted);
router.post("/:id/stats/no-show", requireInternalKey, recordNoShowCancellation);
router.post("/:id/increment-cancellations", requireInternalKey, incrementCancellationCount);

module.exports = router;
