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
 * This function will create new credentials on first install or update existing ones.
 * @route GET /api/auth/callback
 */
const handleOAuthCallback = async (req, res, next) => {
  console.log("OAuth callback received with authorization code.");
  const { code } = req.query;

  if (!code) {
    const error = new Error("Missing authorization code.");
    error.statusCode = 400;
    return next(error);
  }

  try {
    // Step 1: Exchange the code for a full set of credentials
    const credentialsData = await ghlService.getAccessToken(code);
    const {
      access_token,
      refresh_token,
      expires_in,
      userId,
      locationId,
      companyId, // This is the unique ID for the agency
    } = credentialsData;

    // Critical check: Ensure a companyId was returned
    if (!companyId) {
      console.error(
        "Fatal: companyId is missing from the GHL token response. Cannot save credentials."
      );
      const error = new Error(
        "Could not identify the agency because companyId was not provided by GHL."
      );
      error.statusCode = 400;
      return next(error);
    }

    // Step 2: Prepare the document to be saved to MongoDB
    const credentialsToSave = {
      access_token,
      refresh_token,
      expires_in,
      userId,
      locationId,
      companyId,
      created_at: new Date(),
    };

    // Step 3: Atomically find the document by companyId and update it, or create it if it doesn't exist.
    await OAuthCredentials.findOneAndUpdate(
      { companyId: companyId }, // The query to find the correct agency's record
      credentialsToSave, // The new data to save
      {
        upsert: true, // This is the key: creates the document if it doesn't exist
        new: true, // Option to return the new/updated document (optional here)
        setDefaultsOnInsert: true, // Ensures Mongoose schema defaults are applied on creation
      }
    );

    console.log(
      `Successfully created or updated tokens for companyId: ${companyId}`
    );
    res
      .status(200)
      .send(
        "Authorization successful. Tokens have been saved. You may now close this window."
      );
  } catch (error) {
    console.error("Error during OAuth token exchange and save:", error);
    error.statusCode = 500;
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
    // Retrieve agency-level access token from DB using the environment variable
    // This assumes you have a single, known GHL_COMPANY_ID for your application
    const credentials = await OAuthCredentials.findOne({
      companyId: process.env.GHL_COMPANY_ID,
    });

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
