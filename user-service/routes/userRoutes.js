const express = require("express");
const {
  getUsers,
  getUserById,
  getUserByPhone,
  getUserByFirebaseUid,
  createUser,
  updateUser,
  deleteUser,
  uploadProfilePicture,
  recordJobCompleted,
  recordNoShowCancellation,
} = require("../controllers/userController");
const { uploadSingle } = require("../middlewares/uploadMiddleware");
const verifyFirebaseToken = require("../../shared/middleware/auth");
const requireInternalKey = require("../../shared/middleware/internalAuth");

const router = express.Router();

// Public routes (no auth required)
router.get("/phone/:phoneNumber", getUserByPhone);
router.get("/firebase/:uid", getUserByFirebaseUid);
router.get("/:id", getUserById);

// Protected routes (require Firebase auth)
router.get("/", verifyFirebaseToken, getUsers);
router.post("/", verifyFirebaseToken, createUser);
router.put("/:id", verifyFirebaseToken, updateUser);
router.delete("/:id", verifyFirebaseToken, deleteUser);
router.post("/:id/upload-avatar", verifyFirebaseToken, uploadSingle, uploadProfilePicture);
router.post("/:id/stats/completed", requireInternalKey, recordJobCompleted);
router.post("/:id/stats/no-show", requireInternalKey, recordNoShowCancellation);

module.exports = router;
