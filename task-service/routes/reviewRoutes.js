const express = require("express");
const {
  createReview,
  getReviewsOfTasker,
  getReviewsOfTask,
  getReviewsOfGig,
} = require("../controllers/reviewController");

const router = express.Router();

router.post("/", createReview);
router.get("/tasker/:tasker_id", getReviewsOfTasker);
router.get("/task/:task_id", getReviewsOfTask);
router.get("/gig/:gig_id", getReviewsOfGig);

module.exports = router;
