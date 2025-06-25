#!/usr/bin/env node
/**
 * @file Scripts that looks through the codebase and data files to find where *.condition.json files are referenced by name.
 * This is useful to find orphaned conditions.
 * @see scripts/findConditionReferences.js
 */

const fs = require('fs/promises');
const path = require('path');

// --- CONFIGURATION ---
const ROOT_DIR = path.join(__dirname, '..'); // Assumes script is in a 'scripts' directory
const MODS_DIR = path.join(ROOT_DIR, 'data', 'mods'); // Specific directory for mods
const CONDITION_FILE_ENDING = '.condition.json';
// Add .scope and other source files to the list of files to search for references
const SEARCH_TARGET_EXTENSIONS = ['.js', '.html', '.json', '.scope'];
// Directories to ignore when searching
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.idea',
  'dist',
  'build',
  'coverage', // Often good to ignore test coverage reports
]);

/**
 * Recursively finds all files ending with specific strings in a directory, respecting an ignore list.
 * @param {string} dir - The directory to start searching from.
 * @param {string[]} targetEndings - An array of file endings to find (e.g., ['.js', '.ts', '.condition.json']).
 * @returns {Promise<string[]>} A promise that resolves to an array of full file paths.
 */
async function findFilesByEnding(dir, targetEndings) {
  const foundFiles = [];
  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      const itemPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (!IGNORE_DIRS.has(item.name)) {
          const subFiles = await findFilesByEnding(itemPath, targetEndings);
          foundFiles.push(...subFiles);
        }
      } else { // It's a file, check if its name ends with any of the target strings
        for (const ending of targetEndings) {
          if (item.name.endsWith(ending)) {
            foundFiles.push(itemPath);
            break; // Match found, no need to check other endings for this file
          }
        }
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`⚠️  Warning: Could not read directory ${dir}: ${error.message}`);
    }
  }
  return foundFiles;
}

/**
 * Searches a single file for an identifier and returns the line numbers of any matches.
 * @param {string} filePath - The path to the file to search.
 * @param {string} identifier - The string identifier to search for.
 * @returns {Promise<number[]>} A promise that resolves to an array of line numbers where the identifier was found.
 */
async function searchFileForIdentifier(filePath, identifier) {
  const matches = [];
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    // The identifier is escaped to handle any special regex characters it might contain.
    const escapedIdentifier = identifier.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    // This regex looks for the identifier, potentially preceded by a 'namespace:' and followed by a word boundary.
    const searchRegex = new RegExp(`(core:|intimacy:)?${escapedIdentifier}\\b`);

    for (let i = 0; i < lines.length; i++) {
      if (searchRegex.test(lines[i])) {
        matches.push(i + 1); // Add 1 for human-readable line numbers
      }
    }
  } catch (error) {
    console.error(`⚠️  Warning: Could not read file ${filePath}: ${error.message}`);
  }
  return matches;
}

/**
 * Main function to find and report on condition file references.
 */
async function main() {
  console.log('🔍 Starting reference search...');

  // 1. Find all '.condition.json' files specifically within the mods directory
  console.log(`\nScanning for condition files...`);
  const conditionFiles = await findFilesByEnding(
    MODS_DIR,
    [CONDITION_FILE_ENDING]
  );

  if (conditionFiles.length === 0) {
    console.log('\n✅ No *.condition.json files found. Please check the `MODS_DIR` path and file locations.');
    return;
  }
  console.log(`Found ${conditionFiles.length} condition file(s) to process.`);

  // 2. Find all files to search within (source code, json, and scope files)
  console.log('\nScanning for files to search within (source code, json, scope)...');
  const filesToSearch = await findFilesByEnding(
    ROOT_DIR,
    SEARCH_TARGET_EXTENSIONS
  );
  console.log(`Found ${filesToSearch.length} file(s) to search.`);

  // 3. For each condition, search all other files for its identifier
  const allReferences = {};
  const totalIdentifiers = conditionFiles.map(f => path.basename(f, CONDITION_FILE_ENDING));

  for (const conditionFile of conditionFiles) {
    const identifier = path.basename(conditionFile, CONDITION_FILE_ENDING);
    console.log(`\n--- Searching for references to: "${identifier}" ---`);

    for (const file of filesToSearch) {
      // A file should not be considered to "reference itself".
      if (file === conditionFile) {
        continue;
      }

      const matchingLines = await searchFileForIdentifier(file, identifier);

      if (matchingLines.length > 0) {
        // Initialize the array if this is the first reference found
        if (!allReferences[identifier]) {
          allReferences[identifier] = [];
        }

        const relativePath = path.relative(ROOT_DIR, file);
        allReferences[identifier].push({
          file: relativePath,
          lines: matchingLines,
        });
        // Log found references immediately
        console.log(`  Found in ./${relativePath} on line(s): ${matchingLines.join(', ')}`);
      }
    }
  }

  // 4. Final summary
  console.log('\n--- ✅ Search Complete ---');
  const referencedIdentifiers = Object.keys(allReferences);

  console.log(`Found references for ${referencedIdentifiers.length} out of ${totalIdentifiers.length} total identifiers.`);

  const unreferenced = totalIdentifiers.filter(id => !referencedIdentifiers.includes(id));

  if (unreferenced.length > 0) {
    console.log('\n--- ⚠️  Unreferenced Identifiers ---');
    unreferenced.forEach(id => console.log(`  - ${id}`));
  } else {
    console.log('\n✅ All identifiers appear to be referenced.');
  }
}

// Allow the script to be run directly from the command line
if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ A fatal error occurred:');
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  findFilesByEnding,
  searchFileForIdentifier,
};
