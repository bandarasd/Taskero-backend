const express = require("express");
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  uploadProfilePicture,
} = require("../controllers/userController");
const { uploadSingle } = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.get("/", getUsers);
router.get("/:id", getUserById);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

// Profile picture upload route
router.post("/:id/upload-avatar", uploadSingle, uploadProfilePicture);

module.exports = router;
