const bcrypt = require("bcryptjs");
const pool = require("../db");

// Normalize phone: decodeURIComponent turns '+' into a space, so we fix it back
const normalizePhone = (raw) => {
  let p = decodeURIComponent(String(raw)).trim();
  // After decoding, a leading space means the original was a '+'
  if (p.startsWith(" ")) p = "+" + p.slice(1);
  if (!p.startsWith("+")) p = "+" + p;
  return p;
};

// Login user
exports.login = async (req, res) => {
  const { phone_number, password } = req.body;
  const phoneNumber = normalizePhone(phone_number);

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE phone_number = $1",
      [phoneNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];

    // Check password
    if (!user.password_hash) {
      return res.status(400).json({ error: "Password not set for this account. Please verify via OTP." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid password" });
    }

    // In a real app, you'd generate a JWT here. 
    // For now, returning user info as per existing pattern.
    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        phone_number: user.phone_number,
        role: user.role,
        avatar_url: user.avatar_url
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Database error" });
  }
};
