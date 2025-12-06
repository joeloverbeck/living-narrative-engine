// updateManifest.js (Version 4 - Enhanced with Comprehensive Validation Integration)
/* eslint-env node */
//
// Description:
// A Node.js script to automatically scan the content directories of a mod
// and update its `mod-manifest.json` file with all the `.json` files found.
// This version automatically discovers new content directories in the mod folder
// and handles nested directories like entities/definitions and entities/instances.
// Now includes comprehensive cross-reference validation integration with multiple formats,
// batch processing, and extensive CLI options.
//
// Usage:
// node scripts/updateManifest.js <mod_name>                    // Update specific mod
// node scripts/updateManifest.js                               // Update all mods
// node scripts/updateManifest.js <mod_name> --validate-references // Update and validate
// node scripts/updateManifest.js <mod_name> -v -s             // Validate with strict mode
// node scripts/updateManifest.js <mod_name> --validate --format=json --output=report.json
// node scripts/updateManifest.js <mod_name> --pre-validation --post-validation

const fs = require('fs/promises');
const path = require('path');

// Local ValidationError class for this script
class ValidationError extends Error {
  constructor(message, componentTypeId = null, validationErrors = null) {
    super(message);
    this.name = 'ValidationError';
    this.componentTypeId = componentTypeId;
    this.validationErrors = validationErrors;
  }
}

// --- CONFIGURATION ---
const MODS_BASE_PATH = path.join('data', 'mods');
const MANIFEST_FILENAME = 'mod-manifest.json';
// List of directories to ignore when auto-discovering content folders.
const IGNORE_DIRS = new Set(['.git', '.idea', 'node_modules']);

// Map folder names to manifest keys for special cases
const FOLDER_TO_KEY_MAP = {
  'anatomy-formatting': 'anatomyFormatting',
  'damage-types': 'damageTypes',
};

// Reverse mapping: manifest keys to folder names
const KEY_TO_FOLDER_MAP = Object.fromEntries(
  Object.entries(FOLDER_TO_KEY_MAP).map(([folder, key]) => [key, folder])
);

/**
 * Enhanced options interface for manifest updates with validation
 */
const DEFAULT_OPTIONS = {
  // Existing options
  force: false,
  verbose: false,
  dryRun: false,

  // New validation options
  validateReferences: false,
  failOnViolations: false,
  validationFormat: 'console', // console, json, html, markdown, none
  validationOutput: null, // file path for validation report
  skipValidationOnDryRun: true, // skip validation during dry runs
  validationStrictMode: false, // strict validation (fail on warnings)
  showSuggestions: true, // show fix suggestions in validation output

  // Enhanced validation options
  preValidation: false, // validate before scanning files
  postValidation: true, // validate after manifest update
  validateDependencies: true, // include dependency validation
  validateCrossReferences: true, // include cross-reference validation
  validationTimeout: 30000, // validation timeout in milliseconds

  // Batch processing options
  concurrency: 3, // concurrent mod processing limit
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
 * Recursively scan a directory for portrait image files, maintaining the relative path structure.
 *
 * @param {string} basePath - The base path to scan from
 * @param {string} currentPath - The current directory being scanned
 * @returns {Promise<string[]>} Array of file paths relative to basePath
 */
async function scanPortraitDirectoryRecursively(basePath, currentPath = '') {
  const fullPath = path.join(basePath, currentPath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  const files = [];

  // Supported image file extensions for portraits
  const imageExtensions = [
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.webp',
    '.svg',
    '.bmp',
  ];

  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      const subFiles = await scanPortraitDirectoryRecursively(
        basePath,
        entryPath
      );
      files.push(...subFiles);
    } else if (entry.isFile()) {
      // Check if file has a supported image extension
      const hasImageExtension = imageExtensions.some((ext) =>
        entry.name.toLowerCase().endsWith(ext)
      );
      if (hasImageExtension) {
        // Add the portrait file with its relative path
        files.push(entryPath);
      }
    }
  }

  return files;
}

/**
 * Recursively scan a directory for lookup files (.lookup.json extension), maintaining the relative path structure.
 *
 * @param {string} basePath - The base path to scan from
 * @param {string} currentPath - The current directory being scanned
 * @returns {Promise<string[]>} Array of file paths relative to basePath
 */
async function scanLookupDirectoryRecursively(basePath, currentPath = '') {
  const fullPath = path.join(basePath, currentPath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively scan subdirectories
      const subFiles = await scanLookupDirectoryRecursively(
        basePath,
        entryPath
      );
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.lookup.json')) {
      // Add the lookup file with its relative path
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
      // Include both directories and symlinks to directories
      if (
        (entry.isDirectory() || entry.isSymbolicLink()) &&
        !IGNORE_DIRS.has(entry.name)
      ) {
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
 * Main manifest update function with integrated validation
 *
 * @param {string} modName - Name of the mod to update
 * @param {object} options - Update and validation options
 * @returns {Promise<object>} Update result with validation information
 */
async function updateModManifest(modName, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  console.log(`Starting manifest update for mod: "${modName}"`);

  const modPath = path.join(MODS_BASE_PATH, modName);
  const manifestPath = path.join(modPath, MANIFEST_FILENAME);

  // Initialize validation components if needed
  let validationOrchestrator = null;
  let violationReporter = null;

  if (opts.validateReferences && !opts.skipValidationOnDryRun) {
    try {
      // Dynamically import validation components using the existing pattern
      const {
        configureContainer,
      } = require('../src/dependencyInjection/containerConfig.js');
      const {
        coreTokens,
      } = require('../src/dependencyInjection/tokens/tokens-core.js');
      const AppContainer =
        require('../src/dependencyInjection/appContainer.js').default;

      // Create a minimal container for validation
      const container = new AppContainer();
      await configureContainer(container, {
        outputDiv: null,
        inputElement: null,
        titleElement: null,
        document: null,
      });

      validationOrchestrator = container.resolve(
        coreTokens.IModValidationOrchestrator
      );
      violationReporter = container.resolve(coreTokens.IViolationReporter);
    } catch (error) {
      console.warn('⚠️  Validation components not available:', error.message);
      console.warn('   Continuing without validation...');
      opts.validateReferences = false;
    }
  }

  const result = {
    success: false,
    modName,
    timestamp: new Date().toISOString(),

    // Existing result fields
    manifestUpdated: false,
    filesProcessed: 0,
    errors: [],
    warnings: [],

    // New validation fields
    validation: {
      performed: false,
      preValidation: null,
      postValidation: null,
      violations: [],
      suggestions: [],
    },

    // Performance tracking
    performance: {
      startTime: Date.now(),
      phases: {},
    },
  };

  try {
    // Verify mod directory exists
    const modStats = await fs.stat(modPath);
    if (!modStats.isDirectory()) {
      throw new Error(`Mod path is not a directory: ${modPath}`);
    }

    // Phase 1: Pre-validation (optional)
    if (opts.preValidation && validationOrchestrator) {
      console.log('🔍 Phase 1: Pre-update validation...');
      const preValidationStart = Date.now();

      try {
        const preValidationResult = await runValidation(
          validationOrchestrator,
          violationReporter,
          modName,
          opts
        );

        result.validation.preValidation = preValidationResult;
        result.performance.phases.preValidation =
          Date.now() - preValidationStart;

        if (preValidationResult.hasViolations && opts.validationStrictMode) {
          throw new ValidationError(
            `Pre-validation failed with ${preValidationResult.violationCount} violations`,
            null,
            preValidationResult
          );
        }
      } catch (error) {
        if (opts.failOnViolations) {
          throw error;
        }
        console.warn('⚠️  Pre-validation failed:', error.message);
        result.warnings.push(`Pre-validation failed: ${error.message}`);
      }
    }

    // Phase 2: Existing manifest update logic (enhanced with validation context)
    console.log('📝 Phase 2: Updating manifest...');
    const updateStart = Date.now();

    const updateResult = await performManifestUpdate(
      modName,
      modPath,
      manifestPath,
      opts
    );

    // Merge update results
    result.manifestUpdated = updateResult.manifestUpdated;
    result.filesProcessed = updateResult.filesProcessed;
    result.errors.push(...updateResult.errors);
    result.warnings.push(...updateResult.warnings);
    result.performance.phases.manifestUpdate = Date.now() - updateStart;

    // Phase 3: Post-validation (default)
    if (
      opts.postValidation &&
      validationOrchestrator &&
      result.manifestUpdated
    ) {
      console.log('🔍 Phase 3: Post-update validation...');
      const postValidationStart = Date.now();

      try {
        const postValidationResult = await runValidation(
          validationOrchestrator,
          violationReporter,
          modName,
          opts
        );

        result.validation.postValidation = postValidationResult;
        result.validation.performed = true;
        result.performance.phases.postValidation =
          Date.now() - postValidationStart;

        // Handle validation results
        if (postValidationResult.hasViolations) {
          const violationCount = postValidationResult.violationCount;
          console.log(`⚠️  Found ${violationCount} cross-reference violations`);

          // Store violations for result
          result.validation.violations = postValidationResult.violations;
          result.validation.suggestions = postValidationResult.suggestions;

          // Output validation report
          await outputValidationReport(
            violationReporter,
            postValidationResult,
            opts,
            modName
          );

          if (opts.failOnViolations) {
            throw new ValidationError(
              `Post-validation failed with ${violationCount} violations`,
              null,
              postValidationResult
            );
          }

          result.warnings.push(
            `${violationCount} cross-reference violations found`
          );
        } else {
          console.log('✅ No cross-reference violations found');
        }
      } catch (error) {
        if (opts.failOnViolations || error instanceof ValidationError) {
          throw error;
        }
        console.warn('⚠️  Post-validation failed:', error.message);
        result.warnings.push(`Post-validation failed: ${error.message}`);
      }
    }

    // Success
    result.success = true;
    result.performance.totalTime = Date.now() - result.performance.startTime;

    console.log(
      `✅ Manifest update completed for "${modName}" (${result.performance.totalTime}ms)`
    );

    // Summary output
    if (opts.verbose || result.validation.performed) {
      outputSummary(result, opts);
    }

    return result;
  } catch (error) {
    result.performance.totalTime = Date.now() - result.performance.startTime;
    result.errors.push(error.message);

    console.error(`❌ Manifest update failed for "${modName}":`, error.message);

    // Enhanced error context for validation errors
    if (error instanceof ValidationError) {
      result.validation.performed = true;
      result.validation.violations = error.validationErrors?.violations || [];

      if (
        opts.validationFormat !== 'none' &&
        violationReporter &&
        error.validationErrors
      ) {
        const report = violationReporter.generateReport(
          error.validationErrors,
          opts.validationFormat,
          { showSuggestions: opts.showSuggestions }
        );
        console.error(report);
      }
    }

    return result;
  }
}

/**
 * Enhanced manifest update logic with validation context
 *
 * @param {string} modName - Mod name
 * @param {string} modPath - Mod directory path
 * @param {string} manifestPath - Manifest file path
 * @param {object} opts - Options
 * @returns {Promise<object>} Update results
 */
async function performManifestUpdate(modName, modPath, manifestPath, opts) {
  // Load existing manifest
  let existingManifest = {};
  let manifestExists = false;

  try {
    const manifestContent = await fs.readFile(manifestPath, 'utf8');
    existingManifest = JSON.parse(manifestContent);
    manifestExists = true;

    if (opts.verbose) {
      console.log(
        `📖 Loaded existing manifest (${Object.keys(existingManifest).length} properties)`
      );
    }
  } catch (error) {
    if (opts.verbose) {
      console.log('📋 No existing manifest found, will create new one');
    }
  }

  if (
    !existingManifest.content ||
    typeof existingManifest.content !== 'object'
  ) {
    if (manifestExists) {
      throw new Error('Manifest does not have a valid "content" object');
    }
    // Create new manifest structure
    existingManifest = {
      id: modName,
      version: '1.0.0',
      name: modName,
      dependencies: [],
      content: {},
    };
  }

  // Create a deep copy of the existing manifest to preserve it for comparison
  const manifestCopy = JSON.parse(JSON.stringify(existingManifest));

  // Scan directory structure (using existing logic)
  const scanResult = await scanModDirectory(modPath, manifestCopy, opts);

  // Build new manifest (existing logic with enhancements)
  const newManifest = scanResult.manifest;

  // Validation-aware manifest writing
  let manifestUpdated = false;
  if (!opts.dryRun) {
    // Check if manifest actually changed
    const manifestChanged =
      !manifestExists ||
      JSON.stringify(existingManifest, null, 2) !==
        JSON.stringify(newManifest, null, 2);

    if (manifestChanged || opts.force) {
      await fs.writeFile(
        manifestPath,
        JSON.stringify(newManifest, null, 2) + '\n'
      );
      manifestUpdated = true;

      if (opts.verbose) {
        console.log(
          `💾 Manifest ${manifestExists ? 'updated' : 'created'}: ${manifestPath}`
        );
      }
    } else if (opts.verbose) {
      console.log('📄 Manifest unchanged, no update needed');
    }
  } else {
    console.log('🔥 Dry run: manifest changes not written');
    manifestUpdated = false; // Don't trigger validation on dry run
  }

  return {
    manifestUpdated,
    filesProcessed: scanResult.filesProcessed || 0,
    errors: scanResult.errors || [],
    warnings: scanResult.warnings || [],
  };
}

/**
 * Scans mod directory and processes content (consolidates existing logic)
 *
 * @param {string} modPath - Mod directory path
 * @param {object} manifest - Current manifest
 * @param {object} opts - Options
 * @returns {Promise<object>} Scan results
 */
async function scanModDirectory(modPath, manifest, opts) {
  const result = {
    manifest: { ...manifest },
    filesProcessed: 0,
    errors: [],
    warnings: [],
  };

  try {
    // Auto-discover content directories (existing logic)
    console.log('Discovering content directories...');
    const modDirEntries = await fs.readdir(modPath, { withFileTypes: true });

    for (const dirent of modDirEntries) {
      if (dirent.isDirectory() && !IGNORE_DIRS.has(dirent.name)) {
        const manifestKey = FOLDER_TO_KEY_MAP[dirent.name] || dirent.name;

        if (
          !Object.prototype.hasOwnProperty.call(
            result.manifest.content,
            manifestKey
          )
        ) {
          console.log(
            `  - Discovered new content directory: "${dirent.name}" (key: "${manifestKey}"). Adding to manifest.`
          );
          // Special handling for entities directory - must be an object with definitions/instances
          if (manifestKey === 'entities') {
            result.manifest.content[manifestKey] = {
              definitions: [],
              instances: [],
            };
          } else {
            result.manifest.content[manifestKey] = [];
          }
        }
      }
    }

    // Process each content directory (existing logic)
    const contentTypes = Object.keys(result.manifest.content);
    console.log(`Content types to process: ${contentTypes.join(', ')}`);

    for (const contentType of contentTypes) {
      const processResult = await processContentType(
        modPath,
        contentType,
        result.manifest,
        opts
      );
      result.filesProcessed += processResult.filesProcessed;
      result.errors.push(...processResult.errors);
      result.warnings.push(...processResult.warnings);
    }

    return result;
  } catch (error) {
    result.errors.push(`Directory scan failed: ${error.message}`);
    return result;
  }
}

/**
 * Processes a specific content type directory (consolidates existing logic)
 *
 * @param {string} modPath - Mod path
 * @param {string} contentType - Content type to process
 * @param {object} manifest - Manifest object
 * @param {object} opts - Options
 * @returns {Promise<object>} Processing results
 */
async function processContentType(modPath, contentType, manifest, opts) {
  const result = {
    filesProcessed: 0,
    errors: [],
    warnings: [],
  };

  try {
    // Map manifest keys to folder names (handles camelCase → kebab-case mappings)
    const folderName = KEY_TO_FOLDER_MAP[contentType] || contentType;
    const contentDirPath = path.join(modPath, folderName);
    let files = [];

    // Check if the directory exists
    const dirStat = await fs.stat(contentDirPath);

    if (dirStat.isDirectory()) {
      if (contentType === 'entities') {
        // Handle entities with nested structure (existing logic)
        await processEntitiesDirectory(modPath, manifest, result);
      } else if (contentType === 'scopes') {
        files = await scanScopeDirectoryRecursively(contentDirPath);
        console.log(
          `  - Scanned "${contentType}": Found ${files.length} .scope file(s).`
        );
        manifest.content[contentType] = files.sort();
        result.filesProcessed += files.length;
      } else if (contentType === 'blueprints') {
        files = await scanBlueprintDirectoryRecursively(contentDirPath);
        console.log(
          `  - Scanned "${contentType}": Found ${files.length} .blueprint.json file(s).`
        );
        manifest.content[contentType] = files.sort();
        result.filesProcessed += files.length;
      } else if (contentType === 'recipes') {
        files = await scanRecipeDirectoryRecursively(contentDirPath);
        console.log(
          `  - Scanned "${contentType}": Found ${files.length} .recipe.json file(s).`
        );
        manifest.content[contentType] = files.sort();
        result.filesProcessed += files.length;
      } else if (contentType === 'portraits') {
        files = await scanPortraitDirectoryRecursively(contentDirPath);
        console.log(
          `  - Scanned "${contentType}": Found ${files.length} image file(s).`
        );
        manifest.content[contentType] = files.sort();
        result.filesProcessed += files.length;
      } else if (contentType === 'lookups') {
        files = await scanLookupDirectoryRecursively(contentDirPath);
        console.log(
          `  - Scanned "${contentType}": Found ${files.length} .lookup.json file(s).`
        );
        manifest.content[contentType] = files.sort();
        result.filesProcessed += files.length;
      } else {
        files = await scanDirectoryRecursively(contentDirPath);
        console.log(
          `  - Scanned "${contentType}": Found ${files.length} file(s).`
        );
        manifest.content[contentType] = files.sort();
        result.filesProcessed += files.length;
      }

      // Log subdirectory structure if found
      if (files.length > 0 && contentType !== 'entities') {
        const subdirs = new Set();
        files.forEach((file) => {
          const dir = path.dirname(file);
          if (dir !== '.') {
            subdirs.add(dir);
          }
        });
        if (subdirs.size > 0 && opts.verbose) {
          console.log(
            `    Subdirectories found: ${Array.from(subdirs).join(', ')}`
          );
        }
      }
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log(
        `  - Directory not found for "${contentType}", ensuring it is empty in manifest.`
      );
      // Special handling for entities - must be an object with definitions/instances
      if (contentType === 'entities') {
        manifest.content[contentType] = { definitions: [], instances: [] };
      } else {
        manifest.content[contentType] = [];
      }
    } else {
      result.errors.push(`Error processing ${contentType}: ${error.message}`);
    }
  }

  return result;
}

/**
 * Processes entities directory with nested structure (existing logic)
 *
 * @param {string} modPath - Mod path
 * @param {object} manifest - Manifest object
 * @param {object} result - Result accumulator
 */
async function processEntitiesDirectory(modPath, manifest, result) {
  const entitiesDirPath = path.join(modPath, 'entities');
  const definitionsPath = path.join(entitiesDirPath, 'definitions');
  const instancesPath = path.join(entitiesDirPath, 'instances');

  // Convert empty array to proper structure if needed
  if (
    Array.isArray(manifest.content.entities) &&
    manifest.content.entities.length === 0
  ) {
    manifest.content.entities = { definitions: [], instances: [] };
    console.log(
      '  - Converted entities from empty array to proper object structure'
    );
  }

  // Check if manifest uses nested structure
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
      const definitionFiles = await scanDirectoryRecursively(definitionsPath);
      if (!manifest.content.entities.definitions) {
        manifest.content.entities.definitions = [];
      }
      manifest.content.entities.definitions = definitionFiles.sort();
      console.log(
        `  - Scanned "entities.definitions": Found ${definitionFiles.length} file(s).`
      );
      result.filesProcessed += definitionFiles.length;
    }

    if (
      await fs
        .stat(instancesPath)
        .then(() => true)
        .catch(() => false)
    ) {
      const instanceFiles = await scanDirectoryRecursively(instancesPath);
      if (!manifest.content.entities.instances) {
        manifest.content.entities.instances = [];
      }
      manifest.content.entities.instances = instanceFiles.sort();
      console.log(
        `  - Scanned "entities.instances": Found ${instanceFiles.length} file(s).`
      );
      result.filesProcessed += instanceFiles.length;
    }
  } else {
    // Handle flat structure (legacy support)
    if (
      manifest.content.entityDefinitions &&
      (await fs
        .stat(definitionsPath)
        .then(() => true)
        .catch(() => false))
    ) {
      const definitionFiles = await scanDirectoryRecursively(definitionsPath);
      manifest.content.entityDefinitions = definitionFiles.sort();
      console.log(
        `  - Scanned "entityDefinitions": Found ${definitionFiles.length} file(s).`
      );
      result.filesProcessed += definitionFiles.length;
    }

    if (
      manifest.content.entityInstances &&
      (await fs
        .stat(instancesPath)
        .then(() => true)
        .catch(() => false))
    ) {
      const instanceFiles = await scanDirectoryRecursively(instancesPath);
      manifest.content.entityInstances = instanceFiles.sort();
      console.log(
        `  - Scanned "entityInstances": Found ${instanceFiles.length} file(s).`
      );
      result.filesProcessed += instanceFiles.length;
    }

    // Keep the entities directory empty since we've mapped its contents
    manifest.content.entities = [];
    console.log(
      '  - Mapped "entities" directory contents to entityDefinitions and entityInstances.'
    );
  }
}

/**
 * Runs comprehensive validation for a mod
 *
 * @param {object} validationOrchestrator - Validation orchestrator instance
 * @param {object} violationReporter - Violation reporter instance
 * @param {string} modName - Mod name to validate
 * @param {object} opts - Validation options
 * @returns {Promise<object>} Validation results
 */
async function runValidation(
  validationOrchestrator,
  violationReporter,
  modName,
  opts
) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error('Validation timeout')),
      opts.validationTimeout
    );
  });

  const validationPromise = validationOrchestrator.validateMod(modName, {
    skipCrossReferences: !opts.validateCrossReferences,
    includeContext: true,
  });

  try {
    const validationResult = await Promise.race([
      validationPromise,
      timeoutPromise,
    ]);

    const hasViolations =
      validationResult.crossReferences?.hasViolations || false;
    const violations = validationResult.crossReferences?.violations || [];
    const violationCount = violations.length;

    // Generate suggestions
    const suggestions = violations
      .filter((v) => v.suggestedFixes && v.suggestedFixes.length > 0)
      .map((v) => v.suggestedFixes.find((f) => f.priority === 'primary'))
      .filter(Boolean);

    return {
      hasViolations,
      violations,
      violationCount,
      suggestions,
      dependencyValidation: validationResult.dependencies,
      isValid: validationResult.isValid,
      rawResult: validationResult,
    };
  } catch (error) {
    throw new Error(`Validation failed: ${error.message}`);
  }
}

/**
 * Outputs validation report in specified format
 *
 * @param {object} violationReporter - Reporter instance
 * @param {object} validationResult - Validation results
 * @param {object} opts - Output options
 * @param {string} modName - Mod name for context
 */
async function outputValidationReport(
  violationReporter,
  validationResult,
  opts,
  modName
) {
  if (opts.validationFormat === 'none') {
    return;
  }

  try {
    const report = violationReporter.generateReport(
      validationResult.rawResult.crossReferences,
      opts.validationFormat,
      {
        colors: opts.validationFormat === 'console',
        showSuggestions: opts.showSuggestions,
        verbose: opts.verbose,
      }
    );

    if (opts.validationOutput) {
      const outputPath = opts.validationOutput.replace('{modName}', modName);
      await fs.writeFile(outputPath, report);
      console.log(`📊 Validation report written to: ${outputPath}`);
    } else {
      console.log(report);
    }
  } catch (error) {
    console.warn('⚠️  Failed to generate validation report:', error.message);
  }
}

/**
 * Outputs summary of update and validation results
 *
 * @param {object} result - Complete result object
 * @param {object} opts - Options for output formatting
 */
function outputSummary(result, opts) {
  console.log('\n📋 Summary:');
  console.log(`   • Files processed: ${result.filesProcessed}`);
  console.log(
    `   • Manifest updated: ${result.manifestUpdated ? 'Yes' : 'No'}`
  );
  console.log(`   • Total time: ${result.performance.totalTime}ms`);

  if (result.validation.performed) {
    console.log('   • Validation performed: Yes');

    if (result.validation.postValidation) {
      const v = result.validation.postValidation;
      console.log(`   • Violations found: ${v.violationCount}`);
      console.log(`   • Suggestions available: ${v.suggestions.length}`);

      if (v.hasViolations && opts.showSuggestions && v.suggestions.length > 0) {
        console.log('\n💡 Quick Fixes:');
        v.suggestions.slice(0, 3).forEach((suggestion, i) => {
          console.log(`   ${i + 1}. ${suggestion.description}`);
        });
      }
    }
  }

  if (result.warnings.length > 0) {
    console.log(`   • Warnings: ${result.warnings.length}`);
    if (opts.verbose) {
      result.warnings.forEach((warning) => {
        console.log(`     - ${warning}`);
      });
    }
  }

  if (result.errors.length > 0) {
    console.log(`   • Errors: ${result.errors.length}`);
    result.errors.forEach((error) => {
      console.log(`     - ${error}`);
    });
  }
}

/**
 * Enhanced batch manifest updates with validation
 *
 * @param {object} options - Batch processing options
 * @returns {Promise<object>} Batch results
 */
async function updateAllManifests(options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const modsPath = path.join(process.cwd(), 'data', 'mods');

  console.log('🔄 Starting batch manifest update with validation...');

  const results = {
    processed: [],
    successful: [],
    failed: [],
    validationSummary: {
      totalViolations: 0,
      modsWithViolations: 0,
      commonViolations: new Map(),
    },
    performance: {
      startTime: Date.now(),
      totalTime: 0,
    },
  };

  try {
    // Include both directories and symlinks to directories
    const modDirectories = (await fs.readdir(modsPath, { withFileTypes: true }))
      .filter((dirent) => dirent.isDirectory() || dirent.isSymbolicLink())
      .map((dirent) => dirent.name);

    console.log(`📦 Found ${modDirectories.length} mods to process`);

    // Process mods concurrently with limit
    const concurrencyLimit = opts.concurrency || 3;
    const promises = [];

    for (let i = 0; i < modDirectories.length; i += concurrencyLimit) {
      const batch = modDirectories.slice(i, i + concurrencyLimit);

      const batchPromise = Promise.allSettled(
        batch.map(async (modName) => {
          const modResult = await updateModManifest(modName, opts);
          return { modName, result: modResult };
        })
      );

      promises.push(batchPromise);
    }

    // Process all batches
    const batchResults = await Promise.all(promises);

    // Aggregate results
    batchResults.forEach((batch) => {
      batch.forEach((modResult) => {
        if (modResult.status === 'fulfilled') {
          const { modName, result } = modResult.value;
          results.processed.push(modName);

          if (result.success) {
            results.successful.push(modName);
          } else {
            results.failed.push(modName);
          }

          // Aggregate validation data
          if (result.validation.performed && result.validation.postValidation) {
            const validation = result.validation.postValidation;
            if (validation.hasViolations) {
              results.validationSummary.modsWithViolations++;
              results.validationSummary.totalViolations +=
                validation.violationCount;

              // Track common violations
              validation.violations.forEach((violation) => {
                const key = `${violation.referencedMod}:${violation.referencedComponent}`;
                const count =
                  results.validationSummary.commonViolations.get(key) || 0;
                results.validationSummary.commonViolations.set(key, count + 1);
              });
            }
          }
        } else {
          console.error(`❌ Failed to process mod: ${modResult.reason}`);
          results.failed.push('unknown');
        }
      });
    });

    results.performance.totalTime = Date.now() - results.performance.startTime;

    // Output batch summary
    console.log('\n📊 Batch Processing Summary:');
    console.log(`   • Total mods: ${modDirectories.length}`);
    console.log(`   • Successful: ${results.successful.length}`);
    console.log(`   • Failed: ${results.failed.length}`);
    console.log(`   • Processing time: ${results.performance.totalTime}ms`);

    if (opts.validateReferences) {
      console.log(
        `   • Mods with violations: ${results.validationSummary.modsWithViolations}`
      );
      console.log(
        `   • Total violations: ${results.validationSummary.totalViolations}`
      );

      if (results.validationSummary.commonViolations.size > 0) {
        console.log('\n🔍 Most Common Violations:');
        const sortedViolations = Array.from(
          results.validationSummary.commonViolations.entries()
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        sortedViolations.forEach(([violation, count]) => {
          console.log(`   • ${violation} (${count} mods)`);
        });
      }
    }

    return results;
  } catch (error) {
    console.error('❌ Batch processing failed:', error.message);
    throw error;
  }
}

/**
 * Enhanced command line argument parsing with validation options
 *
 * @param {string[]} args - Command line arguments
 * @returns {object} Parsed options
 */
function parseCommandLineOptions(args) {
  const options = {
    modName: null,

    // Validation options
    validateReferences:
      args.includes('--validate-references') ||
      args.includes('--validate') ||
      args.includes('-v'),
    failOnViolations:
      args.includes('--fail-on-violations') ||
      args.includes('--strict') ||
      args.includes('-s'),
    validationFormat:
      getArgValue(args, '--validation-format') ||
      getArgValue(args, '--format') ||
      'console',
    validationOutput:
      getArgValue(args, '--validation-output') || getArgValue(args, '--output'),
    preValidation: args.includes('--pre-validation'),
    postValidation: !args.includes('--no-post-validation'),
    validationStrictMode:
      args.includes('--validation-strict') ||
      args.includes('--strict-validation'),
    showSuggestions: !args.includes('--no-suggestions'),
    validationTimeout: parseInt(
      getArgValue(args, '--validation-timeout') || '30000',
      10
    ),

    // General options
    verbose: args.includes('--verbose') || args.includes('-V'),
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    force: args.includes('--force') || args.includes('-f'),
    concurrency: parseInt(getArgValue(args, '--concurrency') || '3', 10),
    batch: args.includes('--batch') || args.includes('--all'),
  };

  // Get mod name (first non-flag argument)
  for (const arg of args) {
    if (!arg.startsWith('--') && !arg.startsWith('-') && !options.modName) {
      options.modName = arg;
      break;
    }
  }

  // Validation format validation
  const validFormats = ['console', 'json', 'html', 'markdown', 'none'];
  if (!validFormats.includes(options.validationFormat)) {
    throw new Error(
      `Invalid validation format: ${options.validationFormat}. Valid options: ${validFormats.join(', ')}`
    );
  }

  return options;
}

/**
 * Utility to get command line argument values
 *
 * @param {string[]} args - Arguments array
 * @param {string} flag - Flag to find value for
 * @returns {string|null} Argument value or null
 */
function getArgValue(args, flag) {
  const flagIndex = args.findIndex((arg) => arg.startsWith(`${flag}=`));
  if (flagIndex !== -1) {
    return args[flagIndex].split('=')[1];
  }

  const nextIndex = args.findIndex((arg) => arg === flag);
  if (
    nextIndex !== -1 &&
    args[nextIndex + 1] &&
    !args[nextIndex + 1].startsWith('-')
  ) {
    return args[nextIndex + 1];
  }

  return null;
}

/**
 * Enhanced main function with comprehensive CLI support
 */
async function main() {
  const args = process.argv.slice(2);

  // Show help if explicitly requested
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Default to batch mode if no arguments provided
  if (args.length === 0) {
    args.push('--batch');
  }

  try {
    const options = parseCommandLineOptions(args);

    if (options.batch || !options.modName) {
      // Batch processing - update all mods
      const result = await updateAllManifests(options);

      // Exit with appropriate code
      const hasErrors = result.failed.length > 0;
      const hasViolations = result.validationSummary.totalViolations > 0;

      if (hasErrors) {
        process.exit(2); // Error in manifest updates
      } else if (hasViolations && options.failOnViolations) {
        process.exit(1); // Validation violations
      } else {
        process.exit(0); // Success
      }
    } else {
      // Single mod processing
      const result = await updateModManifest(options.modName, options);

      // Exit with appropriate code
      const hasErrors = result.errors.length > 0;
      const hasViolations =
        result.validation.postValidation?.hasViolations || false;

      if (hasErrors) {
        process.exit(2); // Error in manifest update
      } else if (hasViolations && options.failOnViolations) {
        process.exit(1); // Validation violations
      } else {
        process.exit(0); // Success
      }
    }
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(3);
  }
}

/**
 * Prints comprehensive usage information
 */
function printUsage() {
  console.log('Usage: node updateManifest.js [<mod-name>] [options]');
  console.log('       node updateManifest.js --batch [options]');
  console.log('');
  console.log('When run without arguments, updates all mods (batch mode).');
  console.log('');
  console.log('Arguments:');
  console.log('  <mod-name>                   Name of specific mod to update');
  console.log('');
  console.log('General Options:');
  console.log('  --batch, --all               Update all mods');
  console.log('  --verbose, -V                Enable verbose output');
  console.log(
    '  --dry-run, -d                Show what would be done without making changes'
  );
  console.log(
    '  --force, -f                  Force update even if manifest unchanged'
  );
  console.log(
    '  --concurrency N              Concurrent processing limit for batch (default: 3)'
  );
  console.log('');
  console.log('Validation Options:');
  console.log(
    '  --validate-references, -v    Enable cross-reference validation'
  );
  console.log('  --fail-on-violations, -s     Fail if violations are found');
  console.log(
    '  --validation-format FORMAT   Report format (console|json|html|markdown|none)'
  );
  console.log('  --validation-output FILE     Write validation report to file');
  console.log(
    '  --pre-validation             Validate before updating manifest'
  );
  console.log(
    '  --no-post-validation         Skip validation after updating manifest'
  );
  console.log('  --validation-strict          Strict validation mode');
  console.log('  --no-suggestions             Hide fix suggestions');
  console.log(
    '  --validation-timeout MS      Validation timeout (default: 30000)'
  );
  console.log('');
  console.log('Examples:');
  console.log('  npm run update-manifest positioning --validate-references');
  console.log('  npm run update-manifest intimacy --validate --strict');
  console.log(
    '  npm run update-manifest core --validate --format=json --output=report.json'
  );
  console.log('  npm run update-manifest --batch --validate --verbose');
  console.log(
    '  npm run update-manifest positioning --pre-validation --post-validation'
  );
}

/**
 * Backward compatibility function - maintains existing API
 *
 * @param {string} modName - Mod name
 * @param {object} legacyOptions - Legacy options format
 * @returns {Promise<object>} Legacy result format
 */
async function updateManifestLegacy(modName, legacyOptions = {}) {
  // Map legacy options to new format
  const modernOptions = {
    force: legacyOptions.force || false,
    verbose: legacyOptions.verbose || false,
    dryRun: legacyOptions.dryRun || false,

    // Default validation off for backward compatibility
    validateReferences: false,
    failOnViolations: false,
    validationFormat: 'console',
    showSuggestions: true,
  };

  const result = await updateModManifest(modName, modernOptions);

  // Return legacy format
  return {
    success: result.success,
    modName: result.modName,
    error:
      result.errors.length > 0
        ? {
            type: 'MANIFEST_UPDATE_ERROR',
            message: result.errors.join('; '),
            path: result.modPath,
          }
        : null,

    // Legacy fields
    manifestUpdated: result.manifestUpdated,
    filesProcessed: result.filesProcessed,
    warnings: result.warnings,
  };
}

// Export functions for testing
module.exports = {
  updateModManifest,
  performManifestUpdate,
  runValidation,
  updateAllManifests,
  parseCommandLineOptions,
  ValidationError,
  // Maintain existing export for backward compatibility
  updateManifestLegacy,
};

// Run if called directly (CommonJS pattern)
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error.message);
    process.exit(3);
  });
}
