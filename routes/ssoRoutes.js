const express = require("express");
const router = express.Router();
const ssoController = require("../controllers/ssoController");

// Updated route based on GHL documentation pattern
router.post("/decrypt-user-data", ssoController.decryptUserData);

// Keep your existing routes if needed for backward compatibility
router.options("/ghl", ssoController.handleSSOPreflight);
router.get("/ghl", ssoController.handleSSO);
router.post("/ghl", ssoController.handleSSO);

module.exports = router;
