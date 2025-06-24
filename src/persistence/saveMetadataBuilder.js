// src/persistence/saveMetadataBuilder.js

import { ENGINE_VERSION } from '../engine/engineVersion.js';

/**
 * @typedef {object} SaveMetadataBuilderDeps
 * @property {import('../interfaces/coreServices.js').ILogger} logger - Logger for warnings.
 * @property {string} [engineVersion] - Default engine version to use if none provided.
 * @property {string} [saveFormatVersion] - Version for the save format.
 * @property {() => Date} [timeProvider] - Function returning the current time.
 */

/**
 * @class SaveMetadataBuilder
 * @description Constructs metadata blocks for save files.
 */
export default class SaveMetadataBuilder {
  /** @type {import('../interfaces/coreServices.js').ILogger} */
  #logger;
  /** @type {string} */
  #engineVersion;
  /** @type {string} */
  #saveFormatVersion;
  /** @type {() => Date} */
  #timeProvider;

  /**
   * Create a new SaveMetadataBuilder.
   *
   * @param {SaveMetadataBuilderDeps} deps - Constructor dependencies.
   */
  constructor({
    logger,
    engineVersion = ENGINE_VERSION,
    saveFormatVersion = '1.0.0',
    timeProvider = () => new Date(),
  }) {
    if (!logger) {
      throw new Error('SaveMetadataBuilder requires a logger.');
    }
    this.#logger = logger;
    this.#engineVersion = engineVersion;
    this.#saveFormatVersion = saveFormatVersion;
    this.#timeProvider = timeProvider;
  }

  /**
   * Builds a metadata object for a save file.
   *
   * @param {string | null | undefined} worldName - Active world name.
   * @param {number} playtimeSeconds - Accumulated playtime.
   * @param {string} [engineVersion] - Override engine version.
   * @returns {object} Metadata structure.
   */
  build(worldName, playtimeSeconds, engineVersion = this.#engineVersion) {
    const title = worldName || 'Unknown Game';
    if (!worldName) {
      this.#logger.warn(
        `${this.constructor.name}.build: No worldName provided. Defaulting to 'Unknown Game'.`
      );
    }
    return {
      saveFormatVersion: this.#saveFormatVersion,
      engineVersion,
      gameTitle: title,
      timestamp: this.#timeProvider().toISOString(),
      playtimeSeconds,
      saveName: '',
    };
  }
}
