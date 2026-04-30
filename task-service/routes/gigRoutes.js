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
const { uploadGigImages } = require("../middlewares/gigUploadMiddleware");

const router = express.Router();

// Public: browse gigs without auth
// NOTE: specific paths must be before /:id to avoid route shadowing
router.get("/", getAllGigs);
router.get("/category/:category", getGigsByCategory);
router.get("/tasker/:tasker_id", getGigsByTasker);
router.get("/:id", getGigById);

// Protected: modifying gigs requires auth
router.post("/", verifyFirebaseToken, uploadGigImages, createGig);
router.put("/:id", verifyFirebaseToken, uploadGigImages, updateGig);
router.patch("/:id/status", verifyFirebaseToken, toggleGigStatus);
router.delete("/:id", verifyFirebaseToken, deleteGig);

module.exports = router;
