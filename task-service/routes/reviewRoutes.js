const express = require("express");
const {
  createReview,
  getReviewsOfTasker,
  getReviewsOfTask,
  getReviewsOfGig,
} = require("../controllers/reviewController");
const verifyFirebaseToken = require("../../shared/middleware/auth");
const attachUser = require("../../shared/middleware/attachUser");
const pool = require("../db");

const router = express.Router();
const auth = [verifyFirebaseToken, attachUser(pool)];

// Public: read reviews
router.get("/tasker/:tasker_id", getReviewsOfTasker);
router.get("/task/:task_id", getReviewsOfTask);
router.get("/gig/:gig_id", getReviewsOfGig);

// Protected: post review requires auth
router.post("/", ...auth, createReview);

module.exports = router;
