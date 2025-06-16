// src/persistence/saveValidationService.js

import { encode } from '@msgpack/msgpack';
import {
  PersistenceError,
  PersistenceErrorCodes,
} from './persistenceErrors.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./gameStateSerializer.js').default} GameStateSerializer */
/** @typedef {import('../interfaces/ISaveLoadService.js').SaveGameStructure} SaveGameStructure */

/**
 * @class SaveValidationService
 * @description Provides validation utilities for loaded save data.
 */
class SaveValidationService {
  /** @type {ILogger} */
  #logger;

  /** @type {GameStateSerializer} */
  #serializer;

  /**
   * Creates a new SaveValidationService instance.
   *
   * @param {object} dependencies - Constructor dependencies.
   * @param {ILogger} dependencies.logger - Logger for diagnostic output.
   * @param {GameStateSerializer} dependencies.gameStateSerializer - Serializer used for checksum generation.
   */
  constructor({ logger, gameStateSerializer }) {
    this.#logger = logger;
    this.#serializer = gameStateSerializer;
  }

  /**
   * Validates that the save object contains all required sections.
   *
   * @param {SaveGameStructure} obj - The deserialized save object.
   * @param {string} identifier - Identifier used for logging.
   * @returns {import('./persistenceTypes.js').PersistenceResult<null>} Result of validation.
   */
  validateStructure(obj, identifier) {
    const requiredSections = [
      'metadata',
      'modManifest',
      'gameState',
      'integrityChecks',
    ];
    for (const section of requiredSections) {
      if (
        !(section in obj) ||
        typeof obj[section] !== 'object' ||
        obj[section] === null
      ) {
        const devMsg = `Save file ${identifier} is missing or has invalid section: '${section}'.`;
        const userMsg =
          'The save file is incomplete or has an unknown format. It might be corrupted or from an incompatible game version.';
        this.#logger.error(devMsg + ` User message: "${userMsg}"`);
        return {
          success: false,
          error: new PersistenceError(
            PersistenceErrorCodes.INVALID_GAME_STATE,
            userMsg
          ),
        };
      }
    }
    this.#logger.debug(
      `Basic structure validation passed for ${identifier}. All required sections present.`
    );
    return { success: true };
  }

  /**
   * Recalculates and verifies the checksum for the provided save object.
   *
   * @param {SaveGameStructure} obj - The deserialized save object.
   * @param {string} identifier - Identifier used for logging.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<null>>} Result of checksum verification.
   */
  async verifyChecksum(obj, identifier) {
    const storedChecksum = obj.integrityChecks.gameStateChecksum;
    if (!storedChecksum || typeof storedChecksum !== 'string') {
      const devMsg = `Save file ${identifier} is missing gameStateChecksum.`;
      const userMsg =
        'The save file is missing integrity information and cannot be safely loaded. It might be corrupted or from an incompatible older version.';
      this.#logger.error(devMsg + ` User message: "${userMsg}"`);
      return {
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.INVALID_GAME_STATE,
          userMsg
        ),
      };
    }

    let recalculatedChecksum;
    try {
      const gameStateMessagePack = encode(obj.gameState);
      recalculatedChecksum =
        await this.#serializer.generateChecksum(gameStateMessagePack);
    } catch (checksumError) {
      const devMsg = `Error calculating checksum for gameState in ${identifier}: ${checksumError.message}.`;
      const userMsg =
        'Could not verify the integrity of the save file due to an internal error. The file might be corrupted.';
      this.#logger.error(devMsg + ` User message: "${userMsg}"`, checksumError);
      return {
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.CHECKSUM_CALCULATION_ERROR,
          userMsg
        ),
      };
    }

    if (storedChecksum !== recalculatedChecksum) {
      const devMsg = `Checksum mismatch for ${identifier}. Stored: ${storedChecksum}, Calculated: ${recalculatedChecksum}.`;
      const userMsg =
        'The save file appears to be corrupted (integrity check failed). Please try another save or a backup.';
      this.#logger.error(devMsg + ` User message: "${userMsg}"`);
      return {
        success: false,
        error: new PersistenceError(
          PersistenceErrorCodes.CHECKSUM_MISMATCH,
          userMsg
        ),
      };
    }
    this.#logger.debug(`Checksum VERIFIED for ${identifier}.`);
    return { success: true };
  }

  /**
   * Validates the overall save object structure and checksum.
   *
   * @param {SaveGameStructure} obj - The deserialized save object.
   * @param {string} identifier - Identifier used for logging.
   * @returns {Promise<import('./persistenceTypes.js').PersistenceResult<null>>} Validation result.
   */
  async validateLoadedSaveObject(obj, identifier) {
    const structureResult = this.validateStructure(obj, identifier);
    if (!structureResult.success) {
      return structureResult;
    }
    return this.verifyChecksum(obj, identifier);
  }
}

export default SaveValidationService;
