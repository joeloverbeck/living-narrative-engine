/**
 * @file File operation utilities for build system
 * Provides async file operations with error handling
 */

const fs = require('fs-extra');
const path = require('path');
const { glob } = require('glob');

/**
 * Copy files matching patterns
 *
 * @param {Array<string>} patterns - Glob patterns
 * @param {string} destDir - Destination directory
 * @returns {Promise<Array<string>>} Copied files
 */
async function copyPatterns(patterns, destDir) {
  const copiedFiles = [];

  for (const pattern of patterns) {
    const files = await glob(pattern, { nodir: true });

    for (const file of files) {
      const destPath = path.join(destDir, path.basename(file));
      await fs.copy(file, destPath, { overwrite: true });
      copiedFiles.push(destPath);
    }
  }

  return copiedFiles;
}

/**
 * Clean directory (create if not exists, empty if exists)
 *
 * @param {string} dir - Directory path
 */
async function cleanDirectory(dir) {
  await fs.emptyDir(dir);
}

/**
 * Ensure directory exists
 *
 * @param {string} dir - Directory path
 */
async function ensureDirectory(dir) {
  await fs.ensureDir(dir);
}

/**
 * Copy directory with progress callback
 *
 * @param {string} src - Source directory
 * @param {string} dest - Destination directory
 * @param {Function} [onProgress] - Progress callback
 */
async function copyDirectory(src, dest, onProgress) {
  const files = await getAllFiles(src);
  let copied = 0;

  for (const file of files) {
    const relativePath = path.relative(src, file);
    const destPath = path.join(dest, relativePath);

    try {
      await fs.ensureDir(path.dirname(destPath));
      await fs.copy(file, destPath, { overwrite: true });

      copied++;
      if (onProgress) {
        onProgress(copied, files.length, file);
      }
    } catch (error) {
      // Check if this is a private mod (p_*) that we should skip silently
      const pathParts = relativePath.split(path.sep);
      if (pathParts.some(part => part.startsWith('p_'))) {
        // Silently skip files in private mods
        continue;
      }
      // Re-throw error for non-private content
      throw error;
    }
  }
}

/**
 * Get all files in directory recursively
 *
 * @param {string} dir - Directory path
 * @returns {Promise<Array<string>>} File paths
 */
async function getAllFiles(dir) {
  const files = [];

  /**
   *
   * @param currentDir
   */
  async function traverse(currentDir) {
    const items = await fs.readdir(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      
      try {
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          await traverse(fullPath);
        } else {
          files.push(fullPath);
        }
      } catch (error) {
        // Silently skip inaccessible items that start with "p_"
        // This handles broken symlinks to private repositories
        if (item.startsWith('p_')) {
          continue;
        }
        // Re-throw error for non-private content
        throw error;
      }
    }
  }

  await traverse(dir);
  return files;
}

/**
 * Check if file exists
 *
 * @param {string} filePath - File path
 * @returns {Promise<boolean>} True if exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file size
 *
 * @param {string} filePath - File path
 * @returns {Promise<number>} Size in bytes
 */
async function getFileSize(filePath) {
  const stats = await fs.stat(filePath);
  return stats.size;
}

/**
 * Read JSON file
 *
 * @param {string} filePath - File path
 * @returns {Promise<any>} Parsed JSON
 */
async function readJson(filePath) {
  return fs.readJson(filePath);
}

/**
 * Write JSON file
 *
 * @param {string} filePath - File path
 * @param {any} data - Data to write
 * @param {object} [options] - Write options
 */
async function writeJson(filePath, data, options = {}) {
  await fs.writeJson(filePath, data, {
    spaces: 2,
    ...options,
  });
}

module.exports = {
  copyPatterns,
  cleanDirectory,
  ensureDirectory,
  copyDirectory,
  getAllFiles,
  fileExists,
  getFileSize,
  readJson,
  writeJson,
};
