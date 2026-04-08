const pool = require("../db");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
