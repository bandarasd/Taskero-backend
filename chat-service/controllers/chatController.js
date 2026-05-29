const pool = require("../db");
const { notifyUser } = require("../utils/notify");

exports.getOrCreateThread = async (req, res) => {
  const { customer_id, tasker_id } = req.body;
  const callerId = req.user?.id;
  if (!callerId) return res.status(401).json({ error: "Unauthorized" });
  if (callerId !== customer_id && callerId !== tasker_id) {
    return res.status(403).json({ error: "Forbidden" });
  }
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
  const user_id = req.user?.id;
  if (!user_id) return res.status(401).json({ error: "Unauthorized" });
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  try {
    const [countResult, result] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM chat_threads ct WHERE ct.customer_id = $1 OR ct.tasker_id = $1`,
        [user_id]
      ),
      pool.query(
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
         ORDER BY last_message_at DESC NULLS LAST, ct.created_at DESC
         LIMIT $2 OFFSET $3`,
        [user_id, limit, offset]
      ),
    ]);

    const total = parseInt(countResult.rows[0].count);
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

    res.status(200).json({ data: threads, pagination: { page, limit, total, hasMore: page * limit < total } });
  } catch (error) {
    console.error("Error fetching threads:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.sendMessage = async (req, res) => {
  const sender_id = req.user?.id;
  if (!sender_id) return res.status(401).json({ error: "Unauthorized" });
  const { thread_id, message_text, attachments, message_type, ref_task_id } = req.body;
  const msgType = message_type || 'text';
  try {
    // Verify sender belongs to the thread
    const threadResult = await pool.query(
      `SELECT customer_id, tasker_id FROM chat_threads WHERE id = $1`,
      [thread_id]
    );
    if (threadResult.rows.length === 0) {
      return res.status(404).json({ error: "Thread not found" });
    }
    const { customer_id, tasker_id } = threadResult.rows[0];
    if (sender_id !== customer_id && sender_id !== tasker_id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const result = await pool.query(
      `INSERT INTO messages (thread_id, sender_id, message_text, attachments, message_type, ref_task_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [thread_id, sender_id, message_text || '', attachments || [], msgType, ref_task_id || null]
    );
    const message = result.rows[0];

    // Notify the other participant
    const recipient_id = sender_id === customer_id ? tasker_id : customer_id;
    const notifBody = msgType === 'booking_ref' ? 'Shared a booking' : message_text;
    notifyUser({
      user_id: recipient_id,
      title: "New message",
      body: notifBody,
      type: "chat",
      data: { thread_id },
    });

    res.status(201).json(message);
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getMessagesByThread = async (req, res) => {
  const { thread_id } = req.params;
  const callerId = req.user?.id;
  if (!callerId) return res.status(401).json({ error: "Unauthorized" });
  // cursor-based: ?before=<message_id> loads older messages; omit for latest page
  const before = req.query.before || null;
  const limit = Math.min(100, parseInt(req.query.limit) || 30);
  try {
    // Verify caller belongs to this thread
    const threadCheck = await pool.query(
      `SELECT customer_id, tasker_id FROM chat_threads WHERE id = $1`,
      [thread_id]
    );
    if (!threadCheck.rows[0]) return res.status(404).json({ error: "Thread not found" });
    const { customer_id, tasker_id } = threadCheck.rows[0];
    if (callerId !== customer_id && callerId !== tasker_id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const params = [thread_id, limit];
    let cursorClause = "";
    if (before) {
      params.push(before);
      cursorClause = `AND id < $${params.length}`;
    }
    // Fetch DESC then reverse so client always gets oldest-first order
    const result = await pool.query(
      `SELECT * FROM (
         SELECT * FROM messages
         WHERE thread_id = $1 ${cursorClause}
         ORDER BY created_at DESC
         LIMIT $2
       ) sub
       ORDER BY created_at ASC`,
      params
    );
    const hasMore = result.rows.length === limit;
    const oldestId = result.rows.length > 0 ? result.rows[0].id : null;
    res.status(200).json({ data: result.rows, pagination: { limit, hasMore, oldestId } });
  } catch (error) {
    console.error("Error getting messages:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.markMessagesRead = async (req, res) => {
  const { thread_id } = req.params;
  const reader_id = req.user?.id;
  if (!reader_id) return res.status(401).json({ error: "Unauthorized" });
  try {
    // Verify reader belongs to this thread
    const thread = await pool.query(
      `SELECT customer_id, tasker_id FROM chat_threads WHERE id = $1`,
      [thread_id]
    );
    if (thread.rows.length === 0) return res.status(404).json({ error: "Thread not found" });
    const { customer_id, tasker_id } = thread.rows[0];
    if (reader_id !== customer_id && reader_id !== tasker_id) {
      return res.status(403).json({ error: "Forbidden" });
    }
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
