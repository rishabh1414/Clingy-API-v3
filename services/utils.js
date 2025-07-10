// =======================================================
// File: services/utils.js
// Description: General utility functions.
// =======================================================

/**
 * delay
 * Returns a promise that resolves after the given number of milliseconds.
 *
 * @param {number} ms - Milliseconds to delay.
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  delay,
};
