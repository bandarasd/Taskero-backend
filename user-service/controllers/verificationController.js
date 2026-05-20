const pool = require("../db");

// Submit verification documents
exports.submitVerification = async (req, res) => {
  try {
    // For now, using user ID from params since auth might not be implemented yet
    const userId = req.params.userId || req.user?.id;
    const { documentType } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Validate document type
    const validTypes = ["ID", "Passport", "Utility Bill"];
    if (!validTypes.includes(documentType)) {
      return res.status(400).json({ error: "Invalid document type" });
    }

    // Check if user exists
    const userCheck = await pool.query("SELECT id FROM users WHERE id = $1", [
      userId,
    ]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Handle file upload - check for different field names
    let documentUrl = null;
    let facePhotoUrl = null;
    let addressProofUrl = null;

    if (req.files) {
      // Multiple files upload
      if (req.files.document && req.files.document[0]) {
        documentUrl = req.files.document[0].path;
      }
      if (req.files.facePhoto && req.files.facePhoto[0]) {
        facePhotoUrl = req.files.facePhoto[0].path;
      }
      if (req.files.addressProof && req.files.addressProof[0]) {
        addressProofUrl = req.files.addressProof[0].path;
      }
    } else if (req.file) {
      // Single file upload
      documentUrl = req.file.path;
    }

    if (!documentUrl) {
      return res.status(400).json({ error: "No document uploaded" });
    }

    // Insert verification record
    const result = await pool.query(
      `INSERT INTO verifications (user_id, document_type, document_url, status)
             VALUES ($1, $2, $3, 'Pending') RETURNING *`,
      [userId, documentType, documentUrl]
    );

    res.status(201).json({
      message: "Verification documents submitted successfully",
      verification: result.rows[0],
      uploadedFiles: {
        document: documentUrl,
        facePhoto: facePhotoUrl,
        addressProof: addressProofUrl,
      },
    });
  } catch (error) {
    console.error("Verification submission error:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Get verification status
exports.getVerificationStatus = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?.id;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const result = await pool.query(
      `SELECT * FROM verifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "No verification record found" });
    }

    res.status(200).json({
      verification: result.rows[0],
    });
  } catch (error) {
    console.error("Get verification status error:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Get all verifications for a user
exports.getAllVerifications = async (req, res) => {
  try {
    const userId = req.params.userId || req.user?.id;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    const result = await pool.query(
      `SELECT * FROM verifications WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );

    res.status(200).json({
      verifications: result.rows,
    });
  } catch (error) {
    console.error("Get all verifications error:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Admin: Get pending verifications
exports.getPendingVerifications = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.*, u.first_name, u.last_name, u.email 
       FROM verifications v 
       JOIN users u ON v.user_id = u.id 
       WHERE v.status = 'Pending' 
       ORDER BY v.created_at ASC`
    );

    res.status(200).json({
      pendingVerifications: result.rows,
    });
  } catch (error) {
    console.error("Get pending verifications error:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Admin: Approve verification
exports.approveVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id || null; // Make admin ID optional for now
    const { notes } = req.body;

    const result = await pool.query(
      `UPDATE verifications 
       SET status = 'Approved', admin_notes = $1, reviewed_by = $2, reviewed_at = NOW() 
       WHERE id = $3 RETURNING *`,
      [notes || null, adminId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Verification not found" });
    }

    res.status(200).json({
      message: "Verification approved successfully",
      verification: result.rows[0],
    });
  } catch (error) {
    console.error("Approve verification error:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Admin: Reject verification
exports.rejectVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id || null; // Make admin ID optional for now
    const { notes } = req.body;

    if (!notes) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const result = await pool.query(
      `UPDATE verifications 
       SET status = 'Rejected', admin_notes = $1, reviewed_by = $2, reviewed_at = NOW() 
       WHERE id = $3 RETURNING *`,
      [notes, adminId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Verification not found" });
    }

    res.status(200).json({
      message: "Verification rejected",
      verification: result.rows[0],
    });
  } catch (error) {
    console.error("Reject verification error:", error);
    res.status(500).json({ error: "Database error" });
  }
};
