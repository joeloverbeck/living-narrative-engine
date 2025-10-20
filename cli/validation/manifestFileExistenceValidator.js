/**
 * @file Validates that all files referenced in mod manifests actually exist on disk
 * @description Prevents runtime 404 errors by ensuring manifest file references are valid
 */

/* global process */

import { promises as fs } from 'fs';
import path from 'path';

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
}

export default ManifestFileExistenceValidator;
