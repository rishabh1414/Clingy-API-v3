// =======================================================
// File: services/googleDriveService.js
// Description: Encapsulates all Google Drive API interactions.
// =======================================================

const { drive } = require("../config/google"); // Import the pre-initialized Drive client

/**
 * createFolder
 * Creates a Google Drive folder under the specified parent folder and shares it with a user.
 *
 * @param {string} newFolderName - The name of the new folder.
 * @param {string} parentFolderId - The ID of the parent folder.
 * @param {string} userEmail - Email address of the user to share the folder with.
 * @returns {string} - The created folder's ID.
 */
async function createFolder(newFolderName, parentFolderId, userEmail) {
  try {
    console.log("Creating Google Drive folder...");
    const folderMetadata = {
      name: newFolderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    };
    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: "id", // Request only the ID field␊
    });
    const folderId = folder.data.id;
    console.log("Google Drive Folder created with ID:", folderId);

    // Share the folder with the specified user.
    await drive.permissions.create({
      fileId: folderId,
      requestBody: {
        type: "user",
        role: "writer", // Grant editor access␊
        emailAddress: userEmail,
      },
      fields: "id", // Request only the permission ID field␊
      sendNotificationEmails: false, // Optional: set to true if you want to notify the user␊
    });
    console.log("Google Drive Folder created and shared successfully.");
    return folderId;
  } catch (error) {
    console.error(
      "Error creating or sharing Google Drive folder:",
      error.errors ? JSON.stringify(error.errors) : error.message
    );
    throw new Error(`Google Drive Folder Creation Failed: ${error.message}`);
  }
}

module.exports = {
  createFolder,
};
