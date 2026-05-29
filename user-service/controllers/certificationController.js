const pool = require("../db");

async function isCertifiedCategory(category) {
  const result = await pool.query(
    `SELECT requires_certification FROM service_categories WHERE name = $1 AND is_active = TRUE`,
    [category]
  );
  return result.rows[0]?.requires_certification === true;
}

// Worker: submit certification request for a category
exports.submitCertification = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const { category } = req.body;

    if (!category) {
      return res.status(400).json({ error: "Category is required" });
    }

    if (!(await isCertifiedCategory(category))) {
      return res
        .status(400)
        .json({ error: "This category does not require certification" });
    }

    const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [
      userId,
    ]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const documentUrl = req.file ? req.file.path : null;
    if (!documentUrl) {
      return res.status(400).json({ error: "Certification document is required" });
    }

    // Upsert: if already submitted, update with new document and reset to pending
    const result = await pool.query(
      `INSERT INTO worker_category_certifications (user_id, category, document_url, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', NOW(), NOW())
       ON CONFLICT (user_id, category)
       DO UPDATE SET document_url = $3, status = 'pending', admin_notes = NULL,
                     reviewed_by = NULL, reviewed_at = NULL, updated_at = NOW()
       RETURNING *`,
      [userId, category, documentUrl]
    );

    res.status(201).json({
      message: "Certification request submitted successfully",
      certification: result.rows[0],
    });
  } catch (error) {
    console.error("[ERROR] Submit certification:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Worker: get own certifications
exports.getWorkerCertifications = async (req, res) => {
  const userId = req.params.userId;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 50);
  const offset = (page - 1) * limit;
  try {
    const [countResult, result] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM worker_category_certifications WHERE user_id = $1`, [userId]),
      pool.query(
        `SELECT * FROM worker_category_certifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      ),
    ]);
    const total = parseInt(countResult.rows[0].count);
    res.status(200).json({ certifications: result.rows, pagination: { page, limit, total, hasMore: page * limit < total } });
  } catch (error) {
    console.error("[ERROR] Get worker certifications:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Admin: get all pending certifications
exports.getPendingCertifications = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  try {
    const [countResult, result] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM worker_category_certifications WHERE status = 'pending'`),
      pool.query(
        `SELECT c.*, u.first_name, u.last_name, u.email, u.phone_number
         FROM worker_category_certifications c
         JOIN users u ON c.user_id = u.id
         WHERE c.status = 'pending'
         ORDER BY c.created_at ASC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
    ]);
    const total = parseInt(countResult.rows[0].count);
    res.status(200).json({ certifications: result.rows, pagination: { page, limit, total, hasMore: page * limit < total } });
  } catch (error) {
    console.error("[ERROR] Get pending certifications:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Admin: approve a certification
exports.approveCertification = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id || null;

    const result = await pool.query(
      `UPDATE worker_category_certifications
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [adminId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Certification not found" });
    }

    res.status(200).json({
      message: "Certification approved",
      certification: result.rows[0],
    });
  } catch (error) {
    console.error("[ERROR] Approve certification:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Admin: reject a certification
exports.rejectCertification = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id || null;
    const { notes } = req.body;

    if (!notes) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const result = await pool.query(
      `UPDATE worker_category_certifications
       SET status = 'rejected', admin_notes = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [notes, adminId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Certification not found" });
    }

    res.status(200).json({
      message: "Certification rejected",
      certification: result.rows[0],
    });
  } catch (error) {
    console.error("[ERROR] Reject certification:", error);
    res.status(500).json({ error: "Database error" });
  }
};
