/**
 * @file Service for reading and writing game configuration files
 * @see ../handlers/gameConfigController.js
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Service responsible for persisting game configuration to disk.
 * Uses atomic write operations (temp file then rename) for data safety.
 */
export class GameConfigService {
  #logger;
  #configPath;

  /**
   * Creates a new GameConfigService instance.
   * @param {object} logger - Logger instance for debug and error logging
   * @param {string} [configPath] - Path to the game config file relative to cwd
   */
  constructor(logger, configPath = '../data/game.json') {
    if (!logger) {
      throw new Error('GameConfigService: logger is required');
    }
    this.#logger = logger;
    this.#configPath = path.resolve(process.cwd(), configPath);
    this.#logger.debug('GameConfigService: Instance created', {
      configPath: this.#configPath,
    });
  }

  /**
   * Saves the game configuration to disk atomically.
   * @param {object} config - Configuration object with mods and startWorld
   * @param {string[]} config.mods - Array of mod IDs to enable
   * @param {string} config.startWorld - Starting world identifier
   * @returns {Promise<void>}
   * @throws {Error} If write or rename operation fails
   */
  async saveConfig(config) {
    const content = JSON.stringify(config, null, 2);

    // Write to temp file first for atomicity
    const tempPath = path.join(os.tmpdir(), `game-${Date.now()}.json`);

    try {
      await fs.writeFile(tempPath, content, 'utf-8');

      // Verify written content is valid JSON
      const verification = await fs.readFile(tempPath, 'utf-8');
      JSON.parse(verification);

      // Ensure directory exists
      await fs.mkdir(path.dirname(this.#configPath), { recursive: true });

      // Atomic rename
      await fs.rename(tempPath, this.#configPath);

      this.#logger.debug('GameConfigService: Config file written', {
        path: this.#configPath,
      });
    } catch (error) {
      // Clean up temp file on failure
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Loads the current game configuration from disk.
   * @returns {Promise<object>} The game configuration object
   * @throws {Error} If file cannot be read (except ENOENT which returns default)
   */
  async loadConfig() {
    try {
      const content = await fs.readFile(this.#configPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Return default config if file doesn't exist
        this.#logger.debug(
          'GameConfigService: Config file not found, returning default'
        );
        return {
          mods: ['core'],
          startWorld: '',
        };
      }
      throw error;
    }
  }
}
