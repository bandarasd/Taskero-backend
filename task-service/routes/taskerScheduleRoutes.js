const express = require("express");
const {
  getSchedule,
  upsertSchedule,
  getAvailableSlots,
} = require("../controllers/taskerScheduleController");
const verifyFirebaseToken = require("../../shared/middleware/auth");
const attachUser = require("../../shared/middleware/attachUser");
const pool = require("../db");

const router = express.Router();
const auth = [verifyFirebaseToken, attachUser(pool)];

router.get("/:tasker_id/schedule", ...auth, getSchedule);
router.put("/:tasker_id/schedule", ...auth, upsertSchedule);
router.get("/:tasker_id/available-slots", ...auth, getAvailableSlots);

module.exports = router;
