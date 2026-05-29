const express = require("express");
const {
  indexGig,
  deleteGig,
  searchGigs,
} = require("../controllers/searchController");
const requireInternalKey = require("../../shared/middleware/internalAuth");
const router = express.Router();

// Internal routes — require x-internal-key header
router.post("/gigs", requireInternalKey, indexGig);
router.delete("/gigs/:id", requireInternalKey, deleteGig);

// Public search
router.get("/gigs/search", searchGigs);

module.exports = router;
