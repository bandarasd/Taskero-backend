const express = require("express");
const { register } = require("../controllers/authController");
const verifyFirebaseToken = require("../../shared/middleware/auth");
const attachUser = require("../../shared/middleware/attachUser");
const pool = require("../db");

const router = express.Router();
const auth = [verifyFirebaseToken, attachUser(pool)];

// Called after Firebase OTP verification to create/retrieve the backend user profile
router.post("/register", ...auth, register);

module.exports = router;
