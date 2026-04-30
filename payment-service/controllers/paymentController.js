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
 */
exports.recordStripePayment = async (req, res) => {
  const { task_id, payment_intent_id, amount, currency = "usd" } = req.body;

  try {
    // Verify the PaymentIntent status with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({ error: `Payment not succeeded: ${paymentIntent.status}` });
    }

    const receiptUrl =
      paymentIntent.latest_charge
        ? (await stripe.charges.retrieve(paymentIntent.latest_charge)).receipt_url
        : null;

    const result = await pool.query(
      `INSERT INTO payments
        (task_id, payment_method, amount, currency, status, stripe_payment_intent_id, stripe_receipt_url, paid_at)
       VALUES ($1,$2,$3,$4,'paid',$5,$6,NOW()) RETURNING *`,
      [task_id, "card", amount, currency, payment_intent_id, receiptUrl]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error recording payment:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * Create a payment (Stripe test card or offline)
 */
exports.createPayment = async (req, res) => {
  const { task_id, amount, currency = "LKR", payment_method } = req.body;

  try {
    let stripePaymentId = null;
    let receiptUrl = null;
    let status = "pending";
    let paidAt = null;

    if (payment_method === "card") {
      // Backend-only testing: create and confirm PaymentIntent with test card
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: "lkr",
        payment_method_data: {
          type: "card",
          card: {
            number: "4242424242424242",
            exp_month: 12,
            exp_year: 2025,
            cvc: "123",
          },
        },
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never", // prevents Stripe from requiring return_url
        },
      });

      stripePaymentId = paymentIntent.id;
      receiptUrl = paymentIntent.charges.data[0]?.receipt_url || null;
      status = "paid";
      paidAt = new Date();
    } else if (payment_method === "offline") {
      status = "pending"; // Will mark as paid later
    } else {
      return res.status(400).json({ error: "Invalid payment method" });
    }

    // Save payment in DB
    const result = await pool.query(
      `INSERT INTO payments
      (task_id, payment_method, amount, currency, status, stripe_payment_intent_id, stripe_receipt_url, paid_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        task_id,
        payment_method,
        amount,
        currency,
        status,
        stripePaymentId,
        receiptUrl,
        paidAt,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Error creating payment:", err);
    res.status(500).json({ error: "Payment failed", details: err.message });
  }
};

/**
 * Get payments for a specific task
 */
exports.getPaymentByTask = async (req, res) => {
  const { task_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM payments WHERE task_id = $1`,
      [task_id]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching payments:", err);
    res.status(500).json({ error: "Database error" });
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
