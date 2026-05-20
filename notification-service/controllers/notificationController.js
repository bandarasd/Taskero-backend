const pool = require("../db");

// Register FCM token — derives user from Firebase token, ignores client-supplied user_id
exports.registerToken = async (req, res) => {
  const { fcm_token } = req.body;
  if (!fcm_token) {
    return res.status(400).json({ error: "fcm_token is required" });
  }
  try {
    await pool.query(
      `UPDATE users SET fcm_token = $1 WHERE firebase_uid = $2`,
      [fcm_token, req.user.firebaseUid]
    );
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error registering FCM token:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get notifications — only returns notifications belonging to the authenticated user
exports.getNotifications = async (req, res) => {
  const { user_id } = req.params;
  try {
    const userResult = await pool.query(
      `SELECT id FROM users WHERE firebase_uid = $1`,
      [req.user.firebaseUid]
    );
    if (userResult.rows.length === 0 || userResult.rows[0].id !== user_id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [user_id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Mark notification as read — only if the notification belongs to the authenticated user
exports.markRead = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = true
       WHERE id = $1
         AND user_id = (SELECT id FROM users WHERE firebase_uid = $2)
       RETURNING *`,
      [id, req.user.firebaseUid]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Notification not found or unauthorized" });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Create a notification (called internally by other services via x-internal-key)
exports.createNotification = async (req, res) => {
  const { user_id, title, body, type, data } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, title, body, type, data) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user_id, title, body, type, data || {}]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
