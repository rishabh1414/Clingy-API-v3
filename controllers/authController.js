// =======================================================
// File: controllers/authController.js
// Description: Handles authentication related requests (OAuth callback, location token).
// Orchestrates calls to GHL service and OAuthCredentials model.
// =======================================================

const OAuthCredentials = require("../models/OAuthCredentials");
const ghlService = require("../services/ghlService");

/**
 * Handles the OAuth callback from GoHighLevel.
 * Exchanges the authorization code for tokens and saves them.
 * @route GET /api/auth/callback
 */
const handleOAuthCallback = async (req, res, next) => {
  console.log("OAuth callback received.");
  const { code } = req.query;

  if (!code) {
    const error = new Error("Missing authorization code.");
    error.statusCode = 400;
    return next(error);
  }

  try {
    const credentialsData = await ghlService.getAccessToken(code);
    const {
      access_token,
      refresh_token,
      expires_in,
      userId,
      locationId,
      companyId,
    } = credentialsData;

    // Save or update OAuth credentials in MongoDB
    await OAuthCredentials.findOneAndUpdate(
      { companyId }, // Find by companyId to ensure uniqueness per agency
      {
        access_token,
        refresh_token,
        expires_in,
        userId,
        locationId,
        companyId,
        created_at: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true } // Create if not found, return new doc
    );

    console.log("OAuth tokens saved successfully for companyId:", companyId);
    res
      .status(200)
      .send(
        "Authorization successful and tokens saved. You can close this window."
      );
  } catch (error) {
    console.error("Error during OAuth token exchange:", error);
    error.statusCode = 500; // Set a status code for the error middleware
    next(error);
  }
};

/**
 * Generates and returns a location-specific access token.
 * @route POST /api/location-token
 */
const generateLocationToken = async (req, res, next) => {
  const { locationId } = req.body;

  if (!locationId) {
    const error = new Error("Missing required field: locationId.");
    error.statusCode = 400;
    return next(error);
  }

  try {
    // Retrieve agency-level access token from DB
    const credentials = await OAuthCredentials.findOne({
      companyId: process.env.GHL_COMPANY_ID,
    }); // Assuming agency's companyId is fixed
    if (!credentials || !credentials.access_token) {
      const error = new Error(
        "Agency access token not available. Please ensure OAuth authorization is complete."
      );
      error.statusCode = 401; // Unauthorized
      return next(error);
    }

    const token = await ghlService.getLocationAccessToken(
      credentials.companyId,
      locationId,
      credentials.access_token
    );
    res.status(200).json({ accessToken: token });
  } catch (error) {
    console.error("Error in generateLocationToken:", error);
    error.statusCode = error.statusCode || 500;
    next(error);
  }
};

module.exports = {
  handleOAuthCallback,
  generateLocationToken,
};
