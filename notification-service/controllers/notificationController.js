const pool = require("../db");

// Register FCM token for push notifications
exports.registerToken = async (req, res) => {
  const { user_id, fcm_token } = req.body;
  if (!user_id || !fcm_token) {
    return res.status(400).json({ error: "user_id and fcm_token are required" });
  }

  try {
    await pool.query(`UPDATE users SET fcm_token = $1 WHERE id = $2`, [fcm_token, user_id]);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error registering FCM token:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get notifications for a user
exports.getNotifications = async (req, res) => {
  const { user_id } = req.params;
  try {
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

// Mark notification as read
exports.markRead = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Create a notification (called internally by other services)
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
