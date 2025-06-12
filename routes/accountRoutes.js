// =======================================================
// File: routes/accountRoutes.js
// Description: Defines API routes for account creation and agency token retrieval.
// Uses accountController to handle the logic.
// =======================================================

const express = require("express");
const accountController = require("../controllers/accountController");

const router = express.Router();

// @route   POST /accountCreationSSE
// @desc    Initiates an account creation process with real-time updates via SSE
// @access  Public
router.post("/accountCreationSSE", accountController.createAccountSSE);

// @route   GET /agency-token
// @desc    Returns the main agency-level OAuth token
// @access  Public (consider making this private if your own auth is needed)
router.get("/agency-token", accountController.getAgencyToken);

module.exports = router;
