const express = require("express");
const {
  createTask,
  getTaskById,
  getTasksByTasker,
  getTasksForCustomer,
  updateTaskStatus,
  submitQuote,
  respondToQuote,
  addTaskAttachments,
  reportRunningLate,
  respondToDelay,
  getNextBooking,
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
router.patch("/:id/attachments", verifyFirebaseToken, uploadTaskPhotos, addTaskAttachments);
router.get("/:id/next-booking", verifyFirebaseToken, getNextBooking);
router.post("/:id/running-late", verifyFirebaseToken, reportRunningLate);
router.post("/:id/delay-response", verifyFirebaseToken, respondToDelay);

module.exports = router;
