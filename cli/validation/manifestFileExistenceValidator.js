/**
 * @file Validates that all files referenced in mod manifests actually exist on disk
 * @description Prevents runtime 404 errors by ensuring manifest file references are valid.
 *              Also validates inverse: files on disk are registered in manifests.
 */

/* global process */

import { promises as fs } from 'fs';
import path from 'path';

/**
 * Files to ignore when scanning directories for unregistered content
 * @type {string[]}
 */
const IGNORED_FILES = [
  '.DS_Store',
  'Thumbs.db',
  '.gitkeep',
  '.gitignore',
  'desktop.ini',
];

/**
 * File extensions to ignore (temporary/backup files)
 * @type {string[]}
 */
const IGNORED_EXTENSIONS = ['.swp', '.bak', '.tmp', '.orig'];

/**
 * Content categories and their expected file patterns
 * @type {Object<string, {directory: string, pattern: RegExp}>}
 */
const CONTENT_CATEGORIES = {
  actions: { directory: 'actions', pattern: /\.json$/i },
  components: { directory: 'components', pattern: /\.json$/i },
  conditions: { directory: 'conditions', pattern: /\.json$/i },
  damageTypes: { directory: 'damageTypes', pattern: /\.json$/i },
  events: { directory: 'events', pattern: /\.json$/i },
  goals: { directory: 'goals', pattern: /\.json$/i },
  macros: { directory: 'macros', pattern: /\.json$/i },
  rules: { directory: 'rules', pattern: /\.json$/i },
  worlds: { directory: 'worlds', pattern: /\.json$/i },
  blueprints: { directory: 'blueprints', pattern: /\.json$/i },
  recipes: { directory: 'recipes', pattern: /\.json$/i },
  anatomyFormatting: { directory: 'anatomyFormatting', pattern: /\.json$/i },
  libraries: { directory: 'libraries', pattern: /\.json$/i },
  lookups: { directory: 'lookups', pattern: /\.json$/i },
  parts: { directory: 'parts', pattern: /\.json$/i },
  'structure-templates': { directory: 'structure-templates', pattern: /\.json$/i },
  scopes: { directory: 'scopes', pattern: /\.scope$/i },
  'refinement-methods': { directory: 'refinement-methods', pattern: /\.refinement\.json$/i },
  tasks: { directory: 'tasks', pattern: /\.task\.json$/i },
  portraits: { directory: 'portraits', pattern: /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i },
};

/**
 * Result of validating a single mod's file references
 *
 * @typedef {object} ModFileValidationResult
 * @property {string} modId - The mod identifier
 * @property {boolean} isValid - Whether all referenced files exist
 * @property {Array<{category: string, file: string}>} missingFiles - List of missing files
 * @property {Array<{category: string, manifestRef: string, actualFile: string}>} namingIssues - Naming convention mismatches
 */

/**
 * Result of validating unregistered files in a mod
 *
 * @typedef {object} UnregisteredFilesResult
 * @property {string} modId - The mod identifier
 * @property {boolean} isValid - Whether all files on disk are registered
 * @property {Array<{category: string, file: string}>} unregisteredFiles - Files on disk not in manifest
 */

/**
 * Validates file existence for all content referenced in mod manifests
 */
class ManifestFileExistenceValidator {
  #logger;
  #modsBasePath;

  /**
   * @param {object} dependencies
   * @param {import('../../src/interfaces/coreServices.js').ILogger} dependencies.logger
   * @param {string} [dependencies.modsBasePath] - Base path to mods directory
   */
  constructor({ logger, modsBasePath = null }) {
    if (!logger || typeof logger.info !== 'function') {
      throw new Error('Logger is required with info, warn, error, debug methods');
    }

    this.#logger = logger;
    this.#modsBasePath = modsBasePath || path.join(process.cwd(), 'data', 'mods');
  }

  /**
   * Validates all file references in a mod's manifest
   *
   * @param {string} modId - Mod identifier
   * @param {object} manifest - Parsed mod manifest
   * @returns {Promise<ModFileValidationResult>}
   */
  async validateMod(modId, manifest) {
    const missingFiles = [];
    const namingIssues = [];
    const modPath = path.join(this.#modsBasePath, modId);

    const content = manifest.content || {};
    const categories = ['actions', 'rules', 'conditions', 'components', 'scopes', 'entities'];

    for (const category of categories) {
      const files = content[category];
      if (!files || !Array.isArray(files)) continue;

      for (const file of files) {
        const filePath = path.join(modPath, category, file);

        try {
          await fs.access(filePath);
        } catch {
          // File doesn't exist - check for naming issues
          const namingIssue = await this.#checkNamingMismatch(modPath, category, file);

          if (namingIssue) {
            namingIssues.push({
              category,
              manifestRef: file,
              actualFile: namingIssue
            });
          } else {
            missingFiles.push({ category, file });
          }
        }
      }
    }

    const isValid = missingFiles.length === 0 && namingIssues.length === 0;

    if (!isValid) {
      this.#logger.warn(
        `Mod '${modId}' has file reference issues`,
        { modId, missingCount: missingFiles.length, namingIssueCount: namingIssues.length }
      );
    }

    return {
      modId,
      isValid,
      missingFiles,
      namingIssues
    };
  }

  /**
   * Validates all mods in the ecosystem
   *
   * @param {Map<string, object>} manifests - Map of modId to manifest
   * @returns {Promise<Map<string, ModFileValidationResult>>}
   */
  async validateAllMods(manifests) {
    this.#logger.info('Validating file existence for all mod manifests');

    const results = new Map();
    let totalMissing = 0;
    let totalNamingIssues = 0;

    for (const [modId, manifest] of manifests.entries()) {
      const result = await this.validateMod(modId, manifest);
      results.set(modId, result);

      totalMissing += result.missingFiles.length;
      totalNamingIssues += result.namingIssues.length;
    }

    this.#logger.info(
      `File existence validation complete: ${results.size} mods checked, ${totalMissing} missing files, ${totalNamingIssues} naming issues`,
      { totalMods: results.size, totalMissing, totalNamingIssues }
    );

    return results;
  }

  /**
   * Checks if a file exists with underscore/hyphen variations
   *
   * @param {string} modPath - Base mod path
   * @param {string} category - Content category
   * @param {string} file - Original filename
   * @returns {Promise<string|null>} Alternative filename if found, null otherwise
   * @private
   */
  async #checkNamingMismatch(modPath, category, file) {
    // Only check for underscore to hyphen conversion
    if (!file.includes('_')) return null;

    const hyphenatedFile = file.replace(/_/g, '-');
    const hyphenatedPath = path.join(modPath, category, hyphenatedFile);

    try {
      await fs.access(hyphenatedPath);
      return hyphenatedFile;
    } catch {
      return null;
    }
  }

  /**
   * Generates a human-readable report of validation results
   *
   * @param {Map<string, ModFileValidationResult>} results - Validation results
   * @returns {string} Formatted report
   */
  generateReport(results) {
    const lines = [];
    const invalidMods = Array.from(results.values()).filter(r => !r.isValid);

    if (invalidMods.length === 0) {
      lines.push('✅ All manifest file references are valid');
      return lines.join('\n');
    }

    lines.push(`❌ Found ${invalidMods.length} mod(s) with file reference issues:\n`);

    for (const result of invalidMods) {
      lines.push(`  Mod: ${result.modId}`);

      if (result.missingFiles.length > 0) {
        lines.push('    Missing files:');
        result.missingFiles.forEach(({ category, file }) => {
          lines.push(`      - ${category}/${file}`);
        });
      }

      if (result.namingIssues.length > 0) {
        lines.push('    Naming mismatches (underscore vs hyphen):');
        result.namingIssues.forEach(({ category, manifestRef, actualFile }) => {
          lines.push(`      - ${category}/${manifestRef} (should be ${actualFile})`);
        });
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  // ============================================================================
  // UNREGISTERED FILES VALIDATION (Inverse check: disk → manifest)
  // ============================================================================

  /**
   * Validates that all content files on disk are registered in manifest
   * (inverse of validateMod - checks disk → manifest)
   *
   * @param {string} modId - Mod identifier
   * @param {object} manifest - Parsed mod manifest (null if missing)
   * @returns {Promise<UnregisteredFilesResult>}
   */
  async validateUnregisteredFiles(modId, manifest) {
    const unregisteredFiles = [];
    const modPath = path.join(this.#modsBasePath, modId);

    // If manifest is null/undefined, we can't validate - return gracefully
    if (!manifest) {
      this.#logger.debug(`Mod '${modId}' has no manifest, skipping unregistered files check`);
      return {
        modId,
        isValid: true,
        unregisteredFiles: [],
      };
    }

    const content = manifest.content || {};

    // Check each content category
    for (const [categoryKey, categoryConfig] of Object.entries(CONTENT_CATEGORIES)) {
      const categoryDir = path.join(modPath, categoryConfig.directory);

      // Get files registered in manifest for this category
      const registeredFiles = this.#getRegisteredFilesForCategory(content, categoryKey);

      // Scan directory for actual files
      const filesOnDisk = await this.#scanDirectory(categoryDir, categoryConfig.pattern);

      // Find unregistered files
      for (const file of filesOnDisk) {
        if (!registeredFiles.has(file)) {
          unregisteredFiles.push({
            category: categoryConfig.directory,
            file,
          });
        }
      }
    }

    // Handle nested entities structure separately
    await this.#validateEntitiesUnregistered(modPath, content, unregisteredFiles);

    const isValid = unregisteredFiles.length === 0;

    if (!isValid) {
      this.#logger.warn(
        `Mod '${modId}' has ${unregisteredFiles.length} unregistered file(s) on disk`,
        { modId, unregisteredCount: unregisteredFiles.length }
      );
    }

    return {
      modId,
      isValid,
      unregisteredFiles,
    };
  }

  /**
   * Validates all mods for unregistered files
   *
   * @param {Map<string, object>} manifests - Map of modId to manifest
   * @returns {Promise<Map<string, UnregisteredFilesResult>>}
   */
  async validateAllModsUnregistered(manifests) {
    this.#logger.info('Validating for unregistered files in all mods');

    const results = new Map();
    let totalUnregistered = 0;

    for (const [modId, manifest] of manifests.entries()) {
      const result = await this.validateUnregisteredFiles(modId, manifest);
      results.set(modId, result);

      totalUnregistered += result.unregisteredFiles.length;
    }

    this.#logger.info(
      `Unregistered files validation complete: ${results.size} mods checked, ${totalUnregistered} unregistered files found`,
      { totalMods: results.size, totalUnregistered }
    );

    return results;
  }

  /**
   * Gets the set of files registered in manifest for a given category
   *
   * @param {object} content - Manifest content section
   * @param {string} categoryKey - Category key
   * @returns {Set<string>} Set of registered filenames
   * @private
   */
  #getRegisteredFilesForCategory(content, categoryKey) {
    const files = content[categoryKey];
    if (!files) return new Set();

    if (Array.isArray(files)) {
      return new Set(files);
    }

    // Handle non-array values (shouldn't happen with valid schema, but be defensive)
    return new Set();
  }

  /**
   * Scans a directory for files matching the expected pattern
   *
   * @param {string} dirPath - Directory path to scan
   * @param {RegExp} pattern - File pattern to match
   * @returns {Promise<string[]>} Array of matching filenames
   * @private
   */
  async #scanDirectory(dirPath, pattern) {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files = [];

      for (const entry of entries) {
        // Skip directories
        if (!entry.isFile()) continue;

        const filename = entry.name;

        // Skip ignored files
        if (this.#isIgnoredFile(filename)) continue;

        // Only include files matching the expected pattern
        if (pattern.test(filename)) {
          files.push(filename);
        }
      }

      return files;
    } catch (error) {
      // Directory doesn't exist - this is fine, no unregistered files
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Checks if a file should be ignored during scanning
   *
   * @param {string} filename - Filename to check
   * @returns {boolean} True if file should be ignored
   * @private
   */
  #isIgnoredFile(filename) {
    // Check against explicit ignore list
    if (IGNORED_FILES.includes(filename)) return true;

    // Check for ignored extensions
    for (const ext of IGNORED_EXTENSIONS) {
      if (filename.endsWith(ext)) return true;
    }

    // Ignore files starting with . (hidden files) except those we explicitly handle
    if (filename.startsWith('.') && !IGNORED_FILES.includes(filename)) return true;

    // Ignore files ending with ~ (backup files)
    if (filename.endsWith('~')) return true;

    return false;
  }

  /**
   * Validates unregistered files in the entities subdirectories
   *
   * @param {string} modPath - Mod base path
   * @param {object} content - Manifest content section
   * @param {Array<{category: string, file: string}>} unregisteredFiles - Array to append results
   * @private
   */
  async #validateEntitiesUnregistered(modPath, content, unregisteredFiles) {
    const entities = content.entities || {};

    // Check definitions
    const definitionsDir = path.join(modPath, 'entities', 'definitions');
    const registeredDefinitions = new Set(entities.definitions || []);
    const definitionsOnDisk = await this.#scanDirectory(definitionsDir, /\.json$/i);

    for (const file of definitionsOnDisk) {
      if (!registeredDefinitions.has(file)) {
        unregisteredFiles.push({
          category: 'entities/definitions',
          file,
        });
      }
    }

    // Check instances
    const instancesDir = path.join(modPath, 'entities', 'instances');
    const registeredInstances = new Set(entities.instances || []);
    const instancesOnDisk = await this.#scanDirectory(instancesDir, /\.json$/i);

    for (const file of instancesOnDisk) {
      if (!registeredInstances.has(file)) {
        unregisteredFiles.push({
          category: 'entities/instances',
          file,
        });
      }
    }
  }

  /**
   * Generates a human-readable report of unregistered files validation results
   *
   * @param {Map<string, UnregisteredFilesResult>} results - Validation results
   * @returns {string} Formatted report
   */
  generateUnregisteredReport(results) {
    const lines = [];
    const invalidMods = Array.from(results.values()).filter(r => !r.isValid);

    if (invalidMods.length === 0) {
      lines.push('✅ All content files on disk are registered in manifests');
      return lines.join('\n');
    }

    lines.push(`⚠️ Found ${invalidMods.length} mod(s) with unregistered files:\n`);

    for (const result of invalidMods) {
      lines.push(`  Mod: ${result.modId}`);
      lines.push('    Unregistered files (not in mod-manifest.json):');

      for (const { category, file } of result.unregisteredFiles) {
        lines.push(`      - ${category}/${file}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }
}

export default ManifestFileExistenceValidator;
