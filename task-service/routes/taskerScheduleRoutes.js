const express = require("express");
const {
  getSchedule,
  upsertSchedule,
  getAvailableSlots,
} = require("../controllers/taskerScheduleController");
const verifyFirebaseToken = require("../../shared/middleware/auth");

const router = express.Router();

router.get("/:tasker_id/schedule", verifyFirebaseToken, getSchedule);
router.put("/:tasker_id/schedule", verifyFirebaseToken, upsertSchedule);
router.get("/:tasker_id/available-slots", verifyFirebaseToken, getAvailableSlots);

module.exports = router;
