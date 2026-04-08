const express = require("express");
const {
  getUsers,
  getUserById,
  getUserByPhone,
  createUser,
  updateUser,
  deleteUser,
  uploadProfilePicture,
} = require("../controllers/userController");
const { uploadSingle } = require("../middlewares/uploadMiddleware");
const verifyFirebaseToken = require("../../shared/middleware/auth");

const router = express.Router();

// Public routes (no auth required)
router.get("/phone/:phoneNumber", getUserByPhone);
router.get("/:id", getUserById);
router.post("/", createUser);

// Protected routes (require Firebase auth)
router.get("/", verifyFirebaseToken, getUsers);
router.put("/:id", verifyFirebaseToken, updateUser);
router.delete("/:id", verifyFirebaseToken, deleteUser);
router.post("/:id/upload-avatar", verifyFirebaseToken, uploadSingle, uploadProfilePicture);

module.exports = router;
