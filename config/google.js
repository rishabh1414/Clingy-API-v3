// =======================================================
// File: config/google.js
// Description: Initializes Google API authentication and Drive client.
// =======================================================

const { google } = require("googleapis");

// Parse the JSON credentials stored in the environment variable
let googleCreds;
try {
  googleCreds = JSON.parse(process.env.GOOGLE_CREDS_JSON);
} catch (error) {
  console.error("Error parsing GOOGLE_CREDS_JSON:", error);
  process.exit(1); // Exit if credentials are malformed
}

// Initialize GoogleAuth with service account credentials
const auth = new google.auth.GoogleAuth({
  credentials: googleCreds,
  scopes: ["https://www.googleapis.com/auth/drive"], // Scope for Google Drive access
});

// Initialize Google Drive API client
const drive = google.drive({ version: "v3", auth });

module.exports = { auth, drive };
