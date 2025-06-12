// =======================================================
// File: cronJobs/tokenRefreshJob.js
// Description: Schedules a job to periodically check and refresh GHL OAuth tokens.
// =======================================================

const cron = require("node-cron");
const OAuthCredentials = require("../models/OAuthCredentials"); // Mongoose model
const ghlService = require("../services/ghlService"); // GHL service for token refresh

const GHL_AGENCY_COMPANY_ID = process.env.GHL_COMPANY_ID; // The static agency companyId

/**
 * Scheduled job to refresh GHL OAuth tokens.
 * Runs every 5 minutes.
 */
const tokenRefreshJob = cron.schedule(
  "*/5 * * * *",
  async () => {
    console.log("🔄 Checking for GHL tokens expiring within 5 minutes...");
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds

    try {
      // Find the specific agency's OAuth credentials
      // If you have multiple agencies, you'd iterate through a list here.
      const credential = await OAuthCredentials.findOne({
        companyId: GHL_AGENCY_COMPANY_ID,
      });

      if (!credential) {
        console.log(
          "No GHL OAuth credentials found for agency. Skipping refresh."
        );
        return;
      }

      // Calculate token expiry time: created_at (timestamp) + expires_in (seconds)
      const tokenExpiryTime =
        Math.floor(credential.created_at.getTime() / 1000) +
        credential.expires_in;

      // Check if token is expiring within the next 5 minutes (300 seconds)
      if (currentTime >= tokenExpiryTime - 300) {
        console.log(
          `⚠️ Token for companyId ${credential.companyId} is expiring soon. Refreshing...`
        );
        try {
          const newCredentials = await ghlService.refreshAccessToken(
            credential.refresh_token
          );

          // Update the stored credentials with the new tokens and update created_at
          await OAuthCredentials.updateOne(
            { _id: credential._id },
            {
              $set: {
                access_token: newCredentials.access_token,
                refresh_token: newCredentials.refresh_token,
                expires_in: newCredentials.expires_in,
                created_at: new Date(), // Update timestamp to reflect new token generation
              },
            }
          );
          console.log(
            `Token refreshed successfully for companyId ${credential.companyId}`
          );
        } catch (error) {
          console.error(
            `Error refreshing token for companyId ${credential.companyId}:`,
            error.message || error
          );
        }
      } else {
        console.log(`Token still valid for companyId ${credential.companyId}`);
      }
    } catch (error) {
      console.error("Error in token refresh cron job:", error.message || error);
    }
  },
  {
    scheduled: false, // Do not start immediately when loaded, server.js will start it
  }
);

module.exports = tokenRefreshJob;
