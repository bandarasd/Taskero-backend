const pool = require("../db");

const normalizePhone = require("../utils/phone");

// Get all users
exports.getUsers = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  try {
    const [countResult, result] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users"),
      pool.query("SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2", [limit, offset]),
    ]);
    const total = parseInt(countResult.rows[0].count);
    res.json({ data: result.rows, pagination: { page, limit, total, hasMore: page * limit < total } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
};

// Lookup user by Firebase UID
exports.getUserByFirebaseUid = async (req, res) => {
  const { uid } = req.params;
  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE firebase_uid = $1",
      [uid]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
};

// Get a user by ID
exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
};

// Lookup user by phone number
exports.getUserByPhone = async (req, res) => {
  const phoneNumber = normalizePhone(req.params.phoneNumber);
  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE phone_number = $1",
      [phoneNumber]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
};


const UPDATABLE_USER_FIELDS = new Set([
  "email", "first_name", "last_name", "phone_number", "avatar_url", "bio",
  "dob", "gender", "address_line1", "address_line2", "city", "postal_code",
  "location", "preferences", "settings",
]);

// Update a user
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const callerId = req.user?.id;
  if (!callerId) return res.status(401).json({ error: "Unauthorized" });
  if (callerId !== id) return res.status(403).json({ error: "Forbidden" });
  const raw = req.body;

  const fields = Object.fromEntries(
    Object.entries(raw).filter(([k]) => UPDATABLE_USER_FIELDS.has(k))
  );

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ error: "No valid fields to update" });
  }

  const setQuery = Object.keys(fields)
    .map((key, idx) => `${key} = $${idx + 1}`)
    .join(", ");
  const values = Object.values(fields);

  try {
    const result = await pool.query(
      `UPDATE users SET ${setQuery}, updated_at = NOW() WHERE id = $${
        values.length + 1
      } RETURNING *`,
      [...values, id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
};

// Delete a user
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  const callerId = req.user?.id;
  if (!callerId) return res.status(401).json({ error: "Unauthorized" });
  if (callerId !== id) return res.status(403).json({ error: "Forbidden" });
  try {
    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted", user: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
};

// Upload profile picture
exports.uploadProfilePicture = async (req, res) => {
  const { id } = req.params;
  const callerId = req.user?.id;
  if (!callerId) return res.status(401).json({ error: "Unauthorized" });
  if (callerId !== id) return res.status(403).json({ error: "Forbidden" });

  try {
    // Check if user exists
    const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [
      id,
    ]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Get the Cloudinary URL from the uploaded file
    const avatarUrl = req.file.path;

    // Update user's avatar_url in database
    const result = await pool.query(
      "UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2 RETURNING id, first_name, last_name, email, avatar_url",
      [avatarUrl, id]
    );

    res.json({
      message: "Profile picture uploaded successfully",
      user: result.rows[0],
      cloudinary_url: avatarUrl,
    });
  } catch (error) {
    console.error("Profile picture upload error:", error);
    res.status(500).json({ error: "Failed to upload profile picture" });
  }
};


exports.recordJobCompleted = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE users
       SET completed_jobs = completed_jobs + 1,
           completion_rate = ROUND(
             (completed_jobs + 1)::numeric /
             NULLIF(completed_jobs + 1 + no_show_cancellations, 0) * 100, 1
           )
       WHERE id = $1`,
      [id]
    );
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error recording job completed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.recordNoShowCancellation = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE users
       SET no_show_cancellations = no_show_cancellations + 1,
           completion_rate = ROUND(
             completed_jobs::numeric /
             NULLIF(completed_jobs + no_show_cancellations + 1, 0) * 100, 1
           )
       WHERE id = $1`,
      [id]
    );
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error recording no-show cancellation:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.incrementCancellationCount = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE users SET cancellation_count = cancellation_count + 1 WHERE id = $1 RETURNING cancellation_count`,
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "User not found" });
    res.status(200).json({ ok: true, cancellation_count: result.rows[0].cancellation_count });
  } catch (err) {
    console.error("Error incrementing cancellation count:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
