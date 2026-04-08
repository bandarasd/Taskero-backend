const express = require("express");
const {
  createGig,
  getAllGigs,
  getGigById,
  getGigsByTasker,
  updateGig,
  deleteGig,
} = require("../controllers/gigController");
const verifyFirebaseToken = require("../../shared/middleware/auth");

const router = express.Router();

// Public: browse gigs without auth
router.get("/", getAllGigs);
router.get("/tasker/:tasker_id", getGigsByTasker);
router.get("/:id", getGigById);

// Protected: modifying gigs requires auth
router.post("/", verifyFirebaseToken, createGig);
router.put("/:id", verifyFirebaseToken, updateGig);
router.delete("/:id", verifyFirebaseToken, deleteGig);

module.exports = router;
