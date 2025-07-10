// =======================================================
// File: services/ghlService.js
// Description: Encapsulates all GoHighLevel (GHL) API interactions.
// =======================================================

const axios = require("axios");
const qs = require("querystring");

const GHL_API_DOMAIN = process.env.GHL_API_DOMAIN;
const GHL_CLIENT_ID = process.env.GHL_CLIENT_ID;
const GHL_CLIENT_SECRET = process.env.GHL_CLIENT_SECRET;
const GHL_API_VERSION = "2021-07-28"; // Consistent API version

/**
 * Common headers for GHL API requests.
 */
const getGhlHeaders = (accessToken) => ({
  Accept: "application/json",
  "Content-Type": "application/json",
  Version: GHL_API_VERSION,
  Authorization: `Bearer ${accessToken}`,
});

/**
 * Exchanges an authorization code for access and refresh tokens.
 * @param {string} code - The authorization code.
 * @returns {Object} - The token data.
 */
async function getAccessToken(code) {
  const body = qs.stringify({
    client_id: GHL_CLIENT_ID,
    client_secret: GHL_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
  });
  try {
    const response = await axios.post(`${GHL_API_DOMAIN}/oauth/token`, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    if (response.data?.access_token) return response.data;
    throw new Error("Failed to obtain access token from GHL.");
  } catch (error) {
    console.error(
      "Error exchanging code for access token:",
      error.response?.data || error.message
    );
    throw new Error(
      `GHL Token Exchange Failed: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

/**
 * Refreshes the access token using the provided refresh token.
 * @param {string} refreshToken - The refresh token.
 * @returns {Object} - The new tokens and expiry information.
 */
async function refreshAccessToken(refreshToken) {
  const body = qs.stringify({
    client_id: GHL_CLIENT_ID,
    client_secret: GHL_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  try {
    const response = await axios.post(`${GHL_API_DOMAIN}/oauth/token`, body, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Version: GHL_API_VERSION,
        Accept: "application/json",
      },
    });
    if (response.data?.access_token) return response.data;
    throw new Error("Failed to refresh access token from GHL.");
  } catch (error) {
    console.error(
      "Error refreshing GHL access token:",
      error.response?.data || error.message
    );
    throw new Error(
      `GHL Token Refresh Failed: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

/**
 * Retrieves a location-specific access token using agency-level OAuth credentials.
 * @param {string} companyId - The agency company ID.
 * @param {string} locationId - The location ID for which the token is requested.
 * @param {string} agencyAccessToken - The agency-level access token.
 * @returns {string} - The location-specific access token.
 */
async function getLocationAccessToken(
  companyId,
  locationId,
  agencyAccessToken
) {
  console.log("Generating token for location:", locationId);
  const url = `${GHL_API_DOMAIN}/oauth/locationToken`;
  try {
    const response = await axios.post(
      url,
      qs.stringify({
        companyId: companyId,
        locationId: locationId,
      }),
      {
        headers: {
          Version: GHL_API_VERSION,
          Accept: "application/json",
          Authorization: `Bearer ${agencyAccessToken}`,
        },
      }
    );
    if (
      response.status === 201 &&
      response.data &&
      response.data.access_token
    ) {
      console.log("Token generated for location", locationId);
      return response.data.access_token;
    } else {
      throw new Error("Failed to obtain location access token from GHL.");
    }
  } catch (error) {
    console.error(
      "Error obtaining GHL location access token for",
      locationId,
      ":",
      error.response?.data || error.message
    );
    throw new Error(
      `GHL Location Token Failed: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

/**
 * Checks if a user already exists by email within a company.
 * @param {string} companyId - The company ID to search within.
 * @param {string} email - The email to search for.
 * @param {string} accessToken - The agency access token.
 * @returns {boolean} - True if user exists, false otherwise.
 */
async function checkUserExists(companyId, email, accessToken) {
  const searchUrl = `${GHL_API_DOMAIN}/users/search?companyId=${companyId}&query=${encodeURIComponent(
    email
  )}`;
  try {
    const { data: searchResponse } = await axios.get(searchUrl, {
      headers: getGhlHeaders(accessToken),
    });
    return searchResponse && searchResponse.count && searchResponse.count > 0;
  } catch (error) {
    console.error(
      "Error checking GHL user existence:",
      error.response?.data || error.message
    );
    throw new Error(
      `GHL User Check Failed: ${error.response?.data?.message || error.message}`
    );
  }
}

/**
 * Creates a new account (location) in GHL.
 * @param {string} accessToken - The agency access token.
 * @param {Object} accountData - Data for the new account.
 * @returns {Object} - The created account data.
 */
async function createAccount(accessToken, accountData) {
  const url = `${GHL_API_DOMAIN}/locations/`;
  try {
    console.log("Creating account (location) with GHL API...");
    const { data } = await axios.post(url, accountData, {
      headers: getGhlHeaders(accessToken),
    });
    console.log("GHL Account creation successful. Account ID:", data.id);
    return data;
  } catch (error) {
    console.error(
      "Error creating GHL account:",
      error.response?.data || error.message
    );
    throw new Error(
      `GHL Account Creation Failed: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

/**
 * Creates a user by calling the LeadConnectorHQ user creation API.
 * @param {string} accessToken - The agency access token.
 * @param {Object} payload - User data payload.
 * @returns {Object} - The created user data.
 */
async function createUser(accessToken, payload) {
  const url = `${GHL_API_DOMAIN}/users/`;
  try {
    console.log("Calling GHL user creation API...");
    const { data } = await axios.post(url, payload, {
      headers: getGhlHeaders(accessToken),
    });
    console.log("GHL User creation successful.");
    return data;
  } catch (error) {
    console.error(
      "Error creating GHL user:",
      error.response?.data || error.message
    );
    throw new Error(
      `GHL User Creation Failed: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

/**
 * Retrieves the funnel list and extracts the page ID from the "Client Portal" step.
 * @param {string} locationId - The location ID.
 * @param {string} accessToken - The location-specific access token.
 * @returns {string} - The command center page ID.
 */
async function getFunnelList(locationId, accessToken) {
  const funnelUrl = `${GHL_API_DOMAIN}/funnels/funnel/list`;
  try {
    console.log("Fetching GHL funnel list for location:", locationId);
    const response = await axios.get(funnelUrl, {
      headers: getGhlHeaders(accessToken),
      params: { locationId },
    });

    const funnel = response.data?.funnels?.[0];
    if (!funnel) {
      throw new Error("No funnels available in the GHL response.");
    }
    const clientPortalStep = funnel.steps.find(
      (step) => step.name === "Client Portal"
    );
    if (!clientPortalStep || !clientPortalStep.pages?.[0]) {
      throw new Error("Client Portal step or page ID not found in funnel.");
    }
    const pageId = clientPortalStep.pages[0];
    console.log("GHL Funnel list retrieved. Command Center Page ID:", pageId);
    return pageId;
  } catch (error) {
    console.error(
      "Error fetching GHL funnel list:",
      error.response?.data || error.message
    );
    throw new Error(
      `GHL Funnel List Failed: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

/**
 * Retrieves custom values for the specified location.
 * @param {string} locationId - The location ID.
 * @param {string} accessToken - The location-specific access token.
 * @returns {Array} - Array of custom value objects.
 */
async function getCustomValues(locationId, accessToken) {
  const url = `${GHL_API_DOMAIN}/locations/${locationId}/customValues`;
  try {
    console.log("Fetching GHL custom values for location:", locationId);
    const response = await axios.get(url, {
      headers: getGhlHeaders(accessToken),
    });
    console.log("GHL Custom values fetched for location:", locationId);
    return response.data.customValues;
  } catch (err) {
    console.error(
      "Error getting GHL custom values for location",
      locationId,
      ":",
      err.response?.data || err.message
    );
    throw new Error(
      `GHL Custom Values Failed: ${err.response?.data?.message || err.message}`
    );
  }
}

/**
 * Updates a specific custom value for a location.
 * @param {string} locationId - The location ID.
 * @param {string} customValueId - The ID of the custom value field to update.
 * @param {string} name - The name of the custom value field.
 * @param {string} value - The new value for the custom field.
 * @param {string} accessToken - The location-specific access token.
 */
async function updateCustomValue(
  locationId,
  customValueId,
  name,
  value,
  accessToken
) {
  const url = `${GHL_API_DOMAIN}/locations/${locationId}/customValues/${customValueId}`;
  const payload = { name, value };
  try {
    console.log(`Updating GHL custom value "${name}" to "${value}"...`);
    await axios.put(url, payload, {
      headers: getGhlHeaders(accessToken),
    });
    console.log(`GHL Custom value "${name}" updated successfully.`);
  } catch (error) {
    console.error(
      `Error updating GHL custom value "${name}":`,
      error.response?.data || error.message
    );
    // Don't re-throw if it's not critical, or wrap for specific handling.
    // For now, re-throwing to let the main flow handle it.
    throw new Error(
      `GHL Custom Value Update Failed for "${name}": ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

/**
 * Updates the snapshot field for a location (account).
 * @param {string} locationId - The location ID.
 * @param {string} snapshotId - The snapshot ID to update.
 * @param {string} accessToken - The agency-level access token.
 * @param {boolean} [override=true] - Whether to override the snapshot.
 * @returns {Object} - The response data.
 */
async function updateAccountSnapshot(
  locationId,
  snapshotId,
  accessToken,
  override = true
) {
  console.log(
    "Updating snapshot for location:",
    locationId,
    "with snapshotId:",
    snapshotId
  );
  // Note: Your original code obtained a location-specific token here.
  // This function might need the agency token or a newly generated location token depending on GHL API docs.
  // Assuming agencyAccessToken is passed if the operation requires it.
  const url = `${GHL_API_DOMAIN}/locations/${locationId}`;
  const options = {
    method: "PUT",
    url: url,
    headers: getGhlHeaders(accessToken), // Use agency token for this call if it's an agency-level operation
    data: {
      companyId: process.env.GHL_COMPANY_ID, // Use companyId from env
      snapshot: { id: snapshotId, override: override },
    },
  };
  try {
    const { data } = await axios.request(options);
    console.log("Snapshot update successful for location:", locationId);
    return data;
  } catch (error) {
    console.error(
      "Error updating GHL account snapshot:",
      error.response?.data || error.message
    );
    throw new Error(
      `GHL Snapshot Update Failed: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

module.exports = {
  getAccessToken,
  refreshAccessToken,
  getLocationAccessToken,
  checkUserExists,
  createAccount,
  createUser,
  getFunnelList,
  getCustomValues,
  updateCustomValue,
  updateAccountSnapshot,
};
