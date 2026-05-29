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
  getConflicts,
  expireStaleRequests,
  cancelTask,
} = require("../controllers/taskController");
const verifyFirebaseToken = require("../../shared/middleware/auth");
const attachUser = require("../../shared/middleware/attachUser");
const { uploadTaskPhotos } = require("../middlewares/taskUploadMiddleware");
const pool = require("../db");

const router = express.Router();
const auth = [verifyFirebaseToken, attachUser(pool)];

router.post("/expire-stale", verifyFirebaseToken, expireStaleRequests);
router.post("/", ...auth, uploadTaskPhotos, createTask);
router.get("/tasker/:tasker_id", ...auth, getTasksByTasker);
router.get("/customer/:customer_id", ...auth, getTasksForCustomer);
router.get("/:id", ...auth, getTaskById);
router.put("/:id/status", ...auth, updateTaskStatus);
router.put("/:id/quote", ...auth, submitQuote);
router.put("/:id/quote/respond", ...auth, respondToQuote);
router.post("/:id/attachments", ...auth, uploadTaskPhotos, addTaskAttachments);
router.get("/:id/next-booking", ...auth, getNextBooking);
router.get("/:id/conflicts", ...auth, getConflicts);
router.post("/:id/running-late", ...auth, reportRunningLate);
router.post("/:id/delay-response", ...auth, respondToDelay);
router.post("/:id/cancel", ...auth, cancelTask);

module.exports = router;
