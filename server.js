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
const bcrypt = require("bcrypt");

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
// auto-allow *.securebusinessautomation.com + *.base44.app + *.legacyprojector.com
// ==========================================

const allowedExactOrigins = new Set([
  "https://app.gohighlevel.com",
  "https://app.highlevel.com",
  "https://sso-app.clingy.app",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:5501",
  "https://accounts.legacyprojector.com",
  "https://portal.clingy.app",
  "https://equityproperties.clingy.app",
  "https://offers.nepcashhomebuyers.com",
  "https://legacyprojector.com",
  "https://portal.secureautomation.app", // root domain
]);

if (process.env.NODE_ENV === "development") {
  allowedExactOrigins.add("http://localhost:3000");
  allowedExactOrigins.add("http://127.0.0.1:3000");
}

// Wildcard patterns
const SBA_PATTERN = /^https:\/\/([a-z0-9-]+\.)*securebusinessautomation\.com$/i;
const BASE44_PATTERN = /^https:\/\/([a-z0-9-]+\.)*base44\.app$/i;
const LEGACYPROJECTOR_PATTERN =
  /^https:\/\/([a-z0-9-]+\.)*legacyprojector\.com$/i;

function isAllowedOrigin(origin) {
  if (!origin) {
    // Non-browser clients (Postman/cURL) or server-side fetch
    return true;
  }
  if (allowedExactOrigins.has(origin)) return true;

  try {
    const u = new URL(origin);

    if (u.protocol !== "https:") return false;

    // securebusinessautomation.com + subdomains
    if (
      u.hostname === "securebusinessautomation.com" ||
      SBA_PATTERN.test(origin)
    ) {
      return true;
    }

    // base44.app + subdomains
    if (u.hostname === "base44.app" || BASE44_PATTERN.test(origin)) {
      return true;
    }

    // legacyprojector.com + ALL subdomains
    if (
      u.hostname === "legacyprojector.com" ||
      LEGACYPROJECTOR_PATTERN.test(origin)
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

const corsOptions = {
  origin(origin, callback) {
    const allowed = isAllowedOrigin(origin);
    if (allowed) {
      return callback(null, origin || true);
    }
    console.log("CORS blocked origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "x-sso-session",
  ],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.use((req, res, next) => {
  res.setHeader("Vary", "Origin");
  next();
});

// 4. GLOBAL MIDDLEWARE
app.use(logger("dev"));
app.use(express.json());

// 5. DATABASE CONNECTION
connectDB();

// 6. API ROUTES
app.use("/api/auth", authRoutes);
app.use("/", accountRoutes);
app.use("/api/sso", ssoRoutes);

// Utility endpoints for bcrypt hashing/comparison
app.post("/api/utils/hash", async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: "password is required" });
    }

    const hash = await bcrypt.hash(password, 10);
    return res.json({ hash });
  } catch (error) {
    console.error("Error generating bcrypt hash:", error);
    return res.status(500).json({ error: "could not generate hash" });
  }
});

app.post("/api/utils/compare", async (req, res) => {
  try {
    const { password, hash } = req.body;
    if (!password || !hash) {
      return res
        .status(400)
        .json({ error: "password and hash are both required" });
    }

    const match = await bcrypt.compare(password, hash);
    return res.json({ match });
  } catch (error) {
    console.error("Error comparing bcrypt hash:", error);
    return res.status(500).json({ error: "could not compare hash" });
  }
});

app.get("/", (req, res) => {
  res.send("Clingy Backend API is running...");
});

// 7. GLOBAL ERROR HANDLING
app.use(errorHandler);

// 8. START SERVER AND JOBS
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  validateSSOConfiguration();
  tokenRefreshJob.start();
});
