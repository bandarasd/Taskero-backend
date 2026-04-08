const express = require("express");
const {
  createReview,
  getReviewsOfTasker,
  getReviewsOfTask,
  getReviewsOfGig,
} = require("../controllers/reviewController");
const verifyFirebaseToken = require("../../shared/middleware/auth");

const router = express.Router();

// Public: read reviews
router.get("/tasker/:tasker_id", getReviewsOfTasker);
router.get("/task/:task_id", getReviewsOfTask);
router.get("/gig/:gig_id", getReviewsOfGig);

// Protected: post review requires auth
router.post("/", verifyFirebaseToken, createReview);

module.exports = router;
