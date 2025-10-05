// Submit verification documents
exports.submitVerification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { documentType, documentAddress } = req.body;

    // Validate document type
    const validTypes = ["ID", "Passport", "Utility Bill"];
    if (!validTypes.includes(documentType)) {
      return res.status(400).json({ error: "Invalid document type" });
    }

    // Validate and upload document
    if (!req.file) {
      return res.status(400).json({ error: "No document uploaded" });
    }
    const documentUrl = req.file.path; // Assuming upload middleware sets this

    // Insert verification record
    const result = await pool.query(
      `INSERT INTO verifications (user_id, document_type, document_address, document_url, status, created_at)
             VALUES ($1, $2, $3, $4, 'Pending', NOW()) RETURNING *`,
      [userId, documentType, documentAddress, documentUrl]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
};

// Get verification status
exports.getVerificationStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT * FROM verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No verification record found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database error" });
  }
};
