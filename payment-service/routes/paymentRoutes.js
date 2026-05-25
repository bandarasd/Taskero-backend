const express = require("express");
const {
  createPayment,
  getPaymentByTask,
  getPaymentsByTasker,
  markOfflinePaid,
  createPaymentIntent,
  recordStripePayment,
  refundPayment,
} = require("../controllers/paymentController");
const verifyFirebaseToken = require("../../shared/middleware/auth");
const requireInternalKey = require("../../shared/middleware/internalAuth");
const router = express.Router();

router.post("/create-intent", verifyFirebaseToken, createPaymentIntent);
router.post("/record", verifyFirebaseToken, recordStripePayment);
router.post("/", verifyFirebaseToken, createPayment);
router.get("/task/:task_id", verifyFirebaseToken, getPaymentByTask);
router.get("/tasker/:tasker_id", verifyFirebaseToken, getPaymentsByTasker);
router.put("/offline/:id", verifyFirebaseToken, markOfflinePaid);
router.post("/refund/:taskId", requireInternalKey, refundPayment);

module.exports = router;
