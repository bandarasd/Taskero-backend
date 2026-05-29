const pool = require("../db");
const axios = require("axios");

async function requiresCertification(category) {
  const result = await pool.query(
    `SELECT requires_certification FROM service_categories WHERE name = $1 AND is_active = TRUE`,
    [category]
  );
  return result.rows[0]?.requires_certification === true;
}

const USER_SERVICE_URL = process.env.USER_SERVICE_URL || "http://localhost:3001";

// Check whether a tasker has an approved certification for a given category
const hasCertification = async (taskerId, category) => {
  try {
    const resp = await axios.get(
      `${USER_SERVICE_URL}/users/${taskerId}/certifications`,
      { timeout: 5000 }
    );
    const certs = resp.data?.certifications || [];
    return certs.some(
      (c) => c.category === category && c.status === "approved"
    );
  } catch {
    return false;
  }
};

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
    visit_tiers,
    tags,
    attachments,
  } = req.body;

  // Validate and parse visit_tiers
  let parsedVisitTiers = null;
  if (visit_tiers !== undefined) {
    try {
      parsedVisitTiers = Array.isArray(visit_tiers) ? visit_tiers : JSON.parse(visit_tiers);
    } catch {
      return res.status(400).json({ error: "visit_tiers must be a valid JSON array" });
    }
    if (!Array.isArray(parsedVisitTiers) || parsedVisitTiers.length === 0) {
      return res.status(400).json({ error: "visit_tiers must be a non-empty array" });
    }
    for (const tier of parsedVisitTiers) {
      if (!tier.label || typeof tier.days !== 'number' || tier.days < 1) {
        return res.status(400).json({ error: "Each visit tier must have a label and positive days value" });
      }
      if (!['percent', 'flat'].includes(tier.surcharge_type) || typeof tier.surcharge_value !== 'number' || tier.surcharge_value < 0) {
        return res.status(400).json({ error: "Each visit tier must have surcharge_type ('percent'|'flat') and surcharge_value >= 0" });
      }
    }
    const baselines = parsedVisitTiers.filter(t => t.surcharge_value === 0);
    if (baselines.length !== 1) {
      return res.status(400).json({ error: "Exactly one visit tier must have surcharge_value of 0 (the baseline tier)" });
    }
  }

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

  // Certification gate — block restricted categories unless the worker is approved
  if (category && await requiresCertification(category)) {
    const certified = await hasCertification(tasker_id, category);
    if (!certified) {
      return res.status(403).json({
        error: `Category "${category}" requires an approved certification. Please apply for certification in your profile.`,
      });
    }
  }

  try {
    // Use per-gig service area if provided; fall back to tasker's profile location
    const { service_area_lat, service_area_lng, service_area_radius_km } = req.body;
    let areaLat = service_area_lat ? parseFloat(service_area_lat) : null;
    let areaLng = service_area_lng ? parseFloat(service_area_lng) : null;
    let areaRadius = service_area_radius_km ? parseFloat(service_area_radius_km) : null;

    if (areaLat === null || areaLng === null) {
      const taskerRow = await pool.query(
        "SELECT location_lat, location_lng, service_radius_km FROM users WHERE id = $1",
        [tasker_id]
      );
      const tasker = taskerRow.rows[0];
      areaLat = tasker?.location_lat ?? null;
      areaLng = tasker?.location_lng ?? null;
      areaRadius = areaRadius ?? tasker?.service_radius_km ?? null;
    }

    const defaultTiers = [{ label: 'Standard', days: 7, surcharge_type: 'percent', surcharge_value: 0 }];
    const tiersToInsert = parsedVisitTiers ?? defaultTiers;

    const result = await pool.query(
      `INSERT INTO gigs (tasker_id, title, description, category, subcategory, base_price, visit_tiers, tags, attachments, service_area_lat, service_area_lng, service_area_radius_km)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        tasker_id,
        title,
        description,
        category,
        subcategory,
        base_price || null,
        JSON.stringify(tiersToInsert),
        parsedTags,
        JSON.stringify(attachmentURLs),
        areaLat,
        areaLng,
        areaRadius,
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
// Optional query params: lat, lng — when provided, filters to gigs whose service area covers the point.
// Gigs with no service area set are excluded when a location is provided.
exports.getAllGigs = async (req, res) => {
  const lat = req.query.lat != null ? parseFloat(req.query.lat) : null;
  const lng = req.query.lng != null ? parseFloat(req.query.lng) : null;
  const useLocation = lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng);
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 15);
  const offset = (page - 1) * limit;

  try {
    const params = [];
    let locationClause = "";
    if (useLocation) {
      params.push(lat, lng);
      locationClause = `
        AND g.service_area_lat IS NOT NULL
        AND (
            6371 * acos(
              LEAST(1.0, cos(radians($1)) * cos(radians(g.service_area_lat))
              * cos(radians(g.service_area_lng) - radians($2))
              + sin(radians($1)) * sin(radians(g.service_area_lat)))
            ) <= g.service_area_radius_km
        )`;
    }

    const baseWhere = `WHERE g.is_active = true${locationClause}`;
    const countParams = [...params];
    const dataParams = [...params, limit, offset];
    const limitOffset = `LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const [countResult, result] = await Promise.all([
      pool.query(
        `SELECT COUNT(DISTINCT g.id) FROM gigs g ${baseWhere}`,
        countParams
      ),
      pool.query(
        `SELECT g.*, u.first_name, u.last_name, u.avatar_url,
                COALESCE(AVG(r.rating), 0)::numeric(3,2) AS tasker_rating,
                COUNT(r.id)::int AS tasker_review_count
         FROM gigs g
         JOIN users u ON g.tasker_id = u.id
         LEFT JOIN reviews r ON r.tasker_id = g.tasker_id
         ${baseWhere}
         GROUP BY g.id, u.id
         ORDER BY g.created_at DESC
         ${limitOffset}`,
        dataParams
      ),
    ]);

    const total = parseInt(countResult.rows[0].count);
    const gigs = result.rows.map(({ first_name, last_name, avatar_url, tasker_rating, tasker_review_count, ...gig }) => ({
      ...gig,
      rating: parseFloat(tasker_rating),
      review_count: tasker_review_count,
      tasker: { id: gig.tasker_id, first_name, last_name, avatar_url },
    }));
    res.status(200).json({ data: gigs, pagination: { page, limit, total, hasMore: page * limit < total } });
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
      `SELECT g.*,
              u.first_name, u.last_name, u.avatar_url, u.bio,
              COALESCE(AVG(r.rating), 0)::numeric(3,2) AS tasker_rating,
              COUNT(r.id)::int AS tasker_review_count
       FROM gigs g
       JOIN users u ON g.tasker_id = u.id
       LEFT JOIN reviews r ON r.tasker_id = g.tasker_id
       WHERE g.id = $1
       GROUP BY g.id, u.id`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Gig not found" });
    }
    const row = result.rows[0];
    const { first_name, last_name, avatar_url, bio, tasker_rating, tasker_review_count, ...gig } = row;
    res.status(200).json({
      ...gig,
      tasker: {
        id: gig.tasker_id,
        first_name,
        last_name,
        avatar_url,
        bio,
        rating: parseFloat(tasker_rating),
        review_count: tasker_review_count,
      },
    });
  } catch (error) {
    console.error("[ERROR] Fetching gig failed:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Get gigs by tasker
exports.getGigsByTasker = async (req, res) => {
  const { tasker_id } = req.params;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  try {
    const [countResult, result] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM gigs WHERE tasker_id = $1`, [tasker_id]),
      pool.query(
        `SELECT * FROM gigs WHERE tasker_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [tasker_id, limit, offset]
      ),
    ]);
    const total = parseInt(countResult.rows[0].count);
    res.status(200).json({ data: result.rows, pagination: { page, limit, total, hasMore: page * limit < total } });
  } catch (error) {
    console.error("[ERROR] Fetching gigs failed:", error);
    res.status(500).json({ error: "Database error" });
  }
};

// Get active gigs by category
// Optional query params: lat, lng — same location filter as getAllGigs.
exports.getGigsByCategory = async (req, res) => {
  const { category } = req.params;
  const lat = req.query.lat != null ? parseFloat(req.query.lat) : null;
  const lng = req.query.lng != null ? parseFloat(req.query.lng) : null;
  const useLocation = lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng);
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, parseInt(req.query.limit) || 15);
  const offset = (page - 1) * limit;

  try {
    const params = [category];
    let locationClause = "";
    if (useLocation) {
      params.push(lat, lng);
      locationClause = `
        AND g.service_area_lat IS NOT NULL
        AND (
            6371 * acos(
              LEAST(1.0, cos(radians($2)) * cos(radians(g.service_area_lat))
              * cos(radians(g.service_area_lng) - radians($3))
              + sin(radians($2)) * sin(radians(g.service_area_lat)))
            ) <= g.service_area_radius_km
        )`;
    }

    const baseWhere = `WHERE g.is_active = true AND LOWER(g.category) = LOWER($1)${locationClause}`;
    const countParams = [...params];
    const dataParams = [...params, limit, offset];
    const nBase = params.length;
    const limitOffset = `LIMIT $${nBase + 1} OFFSET $${nBase + 2}`;

    const [countResult, result] = await Promise.all([
      pool.query(`SELECT COUNT(DISTINCT g.id) FROM gigs g ${baseWhere}`, countParams),
      pool.query(
        `SELECT g.*, u.first_name, u.last_name, u.avatar_url,
                COALESCE(AVG(r.rating), 0)::numeric(3,2) AS tasker_rating,
                COUNT(r.id)::int AS tasker_review_count
         FROM gigs g
         JOIN users u ON g.tasker_id = u.id
         LEFT JOIN reviews r ON r.tasker_id = g.tasker_id
         ${baseWhere}
         GROUP BY g.id, u.id
         ORDER BY g.created_at DESC
         ${limitOffset}`,
        dataParams
      ),
    ]);

    const total = parseInt(countResult.rows[0].count);
    const gigs = result.rows.map(({ first_name, last_name, avatar_url, tasker_rating, tasker_review_count, ...gig }) => ({
      ...gig,
      rating: parseFloat(tasker_rating),
      review_count: tasker_review_count,
      tasker: { id: gig.tasker_id, first_name, last_name, avatar_url },
    }));
    res.status(200).json({ data: gigs, pagination: { page, limit, total, hasMore: page * limit < total } });
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
    visit_tiers,
    tags,
    existingAttachments,
    service_area_lat,
    service_area_lng,
    service_area_radius_km,
  } = req.body;

  // Validate visit_tiers if provided
  let parsedVisitTiers = undefined;
  if (visit_tiers !== undefined) {
    try {
      parsedVisitTiers = Array.isArray(visit_tiers) ? visit_tiers : JSON.parse(visit_tiers);
    } catch {
      return res.status(400).json({ error: "visit_tiers must be a valid JSON array" });
    }
    if (!Array.isArray(parsedVisitTiers) || parsedVisitTiers.length === 0) {
      return res.status(400).json({ error: "visit_tiers must be a non-empty array" });
    }
    for (const tier of parsedVisitTiers) {
      if (!tier.label || typeof tier.days !== 'number' || tier.days < 1) {
        return res.status(400).json({ error: "Each visit tier must have a label and positive days value" });
      }
      if (!['percent', 'flat'].includes(tier.surcharge_type) || typeof tier.surcharge_value !== 'number' || tier.surcharge_value < 0) {
        return res.status(400).json({ error: "Each visit tier must have surcharge_type ('percent'|'flat') and surcharge_value >= 0" });
      }
    }
    const baselines = parsedVisitTiers.filter(t => t.surcharge_value === 0);
    if (baselines.length !== 1) {
      return res.status(400).json({ error: "Exactly one visit tier must have surcharge_value of 0 (the baseline tier)" });
    }
  }

  try {
    const currentRow = await pool.query(
      `SELECT tasker_id, title, description, category, subcategory, base_price, visit_tiers, tags, attachments
       FROM gigs WHERE id = $1`,
      [id]
    );
    if (currentRow.rows.length === 0) {
      return res.status(404).json({ error: "Gig not found" });
    }
    const current = currentRow.rows[0];

    // Certification gate for category changes
    const effectiveCategory = category ?? current.category;
    if (effectiveCategory && await requiresCertification(effectiveCategory)) {
      const certified = await hasCertification(current.tasker_id, effectiveCategory);
      if (!certified) {
        return res.status(403).json({
          error: `Category "${effectiveCategory}" requires an approved certification.`,
        });
      }
    }

    // Use per-gig service area if provided; fall back to tasker's profile location
    let finalAreaLat = service_area_lat ? parseFloat(service_area_lat) : null;
    let finalAreaLng = service_area_lng ? parseFloat(service_area_lng) : null;
    let finalAreaRadius = service_area_radius_km ? parseFloat(service_area_radius_km) : null;

    if (finalAreaLat === null || finalAreaLng === null) {
      const taskerRow = await pool.query(
        "SELECT location_lat, location_lng, service_radius_km FROM users WHERE id = $1",
        [current.tasker_id]
      );
      const tasker = taskerRow.rows[0];
      finalAreaLat = tasker?.location_lat ?? null;
      finalAreaLng = tasker?.location_lng ?? null;
      finalAreaRadius = finalAreaRadius ?? tasker?.service_radius_km ?? null;
    }

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
      finalAttachments = current.attachments || [];
    }

    const finalTitle = title ?? current.title;
    const finalDescription = description ?? current.description;
    const finalCategory = category ?? current.category;
    const finalSubcategory = subcategory ?? current.subcategory;
    const finalBasePrice = base_price !== undefined ? base_price : current.base_price;
    const finalVisitTiers = parsedVisitTiers !== undefined ? parsedVisitTiers : current.visit_tiers;
    const finalTags = tags !== undefined ? tags : current.tags;

    const result = await pool.query(
      `UPDATE gigs
       SET title = $1, description = $2, category = $3, subcategory = $4,
           base_price = $5, visit_tiers = $6, tags = $7, attachments = $8,
           service_area_lat = $9, service_area_lng = $10, service_area_radius_km = $11,
           updated_at = NOW()
       WHERE id = $12 RETURNING *`,
      [
        finalTitle,
        finalDescription,
        finalCategory,
        finalSubcategory,
        finalBasePrice !== null ? finalBasePrice : null,
        JSON.stringify(finalVisitTiers),
        finalTags !== null ? finalTags : null,
        JSON.stringify(finalAttachments),
        finalAreaLat,
        finalAreaLng,
        finalAreaRadius,
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
