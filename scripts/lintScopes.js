#!/usr/bin/env node

const defaultFs = require('fs/promises');
const defaultPath = require('path');
const { parseInlineExpr } = require('../src/scopeDsl/parser.js');

/**
 * Recursively find all .scope files in the mods directory
 * @param {string} dir - Directory to search
 * @param {object} fs - fs/promises module
 * @param {object} path - path module
 * @returns {Promise<string[]>} Array of .scope file paths
 */
async function findScopeFiles(dir, fs = defaultFs, path = defaultPath) {
  const scopeFiles = [];
  try {
    const items = await fs.readdir(dir);
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = await fs.stat(itemPath);
      if (stat.isDirectory()) {
        const subFiles = await findScopeFiles(itemPath, fs, path);
        scopeFiles.push(...subFiles);
      } else if (path.extname(item) === '.scope') {
        scopeFiles.push(itemPath);
      }
    }
  } catch (error) {
    // Skip directories that can't be read
    console.error(`Warning: Could not read directory ${dir}: ${error.message}`);
  }
  return scopeFiles;
}

/**
 * Parse a single scope file and return any errors
 * @param {string} filePath - Path to the .scope file
 * @param {object} fs - fs/promises module
 * @returns {Promise<{file: string, error: string} | null>} Error object or null if valid
 */
async function validateScopeFile(filePath, fs = defaultFs) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    if (!content.trim()) {
      return {
        file: filePath,
        error: 'Empty scope file'
      };
    }
    parseInlineExpr(content.trim());
    return null;
  } catch (error) {
    return {
      file: filePath,
      error: error.message
    };
  }
}

/**
 * Main linting function
 * @param {string} modsDirArg - Optional mods directory
 * @param {object} fs - Optional fs/promises module
 * @param {object} path - Optional path module
 */
async function lintScopes(modsDirArg, fs = defaultFs, path = defaultPath) {
  const modsDir = modsDirArg || path.join(__dirname, '..', 'data', 'mods');
  let validCount = 0;
  let errorCount = 0;
  try {
    const scopeFiles = await findScopeFiles(modsDir, fs, path);
    if (scopeFiles.length === 0) {
      console.log('✓ 0 scope files valid');
      process.exit(0);
    }
    for (const filePath of scopeFiles) {
      const error = await validateScopeFile(filePath, fs);
      if (error) {
        console.error(`❌ ${error.file}: ${error.error}`);
        errorCount++;
      } else {
        validCount++;
      }
    }
    if (errorCount > 0) {
      console.error(`\nFound ${errorCount} error(s) in scope files`);
      process.exit(1);
    } else {
      console.log(`✓ ${validCount} scope files valid`);
      process.exit(0);
    }
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  findScopeFiles,
  validateScopeFile,
  lintScopes
};

if (require.main === module) {
  lintScopes();
} 