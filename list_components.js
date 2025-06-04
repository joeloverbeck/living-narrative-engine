/* eslint-env node */
/* eslint-disable no-console */

// Import the promises API from the 'fs' module
const fs = require('fs').promises;
// Import the 'path' module
const path = require('path');

// Define the relative path to the directory
const relativeDirPath = 'data/components';

// Construct the absolute path relative to where 'node' is executed
const directoryPath = path.join(process.cwd(), relativeDirPath);

/**
 * @description Retrieve all filenames in the components data directory.
 * @returns {Promise<string[]>} Array of filenames or an empty array on error.
 */
async function getFilenames() {
  try {
    // Read the directory contents asynchronously
    const filenames = await fs.readdir(directoryPath);

    // Return the array (the actual strings in the array don't have quotes)
    return filenames;
  } catch (err) {
    // Handle potential errors
    console.error(`Error reading directory ${directoryPath}:`, err);
    // Return an empty array to indicate failure gracefully
    return [];
  }
}

// --- Main Execution Logic ---
// This part runs automatically when the script is executed with 'node'

console.log(`Attempting to read directory: ${directoryPath}`);

// Call the async function and handle the result (Promise)
getFilenames()
  .then((files) => {
    // This code runs *after* getFilenames completes
    if (files && files.length >= 0) {
      // Check if files is a valid array (even empty)

      // --- MODIFICATION HERE ---
      // Use JSON.stringify to format the array output with double quotes
      const jsonFormattedFilenames = JSON.stringify(files, null, 2); // Use null, 2 for pretty printing

      if (files.length > 0) {
        console.log('Successfully retrieved filenames (JSON format):');
        console.log(jsonFormattedFilenames);
        // Example output:
        // [
        //   "attack_attempted.event.json",
        //   "move_attempted.event.json"
        // ]
      } else {
        console.log(
          'Directory read successfully, but it contains no files (JSON format):'
        );
        console.log(jsonFormattedFilenames); // Will output: []
      }
      // You can now copy the output starting from '[' to ']' directly into a JSON file.
    } else {
      // This case might occur if the catch block didn't return []
      console.log('Could not retrieve filenames (check error message above).');
    }
  })
  .catch((error) => {
    console.error('An unexpected error occurred during execution:', error);
  });
