const express = require("express");
const {
  createGig,
  getGigsByTasker,
  updateGig,
  deleteGig,
} = require("../controllers/gigController");

const router = express.Router();

router.post("/", createGig);
router.get("/:tasker_id", getGigsByTasker);
router.put("/:id", updateGig);
router.delete("/:id", deleteGig);

module.exports = router;
