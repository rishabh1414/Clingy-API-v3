// =======================================================
// File: server.js
// Description: Main application entry point.
// =======================================================

// 1. LOAD DEPENDENCIES AND CONFIGURATION
require("dotenv").config(); // Load environment variables first
const express = require("express");
const logger = require("morgan");
const cors = require("cors");
const CryptoJS = require("crypto-js"); // Added for validation/debug functions

// Import internal modules
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorMiddleware");
const authRoutes = require("./routes/authRoutes");
const accountRoutes = require("./routes/accountRoutes");
const tokenRefreshJob = require("./cronJobs/tokenRefreshJob");
const ssoRoutes = require("./routes/ssoRoutes");

const app = express();
const PORT = process.env.PORT || 8080;

// ==========================================
// 2. DEBUGGING AND VALIDATION HELPERS
// ==========================================

function validateSSOConfiguration() {
  console.log("=== SSO Configuration Validation ===");

  // Updated to use the correct environment variable name from GHL documentation
  const ssoKey = process.env.GHL_APP_SHARED_SECRET;
  const companyId = process.env.GHL_COMPANY_ID;

  console.log("GHL_APP_SHARED_SECRET configured:", !!ssoKey);
  console.log("GHL_COMPANY_ID configured:", !!companyId);

  if (!ssoKey) {
    console.error("❌ CRITICAL: GHL_APP_SHARED_SECRET is missing!");
    console.log(
      "Please add your Shared Secret from GHL App Settings to .env file:"
    );
    console.log("GHL_APP_SHARED_SECRET=your_shared_secret_here");
    return false;
  }

  if (ssoKey.length < 10) {
    console.error("❌ WARNING: SSO key seems too short, please verify");
    return false;
  }

  // Test the SSO key with sample data
  try {
    const testData = { test: "validation", userId: "test123" };
    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(testData),
      ssoKey
    ).toString();
    const decrypted = CryptoJS.AES.decrypt(encrypted, ssoKey).toString(
      CryptoJS.enc.Utf8
    );
    JSON.parse(decrypted);

    console.log("✅ SSO key validation successful");
    return true;
  } catch (error) {
    console.error("❌ SSO key validation failed:", error.message);
    return false;
  }
}

// ==========================================
// 3. CORS CONFIGURATION
// ==========================================

const allowedOrigins = [
  "https://app.gohighlevel.com",
  "https://app.highlevel.com",
  "https://sso-app.clingy.app",
  "http://127.0.0.1:5500",
  "https://portal.clingy.app",
  "https://equityproperties.clingy.app",
  "https://offers.nepcashhomebuyers.com",
];

if (process.env.NODE_ENV === "development") {
  allowedOrigins.push("http://localhost:3000", "http://127.0.0.1:3000");
}

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("CORS blocked origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "x-sso-session",
  ],
};

// --- UPDATED FIX ---
// Apply CORS middleware before any routes. This single line handles all requests,
// including preflight OPTIONS requests, and is the standard way to implement CORS.
app.use(cors(corsOptions));

// 4. GLOBAL MIDDLEWARE
app.use(logger("dev"));
app.use(express.json());

// 5. DATABASE CONNECTION
connectDB();

// 6. API ROUTES
app.use("/api/auth", authRoutes);
app.use("/", accountRoutes);
app.use("/api/sso", ssoRoutes);

app.get("/", (req, res) => {
  res.send("Clingy Backend API is running...");
});

// 7. GLOBAL ERROR HANDLING (must be last)
app.use(errorHandler);

// 8. START SERVER AND JOBS
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Run validation on server start
  validateSSOConfiguration();
  // Start scheduled jobs
  tokenRefreshJob.start();
});
