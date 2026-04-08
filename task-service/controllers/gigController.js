const pool = require("../db");
const axios = require("axios");

const GIG_SEARCH_SERVICE_URL = process.env.GIG_SEARCH_SERVICE_URL;

// Helper: sync gig to Elasticsearch
const syncGigToSearch = async (gig) => {
  try {
    await axios.post(`${GIG_SEARCH_SERVICE_URL}/gigs`, gig);
  } catch (err) {
    console.error("[ERROR] Syncing gig to search service failed:", err.message);
  }
};

// Helper: delete gig from Elasticsearch
const deleteGigFromSearch = async (id) => {
  try {
    await axios.delete(`${GIG_SEARCH_SERVICE_URL}/gigs/${id}`);
  } catch (err) {
    console.error(
      "[ERROR] Deleting gig from search service failed:",
      err.message
    );
  }
};

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

    const gig = result.rows[0];

    // Sync with Elasticsearch
    await syncGigToSearch({
      id: gig.id,
      title: gig.title,
      description: gig.description,
      category: gig.category,
      subcategory: gig.subcategory,
      tags: gig.tags,
    });

    res.status(201).json(gig);
  } catch (error) {
    console.error("[ERROR] Creating gig failed:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Get all active gigs (for browse/home screen)
exports.getAllGigs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.*, u.first_name, u.last_name, u.avatar_url
       FROM gigs g
       JOIN users u ON g.tasker_id = u.id
       WHERE g.is_active = true
       ORDER BY g.created_at DESC`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("[ERROR] Fetching all gigs failed:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Get single gig by ID
exports.getGigById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT g.*, u.first_name, u.last_name, u.avatar_url
       FROM gigs g
       JOIN users u ON g.tasker_id = u.id
       WHERE g.id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Gig not found" });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("[ERROR] Fetching gig failed:", error);
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
    console.error("[ERROR] Fetching gigs failed:", error);
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
      `UPDATE gigs SET title = $1, description = $2, category = $3, subcategory = $4, base_price = $5, delivery_time = $6, tags = $7, attachments = $8
       WHERE id = $9 RETURNING *`,
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

    const gig = result.rows[0];
    if (!gig) {
      console.warn("[WARN] Gig not found for update:", id);
      return res.status(404).json({ error: "Gig not found" });
    }

    // Sync updated gig with Elasticsearch
    await syncGigToSearch({
      id: gig.id,
      title: gig.title,
      description: gig.description,
      category: gig.category,
      subcategory: gig.subcategory,
      tags: gig.tags,
    });

    res.status(200).json(gig);
  } catch (error) {
    console.error("[ERROR] Updating gig failed:", error);
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
      console.warn("[WARN] Gig not found for deletion:", id);
      return res.status(404).json({ error: "Gig not found" });
    }

    // Delete from Elasticsearch
    await deleteGigFromSearch(id);

    res.status(200).json({ message: "Gig deleted successfully" });
  } catch (error) {
    console.error("[ERROR] Deleting gig failed:", error);
    res.status(500).json({ error: "Database error" });
  }
};
