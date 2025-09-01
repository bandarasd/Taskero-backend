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

// Send message
exports.sendMessage = async (req, res) => {
  const { thread_id, sender_id, message_text, gig_id, task_id, attachments } =
    req.body;

  try {
    const result = await pool.query(
      `INSERT INTO messages (thread_id, sender_id, message_text, gig_id, task_id, attachments) VALUES($1, $2, $3, $4, $5, $6) RETURNING *`,
      [thread_id, sender_id, message_text, gig_id, task_id, attachments]
    );
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
      `SELECT * FROM messages WHERE thread_id = $1`,
      [thread_id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error getting messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
