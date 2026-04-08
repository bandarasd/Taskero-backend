const express = require("express");
const {
  createTask,
  getTaskById,
  getTasksByTasker,
  getTasksForCustomer,
  updateTaskStatus,
} = require("../controllers/taskController");
const verifyFirebaseToken = require("../../shared/middleware/auth");

const router = express.Router();

router.post("/", verifyFirebaseToken, createTask);
router.get("/tasker/:tasker_id", verifyFirebaseToken, getTasksByTasker);
router.get("/customer/:customer_id", verifyFirebaseToken, getTasksForCustomer);
router.get("/:id", verifyFirebaseToken, getTaskById);
router.put("/:id/status", verifyFirebaseToken, updateTaskStatus);

module.exports = router;
