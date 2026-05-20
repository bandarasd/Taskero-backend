const pool = require("../db");
const { notifyUser } = require("../utils/notify");

exports.getOrCreateThread = async (req, res) => {
  const { customer_id, tasker_id } = req.body;
  try {
    let result = await pool.query(
      `SELECT * FROM chat_threads WHERE customer_id = $1 AND tasker_id = $2`,
      [customer_id, tasker_id]
    );
    if (result.rows.length === 0) {
      result = await pool.query(
        `INSERT INTO chat_threads (customer_id, tasker_id) VALUES ($1, $2) RETURNING *`,
        [customer_id, tasker_id]
      );
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error getting or creating thread:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getThreadsByUser = async (req, res) => {
  const { user_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT
        ct.id, ct.customer_id, ct.tasker_id, ct.task_id, ct.gig_id, ct.created_at,
        c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.avatar_url AS customer_avatar,
        t.first_name AS tasker_first_name, t.last_name AS tasker_last_name, t.avatar_url AS tasker_avatar,
        (SELECT message_text FROM messages WHERE thread_id = ct.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT created_at FROM messages WHERE thread_id = ct.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
        (SELECT COUNT(*) FROM messages WHERE thread_id = ct.id AND sender_id != $1 AND is_read = false)::int AS unread_count
       FROM chat_threads ct
       JOIN users c ON ct.customer_id = c.id
       JOIN users t ON ct.tasker_id = t.id
       WHERE ct.customer_id = $1 OR ct.tasker_id = $1
       ORDER BY last_message_at DESC NULLS LAST, ct.created_at DESC`,
      [user_id]
    );

    const threads = result.rows.map((r) => ({
      id: r.id,
      customer_id: r.customer_id,
      tasker_id: r.tasker_id,
      task_id: r.task_id,
      gig_id: r.gig_id,
      created_at: r.created_at,
      last_message: r.last_message,
      last_message_at: r.last_message_at,
      unread_count: r.unread_count,
      customer: {
        id: r.customer_id,
        first_name: r.customer_first_name,
        last_name: r.customer_last_name,
        avatar_url: r.customer_avatar,
      },
      tasker: {
        id: r.tasker_id,
        first_name: r.tasker_first_name,
        last_name: r.tasker_last_name,
        avatar_url: r.tasker_avatar,
      },
    }));

    res.status(200).json(threads);
  } catch (error) {
    console.error("Error fetching threads:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.sendMessage = async (req, res) => {
  const { thread_id, sender_id, message_text, attachments, message_type, ref_task_id } = req.body;
  const msgType = message_type || 'text';
  try {
    const result = await pool.query(
      `INSERT INTO messages (thread_id, sender_id, message_text, attachments, message_type, ref_task_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [thread_id, sender_id, message_text || '', attachments || [], msgType, ref_task_id || null]
    );
    const message = result.rows[0];

    // Notify the other participant
    const threadResult = await pool.query(
      `SELECT customer_id, tasker_id FROM chat_threads WHERE id = $1`,
      [thread_id]
    );
    if (threadResult.rows.length > 0) {
      const { customer_id, tasker_id } = threadResult.rows[0];
      const recipient_id = sender_id === customer_id ? tasker_id : customer_id;
      const notifBody = msgType === 'booking_ref' ? 'Shared a booking' : message_text;
      notifyUser({
        user_id: recipient_id,
        title: "New message",
        body: notifBody,
        type: "chat",
        data: { thread_id },
      });
    }

    res.status(201).json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

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

exports.markMessagesRead = async (req, res) => {
  const { thread_id } = req.params;
  const { reader_id } = req.body;
  try {
    await pool.query(
      `UPDATE messages SET is_read = true WHERE thread_id = $1 AND sender_id != $2 AND is_read = false`,
      [thread_id, reader_id]
    );
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error marking messages read:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
