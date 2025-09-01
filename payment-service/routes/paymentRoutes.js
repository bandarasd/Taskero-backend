const express = require("express");
const {
  createPayment,
  getPaymentByTask,
  markOfflinePaid,
} = require("../controllers/paymentController");
const router = express.Router();

router.post("/", createPayment); // Create a payment (Stripe or offline)
router.get("/task/:task_id", getPaymentByTask); // Get payment info for a task
router.put("/offline/:id", markOfflinePaid); // Mark offline payment as paid

module.exports = router;
