# =======================================================
# File: Dockerfile
# Description: Dockerfile for Node.js Express application for Google Cloud Run.
# =======================================================

# Use an official Node.js runtime as the base image
# Using a specific version (e.g., 18-alpine, 20-slim) is recommended for stability
FROM node:20-slim

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
# This allows caching of dependencies in separate layer
COPY package*.json ./

# Install application dependencies
# The --omit=dev flag prevents installation of devDependencies in production image
RUN npm install --omit=dev

# Copy the rest of the application code to the working directory
COPY . .

# Expose the port your app listens on. Cloud Run injects PORT env var.
# Your server.js already handles process.env.PORT || 3000, so 3000 is a safe default.
EXPOSE 3000

# Define the command to run your application
# `npm start` should be defined in your package.json scripts: "start": "node server.js"
CMD [ "npm", "start" ]

# Note: .env file is NOT copied into the Docker image for security.
# Environment variables will be injected by Cloud Run at deployment time.