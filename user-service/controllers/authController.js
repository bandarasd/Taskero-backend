const pool = require("../db");
const normalizePhone = require("../utils/phone");

// Register a new user after Firebase OTP verification.
// If a user with this phone_number or firebase_uid already exists, return them (idempotent).
exports.register = async (req, res) => {
  const {
    email,
    first_name,
    last_name,
    phone_number,
    role,
    avatar_url,
    bio,
    dob,
    gender,
    address_line1,
    address_line2,
    city,
    postal_code,
    location,
    preferences,
    settings,
  } = req.body;
  // firebase_uid comes from the verified token — not from the request body
  const firebase_uid = req.user.firebaseUid;

  try {
    if (phone_number) {
      const existing = await pool.query(
        "SELECT * FROM users WHERE phone_number = $1",
        [normalizePhone(phone_number)]
      );
      if (existing.rows.length > 0) return res.status(200).json(existing.rows[0]);
    }

    if (firebase_uid) {
      const existing = await pool.query(
        "SELECT * FROM users WHERE firebase_uid = $1",
        [firebase_uid]
      );
      if (existing.rows.length > 0) return res.status(200).json(existing.rows[0]);
    }

    const result = await pool.query(
      `INSERT INTO users
      (email, first_name, last_name, phone_number, role, firebase_uid, avatar_url, bio, dob, gender, address_line1, address_line2, city, postal_code, location, preferences, settings)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [
        email,
        first_name,
        last_name,
        phone_number || null,
        role || "customer",
        firebase_uid || null,
        avatar_url,
        bio,
        dob,
        gender,
        address_line1,
        address_line2,
        city,
        postal_code,
        location,
        preferences || {},
        settings || {},
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Register error:", error);
    if (error.code === "23505") {
      res.status(400).json({ error: "Email already exists" });
    } else {
      res.status(500).json({ error: "Database error" });
    }
  }
};
