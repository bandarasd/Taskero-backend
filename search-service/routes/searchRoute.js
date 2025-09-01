const express = require("express");
const {
  indexGig,
  deleteGig,
  searchGigs,
} = require("../controllers/searchController");
const router = express.Router();

// Index a gig
router.post("/gigs", indexGig);

// Delete a gig
router.delete("/gigs/:id", deleteGig);

// Search gigs
router.get("/gigs/search", searchGigs);

module.exports = router;
