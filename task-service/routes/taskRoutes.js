const express = require("express");
const {
  createTask,
  getTaskById,
  getTasksByTasker,
  getTasksForCustomer,
  updateTaskStatus,
  submitQuote,
  respondToQuote,
} = require("../controllers/taskController");
const verifyFirebaseToken = require("../../shared/middleware/auth");
const { uploadTaskPhotos } = require("../middlewares/taskUploadMiddleware");

const router = express.Router();

router.post("/", verifyFirebaseToken, uploadTaskPhotos, createTask);
router.get("/tasker/:tasker_id", verifyFirebaseToken, getTasksByTasker);
router.get("/customer/:customer_id", verifyFirebaseToken, getTasksForCustomer);
router.get("/:id", verifyFirebaseToken, getTaskById);
router.put("/:id/status", verifyFirebaseToken, updateTaskStatus);
router.put("/:id/quote", verifyFirebaseToken, submitQuote);
router.put("/:id/quote/respond", verifyFirebaseToken, respondToQuote);

module.exports = router;
