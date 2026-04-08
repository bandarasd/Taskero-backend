const express = require("express");
const {
  createPayment,
  getPaymentByTask,
  markOfflinePaid,
} = require("../controllers/paymentController");
const verifyFirebaseToken = require("../../shared/middleware/auth");
const router = express.Router();

router.post("/", verifyFirebaseToken, createPayment);
router.get("/task/:task_id", verifyFirebaseToken, getPaymentByTask);
router.put("/offline/:id", verifyFirebaseToken, markOfflinePaid);

module.exports = router;
