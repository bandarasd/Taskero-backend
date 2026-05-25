const express = require("express");
const { getFaqs, getPromos, getReviewTags } = require("../controllers/contentController");

const router = express.Router();

router.get("/faqs", getFaqs);
router.get("/promos", getPromos);
router.get("/review-tags", getReviewTags);

module.exports = router;
