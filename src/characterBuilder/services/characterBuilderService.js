/**
 * @file Main orchestration service for character building operations
 * @see ./characterStorageService.js
 * @see ./thematicDirectionGenerator.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import {
  createCharacterConcept,
  updateCharacterConcept,
  CHARACTER_CONCEPT_STATUS,
} from '../models/characterConcept.js';

/**
 * Retry configuration for character builder operations
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: process.env.NODE_ENV === 'test' ? 10 : 1000,
  maxDelayMs: process.env.NODE_ENV === 'test' ? 50 : 5000,
  directionBaseDelayMs: process.env.NODE_ENV === 'test' ? 20 : 2000,
  directionMaxDelayMs: process.env.NODE_ENV === 'test' ? 100 : 10000,
};

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('./characterStorageService.js').CharacterStorageService} CharacterStorageService
 * @typedef {import('./thematicDirectionGenerator.js').ThematicDirectionGenerator} ThematicDirectionGenerator
 * @typedef {import('../models/characterConcept.js').CharacterConcept} CharacterConcept
 * @typedef {import('../models/thematicDirection.js').ThematicDirection} ThematicDirection
 */

/**
 * Character builder events
 */
export const CHARACTER_BUILDER_EVENTS = {
  CONCEPT_CREATED: 'thematic:character_concept_created',
  CONCEPT_UPDATED: 'thematic:character_concept_updated',
  DIRECTIONS_GENERATED: 'thematic:thematic_directions_generated',
  CONCEPT_SAVED: 'thematic:character_concept_saved',
  CONCEPT_DELETED: 'thematic:character_concept_deleted',
  DIRECTION_UPDATED: 'thematic:direction_updated',
  DIRECTION_DELETED: 'thematic:direction_deleted',
  ERROR_OCCURRED: 'thematic:character_builder_error_occurred',
};

/**
 * Custom error for character builder operations
 */
export class CharacterBuilderError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'CharacterBuilderError';
    this.cause = cause;
  }
}

/**
 * Main orchestration service for character building operations
 */
export class CharacterBuilderService {
  #logger;
  #storageService;
  #directionGenerator;
  #eventBus;
  #circuitBreakers = new Map(); // For circuit breaker pattern

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {CharacterStorageService} dependencies.storageService - Storage service
   * @param {ThematicDirectionGenerator} dependencies.directionGenerator - Direction generator
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event dispatcher
   */
  constructor({ logger, storageService, directionGenerator, eventBus }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(storageService, 'CharacterStorageService', logger, {
      requiredMethods: [
        'initialize',
        'storeCharacterConcept',
        'listCharacterConcepts',
        'getCharacterConcept',
        'deleteCharacterConcept',
        'storeThematicDirections',
        'getThematicDirections',
      ],
    });
    validateDependency(
      directionGenerator,
      'ThematicDirectionGenerator',
      logger,
      {
        requiredMethods: ['generateDirections'],
      }
    );
    validateDependency(eventBus, 'ISafeEventDispatcher', logger, {
      requiredMethods: ['dispatch'],
    });

    this.#logger = logger;
    this.#storageService = storageService;
    this.#directionGenerator = directionGenerator;
    this.#eventBus = eventBus;
  }

  /**
   * Initialize the character builder service
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      await this.#storageService.initialize();
      this.#logger.info('CharacterBuilderService: Successfully initialized');
    } catch (error) {
      throw new CharacterBuilderError(
        `Failed to initialize character builder service: ${error.message}`,
        error
      );
    }
  }

  /**
   * Create a new character concept
   *
   * @param {string} concept - User-provided character concept text
   * @param {object} [options] - Creation options
   * @param {boolean} [options.autoSave] - Whether to automatically save the concept
   * @returns {Promise<CharacterConcept>} Created character concept
   * @throws {CharacterBuilderError} If creation fails
   */
  async createCharacterConcept(concept, options = {}) {
    const { autoSave = true } = options;

    if (
      !concept ||
      typeof concept !== 'string' ||
      concept.trim().length === 0
    ) {
      throw new CharacterBuilderError('concept must be a non-empty string');
    }

    const maxRetries = RETRY_CONFIG.maxRetries;
    let attempt = 0;
    let lastError;

    while (attempt < maxRetries) {
      try {
        // Create the character concept model
        const characterConcept = createCharacterConcept(concept);

        this.#logger.info(
          `CharacterBuilderService: Created character concept ${characterConcept.id}`,
          {
            conceptId: characterConcept.id,
            concept:
              concept.substring(0, 50) + (concept.length > 50 ? '...' : ''),
            autoSave,
            attempt: attempt + 1,
          }
        );

        // Save if requested
        let savedConcept = characterConcept;
        if (autoSave) {
          savedConcept =
            await this.#storageService.storeCharacterConcept(characterConcept);
        }

        // Dispatch success event
        this.#eventBus.dispatch(CHARACTER_BUILDER_EVENTS.CONCEPT_CREATED, {
          conceptId: savedConcept.id,
          concept:
            concept.substring(0, 100) + (concept.length > 100 ? '...' : ''),
          autoSaved: autoSave,
        });

        return savedConcept;
      } catch (error) {
        attempt++;
        lastError = error;

        this.#logger.warn(
          `CharacterBuilderService: Attempt ${attempt} failed for concept creation: ${error.message}`,
          { attempt, error }
        );

        // If it's the last attempt or a validation error, don't retry
        if (
          attempt >= maxRetries ||
          error.name === 'CharacterConceptValidationError'
        ) {
          break;
        }

        // Wait before retrying (exponential backoff)
        const backoffTime = Math.min(
          RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt - 1),
          RETRY_CONFIG.maxDelayMs
        );
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
      }
    }

    // All retries failed
    const message = `Failed to create character concept after ${maxRetries} attempts: ${lastError.message}`;
    this.#logger.error(message, lastError);

    this.#eventBus.dispatch(CHARACTER_BUILDER_EVENTS.ERROR_OCCURRED, {
      error: message,
      operation: 'createCharacterConcept',
      concept: concept.substring(0, 100) + (concept.length > 100 ? '...' : ''),
      attempts: maxRetries,
      finalError: lastError.message,
    });

    throw new CharacterBuilderError(message, lastError);
  }

  /**
   * Generate thematic directions for a character concept
   *
   * @param {string} conceptId - Character concept ID
   * @param {object} [options] - Generation options
   * @param {boolean} [options.autoSave] - Whether to automatically save the directions
   * @param {string} [options.llmConfigId] - Specific LLM config to use
   * @returns {Promise<ThematicDirection[]>} Generated thematic directions
   * @throws {CharacterBuilderError} If generation fails
   */
  async generateThematicDirections(conceptId, options = {}) {
    const { autoSave = true, llmConfigId } = options;

    if (!conceptId || typeof conceptId !== 'string') {
      throw new CharacterBuilderError('conceptId must be a non-empty string');
    }

    const maxRetries = RETRY_CONFIG.maxRetries;
    let attempt = 0;
    let lastError;
    let concept;

    // Circuit breaker pattern for repeated failures
    const circuitBreakerKey = `directions_${conceptId}`;
    const failureCount = this.#getCircuitBreakerCount(circuitBreakerKey);

    if (failureCount >= 5) {
      const cooldownPeriod = 5 * 60 * 1000; // 5 minutes
      const lastFailureTime = this.#getLastFailureTime(circuitBreakerKey);
      if (Date.now() - lastFailureTime < cooldownPeriod) {
        throw new CharacterBuilderError(
          `Service temporarily unavailable for concept ${conceptId}. Too many recent failures.`
        );
      } else {
        this.#resetCircuitBreaker(circuitBreakerKey);
      }
    }

    while (attempt < maxRetries) {
      try {
        // Get the character concept
        concept = await this.#storageService.getCharacterConcept(conceptId);
        if (!concept) {
          throw new CharacterBuilderError(
            `Character concept not found: ${conceptId}`
          );
        }

        this.#logger.info(
          `CharacterBuilderService: Starting thematic direction generation for concept ${conceptId}`,
          {
            conceptId,
            concept:
              concept.concept.substring(0, 50) +
              (concept.concept.length > 50 ? '...' : ''),
            llmConfigId,
            attempt: attempt + 1,
          }
        );

        // Build character description from concept data
        const characterDescription = this.#buildCharacterDescription(concept);

        // Generate thematic directions with timeout
        const generationTimeout = 60000; // 60 seconds
        const thematicDirections = await Promise.race([
          this.#directionGenerator.generateDirections(
            conceptId,
            characterDescription,
            { llmConfigId }
          ),
          this.#createTimeoutPromise(
            generationTimeout,
            'LLM generation timeout'
          ),
        ]);

        if (
          !thematicDirections ||
          !Array.isArray(thematicDirections) ||
          thematicDirections.length === 0
        ) {
          throw new CharacterBuilderError(
            'Generated directions are empty or invalid'
          );
        }

        // Save the directions if requested
        let savedDirections = thematicDirections;
        if (autoSave) {
          savedDirections = await this.#storageService.storeThematicDirections(
            conceptId,
            thematicDirections
          );
        }

        this.#logger.info(
          `CharacterBuilderService: Successfully generated ${thematicDirections.length} thematic directions for concept ${conceptId}`,
          {
            conceptId,
            directionCount: thematicDirections.length,
            attempt: attempt + 1,
          }
        );

        // Reset circuit breaker on success
        this.#resetCircuitBreaker(circuitBreakerKey);

        // Dispatch success event
        this.#eventBus.dispatch(CHARACTER_BUILDER_EVENTS.DIRECTIONS_GENERATED, {
          conceptId,
          directionCount: savedDirections.length,
          autoSaved: autoSave,
        });

        return savedDirections;
      } catch (error) {
        attempt++;
        lastError = error;

        this.#logger.warn(
          `CharacterBuilderService: Attempt ${attempt} failed for directions generation: ${error.message}`,
          { conceptId, attempt, error }
        );

        // Increment circuit breaker failure count
        this.#incrementCircuitBreaker(circuitBreakerKey);

        // Don't retry for certain types of errors
        const nonRetryableErrors = [
          'CharacterConceptValidationError',
          'ThematicDirectionValidationError',
          'Character concept not found',
        ];

        if (
          attempt >= maxRetries ||
          nonRetryableErrors.some((errorType) =>
            error.message.includes(errorType)
          )
        ) {
          break;
        }

        // Wait before retrying (exponential backoff)
        const backoffTime = Math.min(
          RETRY_CONFIG.directionBaseDelayMs * Math.pow(2, attempt - 1),
          RETRY_CONFIG.directionMaxDelayMs
        );
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
      }
    }

    // All retries failed
    const message = `Failed to generate thematic directions for concept ${conceptId} after ${maxRetries} attempts: ${lastError.message}`;
    this.#logger.error(message, lastError);

    this.#eventBus.dispatch(CHARACTER_BUILDER_EVENTS.ERROR_OCCURRED, {
      error: message,
      operation: 'generateThematicDirections',
      conceptId,
      attempts: maxRetries,
      finalError: lastError.message,
    });

    throw new CharacterBuilderError(message, lastError);
  }

  /**
   * Get all character concepts
   *
   * @returns {Promise<CharacterConcept[]>} Array of character concepts
   * @throws {CharacterBuilderError} If retrieval fails
   */
  async getAllCharacterConcepts() {
    try {
      const concepts = await this.#storageService.listCharacterConcepts();
      this.#logger.debug(
        `CharacterBuilderService: Retrieved ${concepts.length} character concepts`
      );
      return concepts;
    } catch (error) {
      const message = `Failed to list character concepts: ${error.message}`;
      this.#logger.error(message, error);
      throw new CharacterBuilderError(message, error);
    }
  }

  /**
   * Get character concept by ID
   *
   * @param {string} conceptId - Character concept ID
   * @returns {Promise<CharacterConcept|null>} Character concept or null if not found
   * @throws {CharacterBuilderError} If retrieval fails
   */
  async getCharacterConcept(conceptId) {
    if (!conceptId || typeof conceptId !== 'string') {
      throw new CharacterBuilderError('conceptId must be a non-empty string');
    }

    try {
      const concept = await this.#storageService.getCharacterConcept(conceptId);

      if (concept) {
        this.#logger.debug(
          `CharacterBuilderService: Retrieved character concept ${conceptId}`
        );
      } else {
        this.#logger.debug(
          `CharacterBuilderService: Character concept ${conceptId} not found`
        );
      }

      return concept;
    } catch (error) {
      const message = `Failed to get character concept ${conceptId}: ${error.message}`;
      this.#logger.error(message, error);
      throw new CharacterBuilderError(message, error);
    }
  }

  /**
   * Get thematic directions for a character concept
   *
   * @param {string} conceptId - Character concept ID
   * @returns {Promise<ThematicDirection[]>} Array of thematic directions
   * @throws {CharacterBuilderError} If retrieval fails
   */
  async getThematicDirections(conceptId) {
    if (!conceptId || typeof conceptId !== 'string') {
      throw new CharacterBuilderError('conceptId must be a non-empty string');
    }

    try {
      const directions =
        await this.#storageService.getThematicDirections(conceptId);
      this.#logger.debug(
        `CharacterBuilderService: Retrieved ${directions.length} thematic directions for concept ${conceptId}`
      );
      return directions;
    } catch (error) {
      const message = `Failed to get thematic directions for concept ${conceptId}: ${error.message}`;
      this.#logger.error(message, error);
      throw new CharacterBuilderError(message, error);
    }
  }

  /**
   * Delete character concept and associated data
   *
   * @param {string} conceptId - Character concept ID
   * @returns {Promise<boolean>} True if deleted successfully
   * @throws {CharacterBuilderError} If deletion fails
   */
  async deleteCharacterConcept(conceptId) {
    if (!conceptId || typeof conceptId !== 'string') {
      throw new CharacterBuilderError('conceptId must be a non-empty string');
    }

    try {
      const success =
        await this.#storageService.deleteCharacterConcept(conceptId);

      if (success) {
        this.#logger.info(
          `CharacterBuilderService: Deleted character concept ${conceptId}`
        );

        this.#eventBus.dispatch(CHARACTER_BUILDER_EVENTS.CONCEPT_DELETED, {
          conceptId,
        });
      }

      return success;
    } catch (error) {
      const message = `Failed to delete character concept ${conceptId}: ${error.message}`;
      this.#logger.error(message, error);

      this.#eventBus.dispatch(CHARACTER_BUILDER_EVENTS.ERROR_OCCURRED, {
        error: message,
        operation: 'deleteCharacterConcept',
        conceptId,
      });

      throw new CharacterBuilderError(message, error);
    }
  }

  /**
   * Update an existing character concept
   *
   * @param {string} conceptId - Character concept ID
   * @param {object} updates - Updates to apply
   * @param {string} [updates.concept] - New concept text
   * @param {object} [updates.metadata] - New metadata
   * @returns {Promise<CharacterConcept>} Updated character concept
   * @throws {CharacterBuilderError} If update fails
   */
  async updateCharacterConcept(conceptId, updates) {
    if (!conceptId || typeof conceptId !== 'string') {
      throw new CharacterBuilderError('conceptId must be a non-empty string');
    }

    if (!updates || typeof updates !== 'object') {
      throw new CharacterBuilderError('updates must be a valid object');
    }

    try {
      // Get existing concept
      const existingConcept =
        await this.#storageService.getCharacterConcept(conceptId);
      if (!existingConcept) {
        throw new CharacterBuilderError(
          `Character concept not found: ${conceptId}`
        );
      }

      // Apply updates
      const updatedConcept = updateCharacterConcept(existingConcept, updates);

      // Save updated concept
      const savedConcept =
        await this.#storageService.saveCharacterConcept(updatedConcept);

      this.#logger.info(
        `CharacterBuilderService: Updated character concept ${conceptId}`
      );

      // Dispatch event
      this.#eventBus.dispatch(CHARACTER_BUILDER_EVENTS.CONCEPT_UPDATED, {
        concept: savedConcept,
        updates,
      });

      return savedConcept;
    } catch (error) {
      const message = `Failed to update character concept ${conceptId}: ${error.message}`;
      this.#logger.error(message, error);

      this.#eventBus.dispatch(CHARACTER_BUILDER_EVENTS.ERROR_OCCURRED, {
        error: message,
        operation: 'updateCharacterConcept',
        conceptId,
        updates,
      });

      throw new CharacterBuilderError(message, error);
    }
  }

  /**
   * Get all thematic directions with their associated concepts
   *
   * @returns {Promise<Array<{direction: ThematicDirection, concept: CharacterConcept|null}>>}
   */
  async getAllThematicDirectionsWithConcepts() {
    try {
      const allDirections =
        await this.#storageService.getAllThematicDirections();
      const result = [];

      for (const direction of allDirections) {
        let concept = null;
        try {
          concept = await this.#storageService.getCharacterConcept(
            direction.conceptId
          );
        } catch (error) {
          this.#logger.warn(
            `CharacterBuilderService: Failed to load concept for direction ${direction.id}`,
            { directionId: direction.id, conceptId: direction.conceptId }
          );
        }

        result.push({ direction, concept });
      }

      return result;
    } catch (error) {
      const message = `Failed to get all thematic directions with concepts: ${error.message}`;
      this.#logger.error(message, error);
      throw new CharacterBuilderError(message, error);
    }
  }

  /**
   * Get orphaned thematic directions (directions without valid concepts)
   *
   * @returns {Promise<ThematicDirection[]>}
   */
  async getOrphanedThematicDirections() {
    try {
      const orphanedDirections =
        await this.#storageService.findOrphanedDirections();
      this.#logger.info(
        `CharacterBuilderService: Found ${orphanedDirections.length} orphaned directions`
      );
      return orphanedDirections;
    } catch (error) {
      const message = `Failed to get orphaned thematic directions: ${error.message}`;
      this.#logger.error(message, error);
      throw new CharacterBuilderError(message, error);
    }
  }

  /**
   * Update a single thematic direction
   *
   * @param {string} directionId - Direction ID
   * @param {object} updates - Fields to update
   * @returns {Promise<ThematicDirection>}
   */
  async updateThematicDirection(directionId, updates) {
    if (!directionId || typeof directionId !== 'string') {
      throw new CharacterBuilderError('directionId must be a non-empty string');
    }

    if (!updates || typeof updates !== 'object') {
      throw new CharacterBuilderError('updates must be a valid object');
    }

    try {
      const updatedDirection =
        await this.#storageService.updateThematicDirection(
          directionId,
          updates
        );

      this.#eventBus.dispatch(CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED, {
        directionId,
        updates,
      });

      return updatedDirection;
    } catch (error) {
      const message = `Failed to update thematic direction ${directionId}: ${error.message}`;
      this.#logger.error(message, error);
      throw new CharacterBuilderError(message, error);
    }
  }

  /**
   * Delete a thematic direction
   *
   * @param {string} directionId - Direction ID
   * @returns {Promise<boolean>}
   */
  async deleteThematicDirection(directionId) {
    if (!directionId || typeof directionId !== 'string') {
      throw new CharacterBuilderError('directionId must be a non-empty string');
    }

    try {
      const success =
        await this.#storageService.deleteThematicDirection(directionId);

      if (success) {
        this.#eventBus.dispatch(CHARACTER_BUILDER_EVENTS.DIRECTION_DELETED, {
          directionId,
        });
      }

      return success;
    } catch (error) {
      const message = `Failed to delete thematic direction ${directionId}: ${error.message}`;
      this.#logger.error(message, error);
      throw new CharacterBuilderError(message, error);
    }
  }

  // Private helper methods for enhanced error handling

  /**
   * Build character description from concept data
   *
   * @param conceptData
   * @private
   */
  #buildCharacterDescription(conceptData) {
    // The concept data object contains the 'concept' string
    return conceptData.concept;
  }

  /**
   * Create a timeout promise
   *
   * @param timeout
   * @param errorMessage
   * @private
   */
  #createTimeoutPromise(timeout, errorMessage) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeout);
    });
  }

  /**
   * Get circuit breaker failure count
   *
   * @param key
   * @private
   */
  #getCircuitBreakerCount(key) {
    const breaker = this.#circuitBreakers.get(key);
    return breaker ? breaker.failures : 0;
  }

  /**
   * Get last failure time for circuit breaker
   *
   * @param key
   * @private
   */
  #getLastFailureTime(key) {
    const breaker = this.#circuitBreakers.get(key);
    return breaker ? breaker.lastFailureTime : 0;
  }

  /**
   * Increment circuit breaker failure count
   *
   * @param key
   * @private
   */
  #incrementCircuitBreaker(key) {
    const breaker = this.#circuitBreakers.get(key) || {
      failures: 0,
      lastFailureTime: 0,
    };
    breaker.failures += 1;
    breaker.lastFailureTime = Date.now();
    this.#circuitBreakers.set(key, breaker);

    this.#logger.debug(
      `CharacterBuilderService: Circuit breaker incremented for ${key}`,
      { failures: breaker.failures, lastFailureTime: breaker.lastFailureTime }
    );
  }

  /**
   * Reset circuit breaker
   *
   * @param key
   * @private
   */
  #resetCircuitBreaker(key) {
    this.#circuitBreakers.delete(key);
    this.#logger.debug(
      `CharacterBuilderService: Circuit breaker reset for ${key}`
    );
  }
}
