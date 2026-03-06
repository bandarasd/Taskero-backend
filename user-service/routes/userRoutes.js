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

const router = express.Router();

router.get("/", getUsers);
router.get("/phone/:phoneNumber", getUserByPhone);
router.get("/:id", getUserById);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

router.post("/:id/upload-avatar", uploadSingle, uploadProfilePicture);

module.exports = router;
