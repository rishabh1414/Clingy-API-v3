// =======================================================
// File: models/OAuthCredentials.js
// Description: Defines the Mongoose schema for OAuth credentials.
// =======================================================

const mongoose = require("mongoose");

const OAuthCredentialsSchema = new mongoose.Schema({
  access_token: { type: String, required: true },
  refresh_token: { type: String, required: true },
  expires_in: { type: Number, required: true }, // TTL in seconds
  userId: { type: String },
  locationId: { type: String },
  companyId: { type: String, required: true },
  created_at: { type: Date, default: Date.now }, // Timestamp when tokens were last obtained/refreshed
});

// Create a unique index on companyId if each company should only have one set of credentials
OAuthCredentialsSchema.index({ companyId: 1 }, { unique: true });

const OAuthCredentials = mongoose.model(
  "OAuthCredentials",
  OAuthCredentialsSchema
);

module.exports = OAuthCredentials;
