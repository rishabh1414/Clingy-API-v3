// routes/ssoRoutes.js

const express = require("express");
const router = express.Router();
const ssoController = require("../controllers/ssoController");

// OPTIONS route for preflight handling
router.options("/ghl", ssoController.handleSSOPreflight);

// Actual API route
router.get("/ghl", ssoController.handleSSO);
router.post("/ghl", ssoController.handleSSO);

module.exports = router;
