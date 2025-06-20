// updateManifest.js (Version 2)
/* eslint-env node */
/* global process, __filename */
//
// Description:
// A Node.js script to automatically scan the content directories of a mod
// and update its `mod-manifest.json` file with all the `.json` files found.
// This version automatically discovers new content directories in the mod folder.
//
// Usage:
// node updateManifest.js <mod_name>

const fs = require('fs/promises');
const path = require('path');

// --- CONFIGURATION ---
const MODS_BASE_PATH = path.join('data', 'mods');
const MANIFEST_FILENAME = 'mod-manifest.json';
// List of directories to ignore when auto-discovering content folders.
const IGNORE_DIRS = new Set(['.git', '.idea', 'node_modules']);

/**
 * Main function to run the script logic.
 */
async function main() {
  // 1. Get the mod name from command-line arguments.
  const modName = process.argv[2];
  if (!modName) {
    console.error('Error: Mod name argument is missing.');
    console.error(`Usage: node ${path.basename(__filename)} <mod_name>`);
    process.exit(1);
  }

  console.log(`Starting manifest update for mod: "${modName}"`);

  const modPath = path.join(MODS_BASE_PATH, modName);
  const manifestPath = path.join(modPath, MANIFEST_FILENAME);

  try {
    // 2. Read and parse the existing manifest file.
    console.log(`Reading manifest at: ${manifestPath}`);
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);

    if (!manifest.content || typeof manifest.content !== 'object') {
      console.error('Error: Manifest does not have a valid "content" object.');
      process.exit(1);
    }

    // --- NEW LOGIC: Auto-discover content directories ---
    console.log('Discovering content directories...');
    const modDirEntries = await fs.readdir(modPath, { withFileTypes: true });

    for (const dirent of modDirEntries) {
      // Check if it's a directory and not in the ignore list.
      if (dirent.isDirectory() && !IGNORE_DIRS.has(dirent.name)) {
        // If this directory is not already a key in manifest.content, add it!
        if (
          !Object.prototype.hasOwnProperty.call(manifest.content, dirent.name)
        ) {
          console.log(
            `  - Discovered new content directory: "${dirent.name}". Adding to manifest.`
          );
          manifest.content[dirent.name] = []; // Initialize with an empty array.
        }
      }
    }
    // --- END NEW LOGIC ---

    const contentTypes = Object.keys(manifest.content);
    console.log(`Content types to process: ${contentTypes.join(', ')}`);

    // 3. Scan each content directory and update the manifest object.
    for (const contentType of contentTypes) {
      const contentDirPath = path.join(modPath, contentType);
      let files = [];

      try {
        const dirEntries = await fs.readdir(contentDirPath, {
          withFileTypes: true,
        });

        files = dirEntries
          .filter((dirent) => dirent.isFile() && dirent.name.endsWith('.json'))
          .map((dirent) => dirent.name);

        console.log(
          `  - Scanned "${contentType}": Found ${files.length} file(s).`
        );
      } catch (error) {
        if (error.code === 'ENOENT') {
          // This can happen if a key exists in the manifest but the folder was deleted.
          // We will clear its entry in the manifest.
          console.log(
            `  - Directory not found for "${contentType}", ensuring it is empty in manifest.`
          );
        } else {
          throw error;
        }
      }

      manifest.content[contentType] = files.sort();
    }

    // 4. Write the updated, formatted JSON back to the manifest file.
    const updatedManifestContent = JSON.stringify(manifest, null, 2);
    await fs.writeFile(manifestPath, updatedManifestContent, 'utf8');

    console.log('\n✅ Manifest update complete!');
    console.log(`Successfully updated: ${manifestPath}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`\nError: Could not find mod directory or manifest file.`);
      console.error(`Looked for manifest at: ${manifestPath}`);
    } else if (error instanceof SyntaxError) {
      console.error(`\nError: Failed to parse JSON in ${manifestPath}.`);
      console.error(error.message);
    } else {
      console.error('\nAn unexpected error occurred:');
      console.error(error);
    }
    process.exit(1);
  }
}

main();
