/**
 * @file cleanupTestDirectories.js
 * @description Jest setup file that cleans up orphaned test directories before tests run
 *
 * This file ensures that any test-temp-* directories left behind from previous
 * test runs (due to crashes, interruptions, or failures) are cleaned up before
 * new tests begin.
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Cleans up any orphaned test-temp-* directories in the data folder
 */
async function cleanupOrphanedTestDirectories() {
  const dataDir = path.join(process.cwd(), 'data');

  try {
    // Read all entries in the data directory
    const entries = await fs.readdir(dataDir, { withFileTypes: true });

    // Find all test-temp-* directories
    const testTempDirs = entries
      .filter((entry) => entry.isDirectory())
      .filter((entry) => entry.name.startsWith('test-temp-'))
      .map((entry) => path.join(dataDir, entry.name));

    if (testTempDirs.length > 0) {
      console.log(
        `[Test Setup] Found ${testTempDirs.length} orphaned test directories to clean up`
      );

      // Remove each test directory
      for (const dir of testTempDirs) {
        try {
          await fs.rm(dir, { recursive: true, force: true });
          console.log(
            `[Test Setup] Removed orphaned test directory: ${path.basename(dir)}`
          );
        } catch (error) {
          console.warn(`[Test Setup] Failed to remove ${dir}:`, error.message);
        }
      }
    }
  } catch (error) {
    // If data directory doesn't exist or can't be read, that's okay
    if (error.code !== 'ENOENT') {
      console.warn(
        '[Test Setup] Error during test directory cleanup:',
        error.message
      );
    }
  }
}

// Run cleanup before tests start
// Wrap in IIFE to handle async operation in CommonJS module
(async () => {
  await cleanupOrphanedTestDirectories();
})();
