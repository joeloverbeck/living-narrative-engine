/**
 * @file Service for scanning mod directories and extracting manifest metadata
 * @see ../routes/modsRoutes.js
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */

/**
 * @typedef {object} ModDependency
 * @property {string} id - Dependency mod ID
 * @property {string} version - SemVer version range required
 */

/**
 * @typedef {object} ModMetadata
 * @property {string} id - Unique mod identifier
 * @property {string} name - Human-readable mod name
 * @property {string} version - SemVer version string
 * @property {string} description - Brief mod description
 * @property {string} author - Mod author
 * @property {ModDependency[]} dependencies - Required mod dependencies
 * @property {string[]} conflicts - IDs of incompatible mods
 * @property {boolean} hasWorlds - Whether mod contains world definitions
 * @property {{backgroundColor: string, textColor: string}|null} actionVisual - Visual styling from first action
 */

/**
 * Service for scanning the mods directory and extracting manifest metadata
 */
export class ModScannerService {
  /** @type {ILogger} */
  #logger;

  /** @type {string} */
  #modsPath;

  /**
   * Constructs a ModScannerService instance
   * @param {ILogger} logger - Logger instance
   * @param {string} [modsPath='../data/mods'] - Path to mods directory relative to CWD
   */
  constructor(logger, modsPath = '../data/mods') {
    if (!logger) {
      throw new Error('ModScannerService: logger is required');
    }

    this.#logger = logger;
    this.#modsPath = path.resolve(process.cwd(), modsPath);

    this.#logger.debug('ModScannerService: Instance created', {
      modsPath: this.#modsPath,
    });
  }

  /**
   * Scans the mods directory and returns metadata for all valid mods
   * @returns {Promise<ModMetadata[]>} Array of mod metadata objects
   */
  async scanMods() {
    /** @type {ModMetadata[]} */
    const mods = [];

    try {
      const entries = await fs.readdir(this.#modsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const manifestPath = path.join(
          this.#modsPath,
          entry.name,
          'mod-manifest.json'
        );

        try {
          const manifestContent = await fs.readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(manifestContent);

          mods.push({
            id: manifest.id,
            name: manifest.name,
            version: manifest.version,
            description: manifest.description || '',
            author: manifest.author || 'Unknown',
            dependencies: manifest.dependencies || [],
            conflicts: manifest.conflicts || [],
            hasWorlds: await this.#checkForWorlds(entry.name),
            actionVisual: await this.#extractActionVisual(entry.name),
          });
        } catch (manifestError) {
          this.#logger.warn(
            `ModScannerService: Skipping mod ${entry.name}: ${manifestError.message}`
          );
        }
      }
    } catch (dirError) {
      if (dirError.code === 'ENOENT') {
        this.#logger.warn('ModScannerService: Mods directory does not exist', {
          path: this.#modsPath,
        });
        return [];
      }
      throw dirError;
    }

    this.#logger.info(`ModScannerService: Scanned ${mods.length} mods`);
    return mods;
  }

  /**
   * Checks if a mod contains a worlds directory
   * @param {string} modName - Name of the mod directory
   * @returns {Promise<boolean>} True if worlds directory exists
   */
  async #checkForWorlds(modName) {
    const worldsPath = path.join(this.#modsPath, modName, 'worlds');
    try {
      const stats = await fs.stat(worldsPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Extracts the first visual property from a mod's action files
   * @param {string} modName - Name of the mod directory
   * @returns {Promise<{backgroundColor: string, textColor: string}|null>} Visual data or null
   */
  async #extractActionVisual(modName) {
    const actionsPath = path.join(this.#modsPath, modName, 'actions');
    try {
      const files = await fs.readdir(actionsPath);
      const actionFiles = files.filter((f) => f.endsWith('.action.json'));

      for (const file of actionFiles) {
        try {
          const content = await fs.readFile(
            path.join(actionsPath, file),
            'utf-8'
          );
          const action = JSON.parse(content);
          if (action.visual?.backgroundColor && action.visual?.textColor) {
            return {
              backgroundColor: action.visual.backgroundColor,
              textColor: action.visual.textColor,
            };
          }
        } catch {
          // Skip invalid action files
        }
      }
    } catch {
      // Actions directory doesn't exist or isn't readable
    }
    return null;
  }
}

export default ModScannerService;
