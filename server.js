// =======================================================
// File: server.js
// Description: Main application entry point. Sets up Express, connects to DB,
// registers routes, initializes cron jobs, and handles global errors.
// =======================================================

// 1. Load Dependencies and Configuration
require("dotenv").config(); // Load environment variables
const express = require("express");
const logger = require("morgan");
const cors = require("cors");

// Import configuration and utilities
const connectDB = require("./config/db");
const errorHandler = require("./middleware/errorMiddleware"); // Centralized error handler
const authRoutes = require("./routes/authRoutes"); // Authentication routes
const accountRoutes = require("./routes/accountRoutes"); // Account creation and SSE routes
const tokenRefreshJob = require("./cronJobs/tokenRefreshJob"); // Scheduled token refresh job
import ssoRoutes from "./routes/ssoRoutes.js";
const app = express();
const PORT = process.env.PORT || 3000;

// 2. CORS Configuration
const allowedOrigins = [
  "https://sso-app.clingy.app",
  "http://127.0.0.1:5500",
  "https://portal.clingy.app",
  "https://equityproperties.clingy.app",
  "https://offers.nepcashhomebuyers.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1) {
        console.log("CORS allowed for origin:", origin);
        callback(null, true);
      } else {
        console.error("CORS blocked for origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-sso-session"],
  })
);

// 3. Global Middleware
app.use(logger("dev")); // HTTP request logger
app.use(express.json()); // Body parser for JSON requests

// 4. Connect to MongoDB
connectDB();

// 5. API Routes
// Register all route modules with their base paths
app.use("/api/auth", authRoutes);
app.use("/", accountRoutes); // SSE endpoint and agency-token are root-level
app.use("/api/sso", ssoRoutes);
// Simple root route
app.get("/", (req, res) => {
  res.send("Clingy Backend API is running...");
});

// 6. Global Error Handling Middleware
// This must be the last middleware added.
app.use(errorHandler);

// 7. Start Scheduled Jobs
tokenRefreshJob.start();

// 8. Start the Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access public routes at http://localhost:${PORT}/api/auth`);
  console.log(
    `Access SSE endpoint at http://localhost:${PORT}/accountCreationSSE`
  );
});
