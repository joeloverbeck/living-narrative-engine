// updateManifest.js (Version 3)
/* eslint-env node */
//
// Description:
// A Node.js script to automatically scan the content directories of a mod
// and update its `mod-manifest.json` file with all the `.json` files found.
// This version automatically discovers new content directories in the mod folder
// and handles nested directories like entities/definitions and entities/instances.
//
// Usage:
// node scripts/updateManifest.js <mod_name>  // Update specific mod
// node scripts/updateManifest.js             // Update all mods

const fs = require('fs/promises');
const path = require('path');

// --- CONFIGURATION ---
const MODS_BASE_PATH = path.join('data', 'mods');
const MANIFEST_FILENAME = 'mod-manifest.json';
// List of directories to ignore when auto-discovering content folders.
const IGNORE_DIRS = new Set(['.git', '.idea', 'node_modules']);

// Map folder names to manifest keys for special cases
const FOLDER_TO_KEY_MAP = {
  'anatomy-formatting': 'anatomyFormatting',
};

/**
 * Recursively scan a directory for JSON files, maintaining the relative path structure.
 *
 * @param {string} basePath - The base path to scan from
 * @param {string} currentPath - The current directory being scanned
 * @returns {Promise<string[]>} Array of file paths relative to basePath
 */
async function scanDirectoryRecursively(basePath, currentPath = '') {
  const fullPath = path.join(basePath, currentPath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      const subFiles = await scanDirectoryRecursively(basePath, entryPath);
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      // Add the file with its relative path
      files.push(entryPath);
    }
  }

  return files;
}

/**
 * Recursively scan a directory for scope files (.scope extension), maintaining the relative path structure.
 *
 * @param {string} basePath - The base path to scan from
 * @param {string} currentPath - The current directory being scanned
 * @returns {Promise<string[]>} Array of file paths relative to basePath
 */
async function scanScopeDirectoryRecursively(basePath, currentPath = '') {
  const fullPath = path.join(basePath, currentPath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      const subFiles = await scanScopeDirectoryRecursively(basePath, entryPath);
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.scope')) {
      // Add the scope file with its relative path
      files.push(entryPath);
    }
  }

  return files;
}

/**
 * Recursively scan a directory for blueprint files (.blueprint.json extension), maintaining the relative path structure.
 *
 * @param {string} basePath - The base path to scan from
 * @param {string} currentPath - The current directory being scanned
 * @returns {Promise<string[]>} Array of file paths relative to basePath
 */
async function scanBlueprintDirectoryRecursively(basePath, currentPath = '') {
  const fullPath = path.join(basePath, currentPath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      const subFiles = await scanBlueprintDirectoryRecursively(
        basePath,
        entryPath
      );
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.blueprint.json')) {
      // Add the blueprint file with its relative path
      files.push(entryPath);
    }
  }

  return files;
}

/**
 * Recursively scan a directory for recipe files (.recipe.json extension), maintaining the relative path structure.
 *
 * @param {string} basePath - The base path to scan from
 * @param {string} currentPath - The current directory being scanned
 * @returns {Promise<string[]>} Array of file paths relative to basePath
 */
async function scanRecipeDirectoryRecursively(basePath, currentPath = '') {
  const fullPath = path.join(basePath, currentPath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      const subFiles = await scanRecipeDirectoryRecursively(
        basePath,
        entryPath
      );
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.recipe.json')) {
      // Add the recipe file with its relative path
      files.push(entryPath);
    }
  }

  return files;
}

/**
 * Get all mod names from the mods directory
 *
 * @returns {Promise<string[]>} Array of mod directory names
 */
async function getAllModNames() {
  try {
    const entries = await fs.readdir(MODS_BASE_PATH, { withFileTypes: true });
    const modNames = [];

    for (const entry of entries) {
      if (entry.isDirectory() && !IGNORE_DIRS.has(entry.name)) {
        // Check if the directory has a mod-manifest.json file
        const manifestPath = path.join(
          MODS_BASE_PATH,
          entry.name,
          MANIFEST_FILENAME
        );
        try {
          await fs.access(manifestPath);
          modNames.push(entry.name);
        } catch {
          // Skip directories without manifest files
        }
      }
    }

    return modNames.sort();
  } catch (error) {
    console.error('Error reading mods directory:', error);
    return [];
  }
}

/**
 * Update the manifest for a specific mod
 *
 * @param {string} modName - The name of the mod to update
 * @returns {Promise<boolean>} Resolves to true on success, false on failure
 */
async function updateModManifest(modName) {
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
        // Use the mapped key if available, otherwise use the folder name
        const manifestKey = FOLDER_TO_KEY_MAP[dirent.name] || dirent.name;

        // If this directory is not already a key in manifest.content, add it!
        if (
          !Object.prototype.hasOwnProperty.call(manifest.content, manifestKey)
        ) {
          console.log(
            `  - Discovered new content directory: "${dirent.name}" (key: "${manifestKey}"). Adding to manifest.`
          );
          manifest.content[manifestKey] = []; // Initialize with an empty array.
        }
      }
    }
    // --- END NEW LOGIC ---

    const contentTypes = Object.keys(manifest.content);
    console.log(`Content types to process: ${contentTypes.join(', ')}`);

    // 3. Scan each content directory and update the manifest object.
    for (const contentType of contentTypes) {
      // Special case: anatomyFormatting maps to anatomy-formatting folder
      const folderName =
        contentType === 'anatomyFormatting'
          ? 'anatomy-formatting'
          : contentType;
      const contentDirPath = path.join(modPath, folderName);
      let files = [];

      try {
        // Check if the directory exists
        const dirStat = await fs.stat(contentDirPath);

        if (dirStat.isDirectory()) {
          // Special handling for "entities" directory with nested structure
          if (contentType === 'entities') {
            // Check if entities has definitions and instances subdirectories
            const entitiesDirPath = path.join(modPath, 'entities');
            const definitionsPath = path.join(entitiesDirPath, 'definitions');
            const instancesPath = path.join(entitiesDirPath, 'instances');

            // Check if manifest uses nested structure (entities.definitions/instances)
            if (
              typeof manifest.content.entities === 'object' &&
              !Array.isArray(manifest.content.entities)
            ) {
              // Handle nested structure
              if (
                await fs
                  .stat(definitionsPath)
                  .then(() => true)
                  .catch(() => false)
              ) {
                const definitionFiles =
                  await scanDirectoryRecursively(definitionsPath);
                if (!manifest.content.entities.definitions) {
                  manifest.content.entities.definitions = [];
                }
                manifest.content.entities.definitions = definitionFiles.sort();
                console.log(
                  `  - Scanned "entities.definitions": Found ${definitionFiles.length} file(s).`
                );
              }

              if (
                await fs
                  .stat(instancesPath)
                  .then(() => true)
                  .catch(() => false)
              ) {
                const instanceFiles =
                  await scanDirectoryRecursively(instancesPath);
                if (!manifest.content.entities.instances) {
                  manifest.content.entities.instances = [];
                }
                manifest.content.entities.instances = instanceFiles.sort();
                console.log(
                  `  - Scanned "entities.instances": Found ${instanceFiles.length} file(s).`
                );
              }
            } else {
              // Handle flat structure (legacy support for entityDefinitions/entityInstances at top level)
              // Handle entityDefinitions
              if (
                manifest.content.entityDefinitions &&
                (await fs
                  .stat(definitionsPath)
                  .then(() => true)
                  .catch(() => false))
              ) {
                const definitionFiles =
                  await scanDirectoryRecursively(definitionsPath);
                manifest.content.entityDefinitions = definitionFiles.sort();
                console.log(
                  `  - Scanned "entityDefinitions": Found ${definitionFiles.length} file(s).`
                );
              }

              // Handle entityInstances
              if (
                manifest.content.entityInstances &&
                (await fs
                  .stat(instancesPath)
                  .then(() => true)
                  .catch(() => false))
              ) {
                const instanceFiles =
                  await scanDirectoryRecursively(instancesPath);
                manifest.content.entityInstances = instanceFiles.sort();
                console.log(
                  `  - Scanned "entityInstances": Found ${instanceFiles.length} file(s).`
                );
              }

              // Keep the entities directory empty since we've mapped its contents
              manifest.content.entities = [];
              console.log(
                `  - Mapped "entities" directory contents to entityDefinitions and entityInstances.`
              );
            }
          } else if (contentType === 'scopes') {
            // Special handling for "scopes" directory with .scope files
            files = await scanScopeDirectoryRecursively(contentDirPath);

            console.log(
              `  - Scanned "${contentType}": Found ${files.length} .scope file(s).`
            );

            // If files were found in subdirectories, log the structure
            if (files.length > 0) {
              const subdirs = new Set();
              files.forEach((file) => {
                const dir = path.dirname(file);
                if (dir !== '.') {
                  subdirs.add(dir);
                }
              });
              if (subdirs.size > 0) {
                console.log(
                  `    Subdirectories found: ${Array.from(subdirs).join(', ')}`
                );
              }
            }

            manifest.content[contentType] = files.sort();
          } else if (contentType === 'blueprints') {
            // Special handling for "blueprints" directory with .blueprint.json files
            files = await scanBlueprintDirectoryRecursively(contentDirPath);

            console.log(
              `  - Scanned "${contentType}": Found ${files.length} .blueprint.json file(s).`
            );

            // If files were found in subdirectories, log the structure
            if (files.length > 0) {
              const subdirs = new Set();
              files.forEach((file) => {
                const dir = path.dirname(file);
                if (dir !== '.') {
                  subdirs.add(dir);
                }
              });
              if (subdirs.size > 0) {
                console.log(
                  `    Subdirectories found: ${Array.from(subdirs).join(', ')}`
                );
              }
            }

            manifest.content[contentType] = files.sort();
          } else if (contentType === 'recipes') {
            // Special handling for "recipes" directory with .recipe.json files
            files = await scanRecipeDirectoryRecursively(contentDirPath);

            console.log(
              `  - Scanned "${contentType}": Found ${files.length} .recipe.json file(s).`
            );

            // If files were found in subdirectories, log the structure
            if (files.length > 0) {
              const subdirs = new Set();
              files.forEach((file) => {
                const dir = path.dirname(file);
                if (dir !== '.') {
                  subdirs.add(dir);
                }
              });
              if (subdirs.size > 0) {
                console.log(
                  `    Subdirectories found: ${Array.from(subdirs).join(', ')}`
                );
              }
            }

            manifest.content[contentType] = files.sort();
          } else if (contentType === 'anatomyFormatting') {
            // Handle anatomy-formatting directory (path already mapped above)
            files = await scanDirectoryRecursively(contentDirPath);

            console.log(
              `  - Scanned "anatomyFormatting" (folder: anatomy-formatting): Found ${files.length} file(s).`
            );

            manifest.content[contentType] = files.sort();
          } else {
            // Use recursive scanning to handle nested directories
            files = await scanDirectoryRecursively(contentDirPath);

            console.log(
              `  - Scanned "${contentType}": Found ${files.length} file(s).`
            );

            // If files were found in subdirectories, log the structure
            if (files.length > 0) {
              const subdirs = new Set();
              files.forEach((file) => {
                const dir = path.dirname(file);
                if (dir !== '.') {
                  subdirs.add(dir);
                }
              });
              if (subdirs.size > 0) {
                console.log(
                  `    Subdirectories found: ${Array.from(subdirs).join(', ')}`
                );
              }
            }

            manifest.content[contentType] = files.sort();
          }
        }
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
    }

    // 4. Write the updated, formatted JSON back to the manifest file.
    const updatedManifestContent = JSON.stringify(manifest, null, 2);
    await fs.writeFile(manifestPath, updatedManifestContent, 'utf8');

    console.log('\n✅ Manifest update complete!');
    console.log(`Successfully updated: ${manifestPath}`);
    return true; // Success
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
    return false; // Failure
  }
}

/**
 * Main function to run the script logic.
 */
async function main() {
  const modName = process.argv[2]; // No default value

  if (modName) {
    // Update single mod
    const success = await updateModManifest(modName);
    if (!success) {
      process.exit(1);
    }
  } else {
    // Update all mods
    console.log('No mod name provided. Updating all mod manifests...\n');

    const modNames = await getAllModNames();
    if (modNames.length === 0) {
      console.error('No mods found in the mods directory.');
      process.exit(1);
    }

    console.log(`Found ${modNames.length} mod(s): ${modNames.join(', ')}\n`);

    let successCount = 0;
    let failureCount = 0;

    for (const mod of modNames) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`Processing mod: ${mod}`);
      console.log(`${'='.repeat(50)}\n`);

      const success = await updateModManifest(mod);
      if (success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    // Summary
    console.log(`\n${'='.repeat(50)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(50)}`);
    console.log(`✅ Successfully updated: ${successCount} mod(s)`);
    if (failureCount > 0) {
      console.log(`❌ Failed to update: ${failureCount} mod(s)`);
    }
    console.log(`Total mods processed: ${modNames.length}`);

    if (failureCount > 0) {
      process.exit(1);
    }
  }
}

main();
