const express = require("express");
const {
  createPayment,
  getPaymentByTask,
  getPaymentsByTasker,
  markOfflinePaid,
  createPaymentIntent,
  recordStripePayment,
  refundPayment,
  partialRefundPayment,
} = require("../controllers/paymentController");
const verifyFirebaseToken = require("../../shared/middleware/auth");
const attachUser = require("../../shared/middleware/attachUser");
const requireInternalKey = require("../../shared/middleware/internalAuth");
const pool = require("../db");
const router = express.Router();
const auth = [verifyFirebaseToken, attachUser(pool)];

router.post("/create-intent", ...auth, createPaymentIntent);
router.post("/record", ...auth, recordStripePayment);
router.post("/", ...auth, createPayment);
router.get("/task/:task_id", ...auth, getPaymentByTask);
router.get("/tasker/:tasker_id", ...auth, getPaymentsByTasker);
router.put("/offline/:id", ...auth, markOfflinePaid);
router.post("/refund/:taskId", requireInternalKey, refundPayment);
router.post("/partial-refund/:taskId", requireInternalKey, partialRefundPayment);

module.exports = router;
