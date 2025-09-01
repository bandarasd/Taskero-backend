const pool = require("../db");

// Create a new gig
exports.createGig = async (req, res) => {
  const {
    tasker_id,
    title,
    description,
    category,
    subcategory,
    base_price,
    delivery_time,
    tags,
    attachments,
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO gigs (tasker_id, title, description, category, subcategory, base_price, delivery_time, tags, attachments)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        tasker_id,
        title,
        description,
        category,
        subcategory,
        base_price,
        delivery_time,
        tags,
        attachments,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating gig:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Get gigs by tasker
exports.getGigsByTasker = async (req, res) => {
  const { tasker_id } = req.params;

  try {
    const result = await pool.query(`SELECT * FROM gigs WHERE tasker_id = $1`, [
      tasker_id,
    ]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("Error fetching gigs:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Update a gig
exports.updateGig = async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    category,
    subcategory,
    base_price,
    delivery_time,
    tags,
    attachments,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE gigs SET title = $1, description = $2, category = $3, subcategory = $4, base_price = $5, delivery_time = $6, tags = $7, attachments = $8 WHERE id = $9 RETURNING *`,
      [
        title,
        description,
        category,
        subcategory,
        base_price,
        delivery_time,
        tags,
        attachments,
        id,
      ]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error updating gig:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Delete a gig
exports.deleteGig = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM gigs WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Gig not found" });
    }
    res.status(200).json({ message: "Gig deleted successfully" });
  } catch (error) {
    console.error("Error deleting gig:", error);
    res.status(500).json({ error: "Database error" });
  }
};
