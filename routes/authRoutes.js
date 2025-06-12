// =======================================================
// File: routes/authRoutes.js
// Description: Defines API routes for authentication (OAuth callback, location token).
// Uses authController to handle the logic.
// =======================================================

const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

// @route   GET /api/auth/callback
// @desc    Handles GHL OAuth callback and saves tokens
// @access  Public
router.get("/callback", authController.handleOAuthCallback);

// @route   POST /api/location-token
// @desc    Generates and returns a location-specific GHL access token
// @access  Public (or could be private if your own auth system is in place)
router.post("/location-token", authController.generateLocationToken);

module.exports = router;
