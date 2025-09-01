const express = require("express");
const {
  createTask,
  getTasksByTasker,
  getTasksForCustomer,
  updateTaskStatus,
} = require("../controllers/taskController");

const router = express.Router();

router.post("/", createTask);
router.get("/tasker/:tasker_id", getTasksByTasker);
router.get("/customer/:customer_id", getTasksForCustomer);
router.put("/:id/status", updateTaskStatus);

module.exports = router;
