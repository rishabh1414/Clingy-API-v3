// =======================================================
// File: controllers/accountController.js
// Description: Handles requests related to account creation and agency token.
// Orchestrates calls to GHL service, Google Drive service, and models.
// Uses Server-Sent Events (SSE) for real-time updates during account creation.
// =======================================================

const ghlService = require("../services/ghlService");
const googleDriveService = require("../services/googleDriveService");
const OAuthCredentials = require("../models/OAuthCredentials");
const { delay } = require("../services/utils");

const GHL_SNAPSHOT_ID = process.env.GHL_SNAPSHOT_ID;
const GHL_PARENT_LOCATION_ID = process.env.GHL_PARENT_LOCATION_ID; // The agency's parent location ID
const GOOGLE_DRIVE_PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
const GHL_AGENCY_COMPANY_ID = process.env.GHL_COMPANY_ID; // The static agency companyId

/**
 * SSE endpoint to process account creation and provide real-time updates.
 * @route POST /accountCreationSSE
 */
const createAccountSSE = async (req, res) => {
  console.log("Received /accountCreationSSE request.");

  // Set CORS headers for SSE
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  if (res.flush) res.flush(); // Ensure headers are sent immediately

  // Helper: send major update messages to the client.
  const sendEvent = (msg) => {
    res.write(`data: ${msg}\n\n`);
    if (res.flush) res.flush();
  };

  try {
    // ==============================================================
    // Step 1: Validate Input & Check for Required Fields
    // ==============================================================
    console.log("Step 1: Validating input data.");
    const {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      address1: address,
      city,
      state,
      country,
      postal_code: postalCode,
    } = req.body;
    // Support both "Business Name" (from your JSON) and "business_name" (default)
    const businessName = req.body["Business Name"] || req.body.business_name;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !businessName ||
      !phone ||
      !address ||
      !city ||
      !state ||
      !country ||
      !postalCode
    ) {
      console.error("Missing required fields in the request body.");
      sendEvent("❌ Error: Missing required fields.");
      return res.end();
    }
    console.log("Step 1 Completed: All required fields are provided.");

    // ==============================================================
    // Step 2: Retrieve OAuth Credentials and Check User Uniqueness
    // ==============================================================
    console.log("Step 2: Retrieving OAuth credentials.");
    const credentials = await OAuthCredentials.findOne({
      companyId: GHL_AGENCY_COMPANY_ID,
    });
    if (!credentials || !credentials.access_token) {
      console.error("Access token not available. Authorization required.");
      sendEvent(
        "❌ Error: Access token not available. Please authorize first."
      );
      return res.end();
    }
    const agencyAccessToken = credentials.access_token;
    const agencyCompanyId = credentials.companyId || GHL_AGENCY_COMPANY_ID; // Fallback to env if not in DB

    console.log("Step 2.1: Checking for existing user with email:", email);
    const userExists = await ghlService.checkUserExists(
      agencyCompanyId,
      email,
      agencyAccessToken
    );
    if (userExists) {
      console.error("User already exists with email:", email);
      sendEvent("❌ Error: User already exists.");
      return res.end();
    }
    console.log("Step 2 Completed: Email is unique.");
    sendEvent("Validating your details...");

    // ==============================================================
    // Step 3: Create Account (Location)
    // ==============================================================
    console.log(
      "Step 3: Creating account (location) with provided business details."
    );
    sendEvent("Creating your new marketing account...");
    const accountData = {
      name: businessName,
      phone: phone,
      companyId: agencyCompanyId,
      address: address,
      city: city,
      state: state,
      country: country,
      postalCode: postalCode,
      prospectInfo: { firstName, lastName, email },
      snapshotId: GHL_SNAPSHOT_ID, // Use snapshotId from environment
    };
    const creationResponse = await ghlService.createAccount(
      agencyAccessToken,
      accountData
    );
    console.log(
      "Step 3 Completed: Account created successfully. Account ID:",
      creationResponse.id
    );
    sendEvent("Welcome aboard! Your journey to smarter marketing starts here.");

    // ==============================================================
    // Step 4: Create User for the New Account
    // ==============================================================
    console.log("Step 4: Creating user for the new account.");
    sendEvent("Setting up your user profile...");
    console.log("Step 4.1: Delaying 10 seconds before user creation.");
    await delay(10000); // Wait for GHL to provision the account
    console.log("Step 4.2: Proceeding with user creation.");

    const password = `Marketcl!ng_${country}${postalCode}`; // Password generation as per original logic
    const userPayload = {
      companyId: agencyCompanyId,
      firstName: firstName,
      lastName: lastName,
      email: email,
      password: password,
      phone: phone,
      type: "account",
      role: "admin",
      locationIds: [creationResponse.id],
      permissions: {
        campaignsEnabled: true,
        campaignsReadOnly: true,
        contactsEnabled: true,
        workflowsEnabled: true,
        workflowsReadOnly: true,
        triggersEnabled: true,
        funnelsEnabled: true,
        websitesEnabled: true,
        opportunitiesEnabled: true,
        dashboardStatsEnabled: true,
        bulkRequestsEnabled: true,
        appointmentsEnabled: true,
        reviewsEnabled: true,
        onlineListingsEnabled: true,
        phoneCallEnabled: true,
        conversationsEnabled: true,
        assignedDataOnly: true,
        adwordsReportingEnabled: true,
        membershipEnabled: true,
        facebookAdsReportingEnabled: true,
        attributionsReportingEnabled: true,
        settingsEnabled: true,
        tagsEnabled: true,
        leadValueEnabled: true,
        marketingEnabled: true,
        agentReportingEnabled: true,
        botService: true,
        socialPlanner: true,
        bloggingEnabled: true,
        invoiceEnabled: true,
        affiliateManagerEnabled: true,
        contentAiEnabled: true,
        refundsEnabled: true,
        recordPaymentEnabled: true,
        cancelSubscriptionEnabled: true,
        paymentsEnabled: true,
        communitiesEnabled: true,
        exportPaymentsEnabled: true,
      },
    };
    await ghlService.createUser(agencyAccessToken, userPayload);
    console.log("Step 4 Completed: User created successfully.");
    sendEvent("You're one step closer to automating your marketing!");

    // ==============================================================
    // Step 5: Retrieve Funnel List for Command Center Link
    // ==============================================================
    console.log("Step 5: Retrieving command center link from funnel list.");
    sendEvent("Configuring your command center...");

    // Get location-specific access token for the newly created location
    const childAccessToken = await ghlService.getLocationAccessToken(
      agencyCompanyId,
      creationResponse.id,
      agencyAccessToken
    );
    await delay(10000); // Delay for GHL to provision location token fully
    console.log("Delay after child access token for funnel list.");

    const funnelPageID = await ghlService.getFunnelList(
      creationResponse.id,
      childAccessToken
    );
    let commandCenterLink = funnelPageID; // The page ID is the link ending
    console.log(
      "Step 5 Completed: Command Center Link retrieved:",
      commandCenterLink
    );

    // ==============================================================
    // Step 6: Create Google Drive Folder
    // ==============================================================
    console.log("Step 6: Creating Google Drive folder.");
    sendEvent(
      "Getting things organized! Your Google Drive folder is on its way."
    );
    let folderId;
    try {
      folderId = await googleDriveService.createFolder(
        creationResponse.name, // Business name for folder name
        GOOGLE_DRIVE_PARENT_FOLDER_ID, // Parent folder ID from env
        creationResponse.email // Email to share with
      );
      console.log("Step 6 Completed: Folder created with ID:", folderId);
      sendEvent("Google Drive folder created successfully.");
    } catch (folderErr) {
      console.error("Error during Google Drive folder creation:", folderErr);
      sendEvent("❌ Error during Google Drive folder creation.");
      return res.end(); // Terminate SSE stream on critical error
    }
    const driveFolderLink = `https://drive.google.com/drive/folders/${folderId}`;
    console.log("Drive Folder Link:", driveFolderLink);

    // ==============================================================
    // Step 7: Update Custom Values
    // ==============================================================
    console.log("Step 7: Processing custom values update.");
    sendEvent("Hang tight! We’re setting up your Clingy experience.");

    const fieldsToSync = [
      "Agency Color 1",
      "Agency Color 2",
      "Agency Dark Logo",
      "Agency Light Logo",
      "Agency Name",
      "Agency Phone Number",
      "Agency Support Email",
      "Command Center Link Ending",
      "Client Assets Folder Link",
    ];

    // Retrieve parent custom values (from your specific parent location)
    const parentAccessToken = await ghlService.getLocationAccessToken(
      agencyCompanyId,
      GHL_PARENT_LOCATION_ID, // Agency's parent location from env
      agencyAccessToken
    );
    const parentCustomValues = await ghlService.getCustomValues(
      GHL_PARENT_LOCATION_ID,
      parentAccessToken
    );
    const parentCustom = {};
    parentCustomValues.forEach((item) => {
      if (fieldsToSync.includes(item.name)) {
        parentCustom[item.name] = {
          id: item.id,
          name: item.name,
          value: item.value,
        };
      }
    });
    await delay(10000); // Pause before retrieving child's custom values

    // Retrieve child's custom values (from the newly created location)
    const childCustomValues = await ghlService.getCustomValues(
      creationResponse.id,
      childAccessToken
    );
    const childCustom = {};
    childCustomValues.forEach((item) => {
      if (fieldsToSync.includes(item.name)) {
        childCustom[item.name] = {
          id: item.id,
          name: item.name,
          value: item.value,
        };
      }
    });
    await delay(5000); // Pause before updating

    // Update each custom field from parent to child (except special ones)
    for (let fieldName of fieldsToSync) {
      if (
        fieldName !== "Client Assets Folder Link" &&
        fieldName !== "Command Center Link Ending"
      ) {
        if (parentCustom[fieldName] && childCustom[fieldName]) {
          try {
            await ghlService.updateCustomValue(
              creationResponse.id,
              childCustom[fieldName].id,
              parentCustom[fieldName].name,
              parentCustom[fieldName].value,
              childAccessToken
            );
          } catch (updateError) {
            console.error(
              `Skipping update for "${fieldName}" due to error:`,
              updateError.message
            );
            // Do not re-throw here to allow other updates to proceed
          }
        }
      }
    }

    // Specifically update "Command Center Link Ending"
    try {
      const commandField = childCustom["Command Center Link Ending"];
      if (commandField && commandCenterLink) {
        await ghlService.updateCustomValue(
          creationResponse.id,
          commandField.id,
          "Command Center Link Ending",
          `/${commandCenterLink}`, // Add leading slash as per original logic
          childAccessToken
        );
      } else {
        console.log(
          "No update required for 'Command Center Link Ending' (field missing or link not found)."
        );
      }
    } catch (cmdUpdateError) {
      console.error(
        "Error updating 'Command Center Link Ending':",
        cmdUpdateError.message
      );
    }

    // Specifically update "Client Assets Folder Link"
    try {
      const clientAssetsField = childCustom["Client Assets Folder Link"];
      if (clientAssetsField) {
        await ghlService.updateCustomValue(
          creationResponse.id,
          clientAssetsField.id,
          "Client Assets Folder Link",
          driveFolderLink,
          childAccessToken
        );
      } else {
        console.log("No custom field found for 'Client Assets Folder Link'.");
      }
    } catch (clientAssetsError) {
      console.error(
        "Error updating 'Client Assets Folder Link':",
        clientAssetsError.message
      );
    }

    sendEvent("Success! Your details are saved, and Clingy is ready to roll.");

    // ==============================================================
    // Final Step: Account Creation Completed
    // ==============================================================
    console.log(
      "All steps completed successfully. Finalizing account creation process."
    );
    sendEvent("Great job! Your account is now active and ready for action.");
    res.end(); // Close the SSE stream
  } catch (err) {
    console.error("Critical error in /accountCreationSSE flow:", err);
    sendEvent(
      "❌ Error: " +
        (err.message || "An unexpected error occurred during account creation.")
    );
    res.end(); // Ensure stream is closed even on error
  }
};

/**
 * Returns the agency-level OAuth token.
 * @route GET /agency-token
 */
const getAgencyToken = async (req, res, next) => {
  try {
    // Pull the most recent credentials document for the agency
    const creds = await OAuthCredentials.findOne({
      companyId: GHL_AGENCY_COMPANY_ID,
    })
      .sort({ created_at: -1 })
      .exec();
    if (!creds || !creds.access_token) {
      const error = new Error(
        "No agency token found. Please ensure OAuth authorization is complete."
      );
      error.statusCode = 404;
      return next(error);
    }
    res.status(200).json({
      accessToken: creds.access_token,
      refreshToken: creds.refresh_token,
    });
  } catch (err) {
    console.error("Error fetching agency token:", err);
    err.statusCode = 500;
    next(err);
  }
};

module.exports = {
  createAccountSSE,
  getAgencyToken,
};
