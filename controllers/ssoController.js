// controllers/ssoController.js

// Handle GET/POST requests
exports.handleSSO = (req, res) => {
  res.status(200).json({
    message: "SSO endpoint hit successfully!",
  });
};

// Handle preflight OPTIONS requests
exports.handleSSOPreflight = (req, res) => {
  res.status(204).send(); // No content response for preflight
};
