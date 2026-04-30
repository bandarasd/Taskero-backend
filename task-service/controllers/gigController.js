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

// Helper: parse attachments from request (multipart files take priority)
const parseAttachments = (files, bodyAttachments) => {
  if (files && files.length > 0) {
    // multer-storage-cloudinary sets file.path to the secure Cloudinary URL
    return files.map((f) => f.path);
  }
  if (bodyAttachments) {
    if (Array.isArray(bodyAttachments)) return bodyAttachments;
    try {
      return JSON.parse(bodyAttachments);
    } catch {
      return [];
    }
  }
  return [];
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

  // Parse tags: accept JSON array string or comma-separated string
  let parsedTags = null;
  if (tags) {
    if (Array.isArray(tags)) {
      parsedTags = tags;
    } else {
      try {
        parsedTags = JSON.parse(tags);
      } catch {
        parsedTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
      }
    }
  }

  const attachmentURLs = parseAttachments(req.files, attachments);

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
        base_price || null,
        delivery_time || null,
        parsedTags,
        JSON.stringify(attachmentURLs),
      ]
    );

    const gig = result.rows[0];

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
    const result = await pool.query(
      `SELECT * FROM gigs WHERE tasker_id = $1 ORDER BY created_at DESC`,
      [tasker_id]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("[ERROR] Fetching gigs failed:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Get active gigs by category
exports.getGigsByCategory = async (req, res) => {
  const { category } = req.params;
  try {
    const result = await pool.query(
      `SELECT g.*, u.first_name, u.last_name, u.avatar_url
       FROM gigs g
       JOIN users u ON g.tasker_id = u.id
       WHERE g.is_active = true AND LOWER(g.category) = LOWER($1)
       ORDER BY g.created_at DESC`,
      [category]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("[ERROR] Fetching gigs by category failed:", error);
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
    existingAttachments,
  } = req.body;

  try {
    // Merge existing attachment URLs with any newly uploaded ones
    let finalAttachments = [];

    if (existingAttachments) {
      if (Array.isArray(existingAttachments)) {
        finalAttachments = existingAttachments;
      } else {
        try {
          finalAttachments = JSON.parse(existingAttachments);
        } catch {
          // comma-separated fallback
          finalAttachments = existingAttachments
            .split(",")
            .map((u) => u.trim())
            .filter(Boolean);
        }
      }
    }

    if (req.files && req.files.length > 0) {
      const newURLs = req.files.map((f) => f.path);
      finalAttachments = [...finalAttachments, ...newURLs];
    }

    // If no attachment info was provided at all, preserve existing DB value
    if (!existingAttachments && (!req.files || req.files.length === 0)) {
      const current = await pool.query(
        `SELECT attachments FROM gigs WHERE id = $1`,
        [id]
      );
      finalAttachments = current.rows[0]?.attachments || [];
    }

    const result = await pool.query(
      `UPDATE gigs
       SET title = $1, description = $2, category = $3, subcategory = $4,
           base_price = $5, delivery_time = $6, tags = $7, attachments = $8,
           updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [
        title,
        description,
        category,
        subcategory,
        base_price || null,
        delivery_time || null,
        tags || null,
        JSON.stringify(finalAttachments),
        id,
      ]
    );

    const gig = result.rows[0];
    if (!gig) {
      return res.status(404).json({ error: "Gig not found" });
    }

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

// Toggle gig active status
exports.toggleGigStatus = async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  if (typeof is_active !== "boolean") {
    return res.status(400).json({ error: "is_active must be a boolean" });
  }

  try {
    const result = await pool.query(
      `UPDATE gigs SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Gig not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("[ERROR] Toggling gig status failed:", error);
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

    await deleteGigFromSearch(id);

    res.status(200).json({ message: "Gig deleted successfully" });
  } catch (error) {
    console.error("[ERROR] Deleting gig failed:", error);
    res.status(500).json({ error: "Database error" });
  }
};
