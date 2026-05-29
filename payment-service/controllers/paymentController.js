const pool = require("../db");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

/**
 * Create a Stripe PaymentIntent and return the client_secret to the iOS app.
 * The iOS app uses this secret with Stripe PaymentSheet to collect card details.
 */
exports.createPaymentIntent = async (req, res) => {
  const { task_id, amount, currency = "usd" } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  try {
    if (task_id) {
      const caller = await pool.query(
        "SELECT id FROM users WHERE firebase_uid = $1",
        [req.user.firebaseUid]
      );
      const callerId = caller.rows[0]?.id;
      const task = await pool.query("SELECT customer_id FROM tasks WHERE id = $1", [task_id]);
      if (!task.rows[0]) return res.status(404).json({ error: "Task not found" });
      if (task.rows[0].customer_id !== callerId) {
        return res.status(403).json({ error: "Forbidden: not your task" });
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // convert to cents
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: { task_id: task_id || "" },
    });

    res.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
    });
  } catch (err) {
    console.error("Error creating PaymentIntent:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Record a successfully confirmed Stripe payment in the DB.
 * Called by the iOS app after Stripe PaymentSheet completes successfully.
 * Idempotent: repeated calls with the same payment_intent_id are safe.
 */
exports.recordStripePayment = async (req, res) => {
  const { task_id, payment_intent_id, amount, currency = "usd" } = req.body;
  const callerId = req.user?.id;
  if (!callerId) return res.status(401).json({ error: "Unauthorized" });

  try {
    // Verify caller owns the task
    const taskRow = await pool.query("SELECT customer_id FROM tasks WHERE id = $1", [task_id]);
    if (!taskRow.rows[0]) return res.status(404).json({ error: "Task not found" });
    if (taskRow.rows[0].customer_id !== callerId) return res.status(403).json({ error: "Forbidden" });

    // Verify the PaymentIntent status with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({ error: `Payment not succeeded: ${paymentIntent.status}` });
    }
    // Ensure the PI is for this task
    if (paymentIntent.metadata?.task_id && paymentIntent.metadata.task_id !== task_id) {
      return res.status(400).json({ error: "PaymentIntent does not match task" });
    }

    const receiptUrl =
      paymentIntent.latest_charge
        ? (await stripe.charges.retrieve(paymentIntent.latest_charge)).receipt_url
        : null;

    // Idempotent insert: ON CONFLICT returns existing row
    const result = await pool.query(
      `INSERT INTO payments
        (task_id, payment_method, amount, currency, status, stripe_payment_intent_id, stripe_receipt_url, paid_at)
       VALUES ($1,$2,$3,$4,'paid',$5,$6,NOW())
       ON CONFLICT (stripe_payment_intent_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [task_id, "card", amount, currency, payment_intent_id, receiptUrl]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error recording payment:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Create an offline payment record (card payments use createPaymentIntent + Stripe PaymentSheet)
 */
exports.createPayment = async (req, res) => {
  const { task_id, amount, currency = "LKR", payment_method } = req.body;

  if (payment_method !== "offline") {
    return res.status(400).json({ error: "Use /create-payment-intent for card payments" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO payments
      (task_id, payment_method, amount, currency, status, stripe_payment_intent_id, stripe_receipt_url, paid_at)
      VALUES ($1,$2,$3,$4,'pending',NULL,NULL,NULL) RETURNING *`,
      [task_id, payment_method, amount, currency]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating payment:", err);
    res.status(500).json({ error: "Payment failed", details: err.message });
  }
};

/**
 * Get payments for a specific task (caller must be customer or tasker)
 */
exports.getPaymentByTask = async (req, res) => {
  const { task_id } = req.params;
  const callerId = req.user?.id;
  if (!callerId) return res.status(401).json({ error: "Unauthorized" });
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  try {
    const taskRow = await pool.query("SELECT customer_id, tasker_id FROM tasks WHERE id = $1", [task_id]);
    if (!taskRow.rows[0]) return res.status(404).json({ error: "Task not found" });
    const { customer_id, tasker_id } = taskRow.rows[0];
    if (callerId !== customer_id && callerId !== tasker_id) return res.status(403).json({ error: "Forbidden" });

    const [countResult, result] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM payments WHERE task_id = $1`, [task_id]),
      pool.query(`SELECT * FROM payments WHERE task_id = $1 LIMIT $2 OFFSET $3`, [task_id, limit, offset]),
    ]);
    const total = parseInt(countResult.rows[0].count);
    res.status(200).json({ data: result.rows, pagination: { page, limit, total, hasMore: page * limit < total } });
  } catch (err) {
    console.error("Error fetching payments:", err);
    res.status(500).json({ error: "Database error" });
  }
};

/**
 * Get all payments for a tasker (caller must be that tasker)
 */
exports.getPaymentsByTasker = async (req, res) => {
  const { tasker_id } = req.params;
  const callerId = req.user?.id;
  if (!callerId) return res.status(401).json({ error: "Unauthorized" });
  if (callerId !== tasker_id) return res.status(403).json({ error: "Forbidden" });
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  try {
    const [countResult, result] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM payments p JOIN tasks t ON t.id = p.task_id WHERE t.tasker_id = $1`, [tasker_id]),
      pool.query(
        `SELECT p.*, COALESCE(t.final_price, t.quoted_price, p.amount) AS amount
         FROM payments p
         JOIN tasks t ON t.id = p.task_id
         WHERE t.tasker_id = $1
         ORDER BY p.created_at DESC
         LIMIT $2 OFFSET $3`,
        [tasker_id, limit, offset]
      ),
    ]);
    const total = parseInt(countResult.rows[0].count);
    res.status(200).json({ data: result.rows, pagination: { page, limit, total, hasMore: page * limit < total } });
  } catch (err) {
    console.error("Error fetching tasker payments:", err);
    res.status(500).json({ error: "Database error" });
  }
};

/**
 * Issue a full refund for a task's card payment. Internal use only.
 * Wrapped in a transaction with FOR UPDATE to prevent double-refunds.
 */
exports.refundPayment = async (req, res) => {
  const { taskId } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT * FROM payments WHERE task_id = $1 AND payment_method != 'offline' FOR UPDATE LIMIT 1`,
      [taskId]
    );
    if (!result.rows.length) {
      await client.query("COMMIT");
      return res.status(200).json({ refunded: false, reason: "no_card_payment" });
    }
    const payment = result.rows[0];
    if (payment.status === 'refunded') {
      await client.query("COMMIT");
      return res.status(200).json({ refunded: true, reason: "already_refunded" });
    }
    if (payment.status !== 'paid') {
      await client.query("COMMIT");
      return res.status(200).json({ refunded: false, reason: "payment_not_paid" });
    }
    await stripe.refunds.create({ payment_intent: payment.stripe_payment_intent_id });
    await client.query(
      `UPDATE payments SET status = 'refunded', refunded_at = NOW() WHERE id = $1`,
      [payment.id]
    );
    await client.query("COMMIT");
    return res.status(200).json({ refunded: true });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error issuing refund:", err);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

/**
 * Issue an 80% partial refund for a task's card payment when customer cancels.
 * Internal use only. Uses FOR UPDATE to prevent double-refunds.
 */
exports.partialRefundPayment = async (req, res) => {
  const { taskId } = req.params;
  const percentage = 80;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT * FROM payments WHERE task_id = $1 AND payment_method != 'offline' FOR UPDATE LIMIT 1`,
      [taskId]
    );
    if (!result.rows.length) {
      await client.query("COMMIT");
      return res.status(200).json({ refunded: false, reason: "no_card_payment" });
    }
    const payment = result.rows[0];
    if (payment.status === "refunded" || payment.status === "partially_refunded") {
      await client.query("COMMIT");
      return res.status(200).json({ refunded: true, reason: "already_refunded" });
    }
    if (payment.status !== "paid") {
      await client.query("COMMIT");
      return res.status(200).json({ refunded: false, reason: "payment_not_paid" });
    }
    const refundAmount = Math.round(payment.amount * (percentage / 100) * 100); // Stripe uses smallest currency unit
    await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
      amount: refundAmount,
    });
    await client.query(
      `UPDATE payments SET status = 'partially_refunded', refunded_at = NOW(),
        refund_amount = $2, refund_percentage = $3 WHERE id = $1`,
      [payment.id, payment.amount * (percentage / 100), percentage]
    );
    await client.query("COMMIT");
    return res.status(200).json({ refunded: true, refund_percentage: percentage });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error issuing partial refund:", err);
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

/**
 * Mark an offline payment as paid
 */
exports.markOfflinePaid = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE payments 
       SET status='paid', paid_at=NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error updating payment:", err);
    res.status(500).json({ error: "Database error" });
  }
};
