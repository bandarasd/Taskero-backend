const pool = require("../db");

// Get or create thread
exports.getOrCreateThread = async (req, res) => {
  const { customer_id, tasker_id } = req.body;

  try {
    let thread = await pool.query(
      `SELECT * FROM chat_threads WHERE customer_id = $1 AND tasker_id = $2`,
      [customer_id, tasker_id]
    );

    if (thread.rows.length === 0) {
      const result = await pool.query(
        `INSERT INTO chat_threads (customer_id, tasker_id) VALUES ($1, $2) RETURNING *`,
        [customer_id, tasker_id]
      );
      thread = result;
    }

    res.status(200).json(thread.rows[0]);
  } catch (error) {
    console.error("Error getting or creating thread:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get all threads for a user (as customer or tasker)
exports.getThreadsByUser = async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT ct.*,
              c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.avatar_url AS customer_avatar,
              t.first_name AS tasker_first_name, t.last_name AS tasker_last_name, t.avatar_url AS tasker_avatar
       FROM chat_threads ct
       JOIN users c ON ct.customer_id = c.id
       JOIN users t ON ct.tasker_id = t.id
       WHERE ct.customer_id = $1 OR ct.tasker_id = $1
       ORDER BY ct.created_at DESC`,
      [user_id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching threads:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Send message
exports.sendMessage = async (req, res) => {
  const { thread_id, sender_id, message_text, attachments } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO messages (thread_id, sender_id, message_text, attachments) VALUES($1, $2, $3, $4) RETURNING *`,
      [thread_id, sender_id, message_text, attachments || []]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Get messages by thread
exports.getMessagesByThread = async (req, res) => {
  const { thread_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM messages WHERE thread_id = $1 ORDER BY created_at ASC`,
      [thread_id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error getting messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
