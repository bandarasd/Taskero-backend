const express = require("express");
const {
  createGig,
  getAllGigs,
  getGigById,
  getGigsByTasker,
  getGigsByCategory,
  updateGig,
  toggleGigStatus,
  deleteGig,
} = require("../controllers/gigController");
const verifyFirebaseToken = require("../../shared/middleware/auth");
const attachUser = require("../../shared/middleware/attachUser");
const { uploadGigImages } = require("../middlewares/gigUploadMiddleware");
const pool = require("../db");

const router = express.Router();
const auth = [verifyFirebaseToken, attachUser(pool)];

// Public: browse gigs without auth
// NOTE: specific paths must be before /:id to avoid route shadowing
router.get("/", getAllGigs);
router.get("/category/:category", getGigsByCategory);
router.get("/tasker/:tasker_id", getGigsByTasker);
router.get("/:id", getGigById);

// Protected: modifying gigs requires auth
router.post("/", ...auth, uploadGigImages, createGig);
router.put("/:id", ...auth, uploadGigImages, updateGig);
router.patch("/:id/status", ...auth, toggleGigStatus);
router.delete("/:id", ...auth, deleteGig);

module.exports = router;
