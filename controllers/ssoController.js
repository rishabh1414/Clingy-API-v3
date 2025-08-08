const CryptoJS = require("crypto-js");

// Function to decrypt user data as per GHL documentation
const decryptUserData = (req, res) => {
  console.log("=== SSO Decryption Request ===");

  const { encryptedData } = req.body;
  // Updated to use the correct environment variable name from GHL documentation
  const sharedSecretKey = process.env.GHL_APP_SHARED_SECRET;

  console.log(
    "Encrypted data received:",
    encryptedData ? "Present" : "Missing"
  );
  console.log("Shared secret configured:", sharedSecretKey ? "Yes" : "No");
  console.log(
    "Encrypted data length:",
    encryptedData ? encryptedData.length : 0
  );

  if (!encryptedData) {
    console.error("Missing encrypted data in request body");
    return res.status(400).json({
      error: "Missing encrypted data",
    });
  }

  if (!sharedSecretKey) {
    console.error(
      "GHL_APP_SHARED_SECRET not configured in environment variables"
    );
    return res.status(500).json({
      error: "Server configuration error: SSO key not configured",
    });
  }

  try {
    console.log("Attempting to decrypt user data...");

    // Decrypt using CryptoJS as per GHL documentation
    const decrypted = CryptoJS.AES.decrypt(
      encryptedData,
      sharedSecretKey
    ).toString(CryptoJS.enc.Utf8);

    if (!decrypted) {
      console.error("Decryption resulted in empty string");
      throw new Error("Decryption failed - check your SSO secret key");
    }

    console.log("Decryption successful, parsing JSON...");
    const userData = JSON.parse(decrypted);

    console.log("User data parsed successfully:", {
      userId: userData.userId,
      companyId: userData.companyId,
      type: userData.type,
      role: userData.role,
      activeLocation: userData.activeLocation || "None",
      userName: userData.userName,
      email: userData.email,
    });

    res.json(userData);
  } catch (error) {
    console.error("SSO decryption error:", error.message);

    let errorMessage = "Failed to decrypt user data";
    if (error.message.includes("Malformed UTF-8")) {
      errorMessage =
        "Invalid SSO secret key - please verify your shared secret";
    } else if (error.message.includes("JSON")) {
      errorMessage = "Invalid data format after decryption";
    }

    res.status(400).json({
      error: errorMessage,
      debug: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Placeholder function to handle preflight requests for /ghl route
const handleSSOPreflight = (req, res) => {
  res.status(204).send(); // No Content
};

// Placeholder function for the legacy /ghl SSO routes
const handleSSO = (req, res) => {
  res
    .status(501)
    .json({ message: "This legacy SSO endpoint is not implemented." });
};

module.exports = {
  decryptUserData,
  handleSSOPreflight,
  handleSSO,
};
