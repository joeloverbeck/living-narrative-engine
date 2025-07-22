/**
 * @file IndexedDB storage operations for character data
 * @see ../storage/characterDatabase.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  serializeCharacterConcept,
  deserializeCharacterConcept,
  validateCharacterConcept,
} from '../models/characterConcept.js';
import {
  serializeThematicDirection,
  deserializeThematicDirection,
  validateThematicDirections,
} from '../models/thematicDirection.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../storage/characterDatabase.js').CharacterDatabase} CharacterDatabase
 * @typedef {import('../models/characterConcept.js').CharacterConcept} CharacterConcept
 * @typedef {import('../models/thematicDirection.js').ThematicDirection} ThematicDirection
 */

/**
 * Custom error for character storage operations
 */
export class CharacterStorageError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'CharacterStorageError';
    this.cause = cause;
  }
}

/**
 * Service for managing persistent storage of character data
 */
export class CharacterStorageService {
  #logger;
  #database;
  #schemaValidator;
  #initialized = false;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {CharacterDatabase} dependencies.database - Character database instance
   * @param {ISchemaValidator} dependencies.schemaValidator - Schema validator instance
   */
  constructor({ logger, database, schemaValidator }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(database, 'CharacterDatabase', logger, {
      requiredMethods: [
        'initialize',
        'saveCharacterConcept',
        'getCharacterConcept',
        'getAllCharacterConcepts',
        'deleteCharacterConcept',
        'saveThematicDirections',
        'getThematicDirectionsByConceptId',
        'close',
      ],
    });
    validateDependency(schemaValidator, 'ISchemaValidator', logger, {
      requiredMethods: ['validateAgainstSchema', 'formatAjvErrors'],
    });

    this.#logger = logger;
    this.#database = database;
    this.#schemaValidator = schemaValidator;
  }

  /**
   * Initialize the storage service
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.#initialized) {
      this.#logger.debug('CharacterStorageService: Already initialized');
      return;
    }

    try {
      await this.#database.initialize();
      this.#initialized = true;
      this.#logger.info('CharacterStorageService: Successfully initialized');
    } catch (error) {
      throw new CharacterStorageError(
        `Failed to initialize character storage: ${error.message}`,
        error
      );
    }
  }

  /**
   * Ensure the service is initialized
   *
   * @private
   * @throws {CharacterStorageError} If not initialized
   */
  #ensureInitialized() {
    if (!this.#initialized) {
      throw new CharacterStorageError(
        'CharacterStorageService not initialized. Call initialize() first.'
      );
    }
  }

  /**
   * Store a character concept
   *
   * @param {CharacterConcept} concept - Character concept to store
   * @returns {Promise<CharacterConcept>} Stored concept
   * @throws {CharacterStorageError} If storage fails
   */
  async storeCharacterConcept(concept) {
    this.#ensureInitialized();

    if (!concept) {
      throw new CharacterStorageError('concept is required');
    }

    const maxRetries = 3;
    let attempt = 0;
    let lastError;

    while (attempt < maxRetries) {
      try {
        // Validate the concept against schema
        const isValid = this.#schemaValidator.validateAgainstSchema(
          concept,
          'character-concept'
        );
        if (!isValid) {
          const errorMsg = this.#schemaValidator.formatAjvErrors();
          throw new CharacterStorageError(
            `Character concept validation failed: ${errorMsg}`
          );
        }

        // Store to database
        const storedConcept =
          await this.#database.saveCharacterConcept(concept);

        this.#logger.info(
          `CharacterStorageService: Successfully stored character concept ${concept.id}`,
          { conceptId: concept.id, attempt: attempt + 1 }
        );

        return storedConcept;
      } catch (error) {
        attempt++;
        lastError = error;

        this.#logger.warn(
          `CharacterStorageService: Attempt ${attempt} failed for concept storage: ${error.message}`,
          { conceptId: concept.id, attempt, error }
        );

        // Don't retry validation errors
        if (
          error.message.includes('validation failed') ||
          attempt >= maxRetries
        ) {
          break;
        }

        // Wait before retrying
        const backoffTime = Math.min(500 * Math.pow(2, attempt - 1), 2000);
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
      }
    }

    const message = `Failed to store character concept ${concept.id} after ${maxRetries} attempts: ${lastError.message}`;
    this.#logger.error(message, lastError);
    throw new CharacterStorageError(message, lastError);
  }

  /**
   * Store thematic directions
   *
   * @param {string} conceptId - Character concept ID
   * @param {ThematicDirection[]} directions - Thematic directions to store
   * @returns {Promise<ThematicDirection[]>} Stored directions
   * @throws {CharacterStorageError} If storage fails
   */
  async storeThematicDirections(conceptId, directions) {
    this.#ensureInitialized();

    if (!conceptId || typeof conceptId !== 'string') {
      throw new CharacterStorageError('conceptId must be a non-empty string');
    }

    if (!Array.isArray(directions)) {
      throw new CharacterStorageError('directions must be an array');
    }

    if (directions.length === 0) {
      this.#logger.info(
        'CharacterStorageService: No thematic directions found',
        { conceptId }
      );
      return [];
    }

    const maxRetries = 3;
    let attempt = 0;
    let lastError;

    while (attempt < maxRetries) {
      try {
        // Validate all directions
        for (const direction of directions) {
          const isValid = this.#schemaValidator.validateAgainstSchema(
            direction,
            'thematic-direction'
          );
          if (!isValid) {
            const errorMsg = this.#schemaValidator.formatAjvErrors();
            throw new CharacterStorageError(
              `Thematic direction validation failed: ${errorMsg}`
            );
          }
        }

        // Store to database
        const storedDirections =
          await this.#database.saveThematicDirections(directions);

        this.#logger.info(
          `CharacterStorageService: Successfully stored thematic directions`,
          { conceptId, directionCount: directions.length, attempt: attempt + 1 }
        );

        return storedDirections;
      } catch (error) {
        attempt++;
        lastError = error;

        this.#logger.warn(
          `CharacterStorageService: Attempt ${attempt} failed for directions storage: ${error.message}`,
          { conceptId, attempt, error }
        );

        // Don't retry validation errors
        if (
          error.message.includes('validation failed') ||
          attempt >= maxRetries
        ) {
          break;
        }

        // Wait before retrying
        const backoffTime = Math.min(500 * Math.pow(2, attempt - 1), 2000);
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
      }
    }

    const message = `Failed to store thematic directions for concept ${conceptId} after ${maxRetries} attempts: ${lastError.message}`;
    this.#logger.error(message, lastError);
    throw new CharacterStorageError(message, lastError);
  }

  /**
   * List all character concepts
   *
   * @returns {Promise<CharacterConcept[]>} Array of character concepts
   * @throws {CharacterStorageError} If retrieval fails
   */
  async listCharacterConcepts() {
    this.#ensureInitialized();

    try {
      const concepts = await this.#database.getAllCharacterConcepts();

      this.#logger.debug(
        `CharacterStorageService: Retrieved character concepts list`,
        { conceptCount: concepts.length }
      );
      return concepts;
    } catch (error) {
      const message = `Failed to list character concepts: ${error.message}`;
      this.#logger.error(message, error);
      throw new CharacterStorageError(message, error);
    }
  }

  /**
   * Get character concept by ID
   *
   * @param {string} conceptId - Character concept ID
   * @returns {Promise<CharacterConcept|null>} Character concept or null if not found
   * @throws {CharacterStorageError} If retrieval fails
   */
  async getCharacterConcept(conceptId) {
    this.#ensureInitialized();

    if (!conceptId || typeof conceptId !== 'string') {
      throw new CharacterStorageError('conceptId must be a non-empty string');
    }

    try {
      const concept = await this.#database.getCharacterConcept(conceptId);

      if (!concept) {
        this.#logger.warn(
          `CharacterStorageService: Character concept not found`,
          { conceptId }
        );
        return null;
      }

      this.#logger.debug(
        `CharacterStorageService: Retrieved character concept`,
        { conceptId }
      );
      return concept;
    } catch (error) {
      const message = `Failed to get character concept ${conceptId}: ${error.message}`;
      this.#logger.error(message, error);
      throw new CharacterStorageError(message, error);
    }
  }

  /**
   * Get thematic directions for a concept ID
   *
   * @param {string} conceptId - Character concept ID
   * @returns {Promise<ThematicDirection[]>} Array of thematic directions
   * @throws {CharacterStorageError} If retrieval fails
   */
  async getThematicDirections(conceptId) {
    this.#ensureInitialized();

    if (!conceptId || typeof conceptId !== 'string') {
      throw new CharacterStorageError('conceptId must be a non-empty string');
    }

    try {
      const directions =
        await this.#database.getThematicDirectionsByConceptId(conceptId);

      if (!directions || directions.length === 0) {
        this.#logger.info(
          `CharacterStorageService: No thematic directions found`,
          { conceptId }
        );
        return [];
      }

      this.#logger.debug(
        `CharacterStorageService: Retrieved thematic directions`,
        { conceptId, directionCount: directions.length }
      );
      return directions;
    } catch (error) {
      const message = `Failed to get thematic directions for concept ${conceptId}: ${error.message}`;
      this.#logger.error(message, error);
      throw new CharacterStorageError(message, error);
    }
  }

  /**
   * Delete character concept and associated data
   *
   * @param {string} conceptId - Character concept ID
   * @returns {Promise<boolean>} True if deleted successfully
   * @throws {CharacterStorageError} If deletion fails
   */
  async deleteCharacterConcept(conceptId) {
    this.#ensureInitialized();

    if (!conceptId || typeof conceptId !== 'string') {
      throw new CharacterStorageError('conceptId must be a non-empty string');
    }

    try {
      const success = await this.#database.deleteCharacterConcept(conceptId);

      if (success) {
        this.#logger.info(
          `CharacterStorageService: Successfully deleted character concept`,
          { conceptId }
        );
      } else {
        this.#logger.warn(
          `CharacterStorageService: Character concept not found for deletion`,
          { conceptId }
        );
      }

      return success;
    } catch (error) {
      const message = `Failed to delete character concept ${conceptId}: ${error.message}`;
      this.#logger.error(message, error);
      throw new CharacterStorageError(message, error);
    }
  }

  /**
   * Close the storage service
   *
   * @returns {Promise<void>}
   */
  async close() {
    if (this.#database && this.#initialized) {
      try {
        await this.#database.close();
        this.#initialized = false;
        this.#logger.info(
          'CharacterStorageService: Storage service closed successfully'
        );
      } catch (error) {
        this.#logger.error(
          'CharacterStorageService: Error closing storage service',
          error
        );
        throw new CharacterStorageError(
          `Failed to close storage service: ${error.message}`,
          error
        );
      }
    }
  }
}
