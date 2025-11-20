/**
 * @file Main orchestration service for character building operations
 * @see ./characterStorageService.js
 * @see ./thematicDirectionGenerator.js
 */

import {
  validateDependency,
  assertNonBlankString,
  assertPresent,
} from '../../utils/dependencyUtils.js';
import {
  createCharacterConcept,
  updateCharacterConcept,
  CHARACTER_CONCEPT_STATUS,
} from '../models/characterConcept.js';
import { Cliche } from '../models/cliche.js';
import { CoreMotivation } from '../models/coreMotivation.js';
import { coreTokens as tokens } from '../../dependencyInjection/tokens/tokens-core.js';
import { ValidationError } from '../../errors/validationError.js';
import { EntityNotFoundError } from '../../errors/entityNotFoundError.js';
import { CacheKeys, CacheInvalidation } from '../cache/cacheHelpers.js';

/* global process */

/**
 * Retry configuration for character builder operations
 * Browser-safe: Defaults to production values when process is undefined
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs:
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' ? 1 : 1000,
  maxDelayMs:
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' ? 5 : 5000,
  directionBaseDelayMs:
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' ? 2 : 2000,
  directionMaxDelayMs:
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'test' ? 10 : 10000,
};

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher
 * @typedef {import('./characterStorageService.js').CharacterStorageService} CharacterStorageService
 * @typedef {import('./thematicDirectionGenerator.js').ThematicDirectionGenerator} ThematicDirectionGenerator
 * @typedef {import('./TraitsGenerator.js').TraitsGenerator} TraitsGenerator
 * @typedef {import('../models/characterConcept.js').CharacterConcept} CharacterConcept
 * @typedef {import('../models/thematicDirection.js').ThematicDirection} ThematicDirection
 * @typedef {import('../storage/characterDatabase.js').CharacterDatabase} CharacterDatabase
 * @typedef {import('../models/cliche.js').Cliche} Cliche
 */

// Import from dedicated events file
import { CHARACTER_BUILDER_EVENTS } from '../events/characterBuilderEvents.js';

// Re-export for backward compatibility
export { CHARACTER_BUILDER_EVENTS };

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
  #database;
  #schemaValidator;
  #clicheGenerator;
  #traitsGenerator;
  #container;
  #cacheManager;
  #circuitBreakers = new Map(); // For circuit breaker pattern
  #clicheCache = new Map(); // Cache for clichés with TTL
  #clicheCacheTTL = 300000; // 5 minutes TTL
  #motivationCache = new Map(); // Cache for core motivations with TTL
  #motivationCacheTTL = 600000; // 10 minutes TTL

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {CharacterStorageService} dependencies.storageService - Storage service
   * @param {ThematicDirectionGenerator} dependencies.directionGenerator - Direction generator
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event dispatcher
   * @param {CharacterDatabase} [dependencies.database] - Database instance
   * @param {object} [dependencies.schemaValidator] - Schema validator
   * @param {object} [dependencies.clicheGenerator] - Cliché generator (CLIGEN-003)
   * @param {TraitsGenerator} [dependencies.traitsGenerator] - Traits generator service
   * @param {object} [dependencies.container] - DI container for resolving dependencies
   * @param {import('../cache/CoreMotivationsCacheManager.js').default} [dependencies.cacheManager] - Cache manager for Core Motivations
   * @param {Iterable<[string, any]>|Map<string, any>} [dependencies.initialClicheCache] - Preloaded cliché cache entries
   * @param {Iterable<[string, any]>|Map<string, any>} [dependencies.initialMotivationCache] - Preloaded motivation cache entries
   */
  constructor({
    logger,
    storageService,
    directionGenerator,
    eventBus,
    database = null,
    schemaValidator = null,
    clicheGenerator = null,
    traitsGenerator = null,
    container = null,
    cacheManager = null,
    initialClicheCache = null,
    initialMotivationCache = null,
  }) {
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
    this.#database = database;
    this.#schemaValidator = schemaValidator;
    this.#clicheGenerator = clicheGenerator;
    this.#traitsGenerator = traitsGenerator;
    this.#container = container;
    this.#cacheManager = cacheManager;

    this.#seedCache(this.#clicheCache, initialClicheCache);
    this.#seedCache(this.#motivationCache, initialMotivationCache);

    // Initialize cache with existing Maps as fallback
    if (this.#cacheManager) {
      this.#enhanceCacheIntegration();
      // Note: CACHE_INITIALIZED event is already dispatched by the cache manager itself
    }
  }

  /**
   * Seed cache entries when migrating to the enhanced cache manager
   *
   * @param {Map<string, any>} targetCache - Cache instance to seed
   * @param {Iterable<[string, any]>|Map<string, any>|null} initialData - Initial cache entries
   * @private
   */
  #seedCache(targetCache, initialData) {
    if (!initialData) {
      return;
    }

    const entries =
      initialData instanceof Map
        ? initialData.entries()
        : typeof initialData[Symbol.iterator] === 'function'
        ? initialData
        : null;

    if (!entries) {
      return;
    }

    for (const [key, value] of entries) {
      targetCache.set(key, value);
    }
  }

  /**
   * Helper to integrate new cache with existing cache Maps
   *
   * @private
   */
  #enhanceCacheIntegration() {
    // Migrate existing cache data if present
    if (this.#clicheCache.size > 0) {
      for (const [key, value] of this.#clicheCache.entries()) {
        this.#cacheManager.set(key, value.data, 'cliches');
      }
      this.#clicheCache.clear();
    }

    if (this.#motivationCache.size > 0) {
      for (const [key, value] of this.#motivationCache.entries()) {
        this.#cacheManager.set(key, value.data, 'motivations');
      }
      this.#motivationCache.clear();
    }
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
        // Browser-safe: Defaults to production timeout when process is undefined
        const generationTimeout =
          typeof process !== 'undefined' && process.env?.NODE_ENV === 'test'
            ? 5000
            : 60000; // 5 seconds for tests, 60 seconds otherwise
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
        await this.#storageService.storeCharacterConcept(updatedConcept);

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
   * Get all thematic directions
   *
   * @returns {Promise<Array<ThematicDirection>>}
   * @throws {CharacterBuilderError} If retrieval fails
   */
  async getAllThematicDirections() {
    try {
      const allDirections =
        await this.#storageService.getAllThematicDirections();
      this.#logger.debug(
        `CharacterBuilderService: Retrieved ${allDirections.length} thematic directions`
      );
      return allDirections;
    } catch (error) {
      const message = `Failed to get all thematic directions: ${error.message}`;
      this.#logger.error(message, error);
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
      // Get the current direction to compare old values
      const currentDirection =
        await this.#storageService.getThematicDirection(directionId);

      if (!currentDirection) {
        throw new CharacterBuilderError(
          `Thematic direction not found: ${directionId}`
        );
      }

      const updatedDirection =
        await this.#storageService.updateThematicDirection(
          directionId,
          updates
        );

      // Dispatch individual events for each changed field
      for (const [field, newValue] of Object.entries(updates)) {
        const oldValue = currentDirection[field];
        // Only dispatch if the value actually changed
        if (oldValue !== newValue) {
          this.#eventBus.dispatch(CHARACTER_BUILDER_EVENTS.DIRECTION_UPDATED, {
            directionId,
            field,
            oldValue: oldValue || '',
            newValue: newValue || '',
          });
        }
      }

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

  // ============= Cliché Operations =============

  /**
   * Get clichés for a thematic direction
   *
   * @param {string} directionId - Thematic direction ID
   * @returns {Promise<Cliche|null>} Cliche data or null if not found
   */
  async getClichesByDirectionId(directionId) {
    assertNonBlankString(
      directionId,
      'directionId',
      'getClichesByDirectionId',
      this.#logger
    );

    try {
      // Check cache first
      const cached = this.#getCachedCliches(directionId);
      if (cached) {
        this.#logger.debug(`Cache hit for clichés: ${directionId}`);
        return cached;
      }

      // Query database if available
      if (!this.#database) {
        this.#logger.warn('Database not available for cliché operations');
        return null;
      }

      const rawData = await this.#database.getClicheByDirectionId(directionId);

      if (!rawData) {
        this.#logger.info(`No clichés found for direction: ${directionId}`);
        return null;
      }

      // Create model instance
      const cliche = Cliche.fromRawData(rawData);

      // Cache the result
      this.#cacheCliches(directionId, cliche);

      // Dispatch event with conceptId included
      this.#eventBus.dispatch(CHARACTER_BUILDER_EVENTS.CLICHES_RETRIEVED, {
        conceptId: cliche.conceptId, // FIX: Include conceptId from the cliche object
        directionId,
        clicheId: cliche.id,
        categoryStats: cliche.getCategoryStats(),
      });

      return cliche;
    } catch (error) {
      this.#logger.error(
        `Failed to get clichés for direction ${directionId}:`,
        error
      );

      this.#eventBus.dispatch(
        CHARACTER_BUILDER_EVENTS.CLICHES_RETRIEVAL_FAILED,
        {
          directionId,
          error: error.message,
        }
      );

      throw new CharacterBuilderError(
        `Failed to retrieve clichés: ${error.message}`,
        error
      );
    }
  }

  /**
   * Check if clichés exist for a direction
   *
   * @param {string} directionId - Thematic direction ID
   * @returns {Promise<boolean>} True if clichés exist
   */
  async hasClichesForDirection(directionId) {
    assertNonBlankString(
      directionId,
      'directionId',
      'hasClichesForDirection',
      this.#logger
    );

    this.#logger.debug(
      `DEBUG: hasClichesForDirection called with directionId: ${directionId}`
    );

    try {
      // Check cache first
      const hasCachedData = this.#clicheCache.has(directionId);
      this.#logger.debug(
        `DEBUG: Cache check for ${directionId}: ${hasCachedData ? 'HIT' : 'MISS'}`
      );

      if (hasCachedData) {
        const cached = this.#getCachedCliches(directionId);
        const result = cached !== null;
        this.#logger.debug(
          `DEBUG: Cache result for ${directionId}: ${result} (cached data exists: ${cached ? 'yes' : 'no'})`
        );
        return result;
      }

      // Database availability check
      const dbAvailable = !!this.#database;
      this.#logger.debug(
        `DEBUG: Database availability check: ${dbAvailable ? 'AVAILABLE' : 'NOT_AVAILABLE'}`
      );

      if (!this.#database) {
        this.#logger.warn(
          `DEBUG: Database not available for hasClichesForDirection(${directionId}), returning false`
        );
        return false;
      }

      // Quick existence check
      this.#logger.debug(
        `DEBUG: Calling database.getClicheByDirectionId(${directionId})`
      );
      const cliche = await this.#database.getClicheByDirectionId(directionId);

      const result = cliche !== null;
      this.#logger.debug(
        `DEBUG: Database query result for ${directionId}: ${result} (cliche object: ${cliche ? JSON.stringify(cliche) : 'null'})`
      );

      return result;
    } catch (error) {
      this.#logger.error(
        `DEBUG: ERROR in hasClichesForDirection for ${directionId}:`,
        error
      );
      this.#logger.error(
        `DEBUG: Error details - message: ${error.message}, stack: ${error.stack}`
      );
      return false;
    }
  }

  /**
   * Store clichés for a direction
   *
   * @param {Cliche|object} cliches - Cliche data to store
   * @returns {Promise<Cliche>} Stored cliche data
   */
  async storeCliches(cliches) {
    assertPresent(
      cliches,
      'Clichés data is required',
      CharacterBuilderError,
      this.#logger
    );

    try {
      // Convert to Cliche instance if needed
      const clicheInstance =
        cliches instanceof Cliche ? cliches : new Cliche(cliches);

      // Validate against schema if validator available
      if (this.#schemaValidator) {
        await this.#validateCliches(clicheInstance);
      }

      // Check for existing clichés (enforce one-to-one)
      const existing = await this.hasClichesForDirection(
        clicheInstance.directionId
      );
      if (existing) {
        throw new CharacterBuilderError(
          `Clichés already exist for direction ${clicheInstance.directionId}`
        );
      }

      // Store clichés using database if available
      if (!this.#database) {
        throw new CharacterBuilderError(
          'Database not available for cliché storage'
        );
      }

      await this.#database.saveCliche(clicheInstance.toJSON());

      // Store metadata
      await this.#database.addMetadata({
        key: `last_cliche_generation`,
        value: {
          directionId: clicheInstance.directionId,
          timestamp: new Date().toISOString(),
          count: clicheInstance.getTotalCount(),
        },
      });

      // Clear cache for this direction
      this.#invalidateClicheCache(clicheInstance.directionId);

      // Cache the new data
      this.#cacheCliches(clicheInstance.directionId, clicheInstance);

      // Dispatch success event
      this.#eventBus.dispatch(CHARACTER_BUILDER_EVENTS.CLICHES_STORED, {
        directionId: clicheInstance.directionId,
        conceptId: clicheInstance.conceptId,
        clicheId: clicheInstance.id,
        totalCount: clicheInstance.getTotalCount(),
      });

      this.#logger.info(
        `Stored clichés for direction ${clicheInstance.directionId}`
      );

      return clicheInstance;
    } catch (error) {
      this.#logger.error('Failed to store clichés:', error);

      this.#eventBus.dispatch(CHARACTER_BUILDER_EVENTS.CLICHES_STORAGE_FAILED, {
        conceptId: cliches.conceptId || 'unknown', // Required field
        directionId: cliches.directionId || 'unknown', // Required field
        error: error.message, // Required field
      });

      throw error instanceof CharacterBuilderError
        ? error
        : new CharacterBuilderError(
            `Failed to store clichés: ${error.message}`,
            error
          );
    }
  }

  /**
   * Generate clichés for a thematic direction
   *
   * @param {CharacterConcept} concept - Original character concept
   * @param {ThematicDirection} direction - Selected thematic direction
   * @returns {Promise<Cliche>} Generated and stored clichés
   */
  async generateClichesForDirection(concept, direction) {
    assertPresent(
      concept,
      'Character concept is required',
      CharacterBuilderError,
      this.#logger
    );
    assertPresent(
      direction,
      'Thematic direction is required',
      CharacterBuilderError,
      this.#logger
    );

    try {
      // Check if clichés already exist
      const existing = await this.getClichesByDirectionId(direction.id);
      if (existing) {
        this.#logger.info(
          `Clichés already exist for direction ${direction.id}`
        );
        return existing;
      }

      // Validate concept and direction relationship
      if (direction.conceptId !== concept.id) {
        throw new CharacterBuilderError(
          'Direction does not belong to the provided concept'
        );
      }

      // Dispatch generation started event
      this.#eventBus.dispatch(
        CHARACTER_BUILDER_EVENTS.CLICHES_GENERATION_STARTED,
        {
          conceptId: concept.id,
          directionId: direction.id,
          directionTitle: direction.title,
        }
      );

      // Generate clichés using ClicheGenerator (implemented in CLIGEN-003)
      if (!this.#clicheGenerator) {
        throw new CharacterBuilderError(
          'ClicheGenerator not available - CLIGEN-003 not implemented'
        );
      }

      const generatedData = await this.#clicheGenerator.generateCliches(
        concept.id,
        concept.text || concept.concept,
        direction
      );

      // Create Cliche instance
      const cliche = new Cliche({
        directionId: direction.id,
        conceptId: concept.id,
        categories: generatedData.categories,
        tropesAndStereotypes: generatedData.tropesAndStereotypes,
        llmMetadata: generatedData.metadata,
      });

      // Store the generated clichés
      const stored = await this.storeCliches(cliche);

      // Dispatch generation completed event
      this.#eventBus.dispatch(
        CHARACTER_BUILDER_EVENTS.CLICHES_GENERATION_COMPLETED,
        {
          conceptId: concept.id,
          directionId: direction.id,
          clicheId: stored.id,
          totalCount: stored.getTotalCount(),
          generationTime: generatedData.metadata?.responseTime || 0,
        }
      );

      return stored;
    } catch (error) {
      this.#logger.error(
        `Failed to generate clichés for direction ${direction.id}:`,
        error
      );

      this.#eventBus.dispatch(
        CHARACTER_BUILDER_EVENTS.CLICHES_GENERATION_FAILED,
        {
          conceptId: concept.id,
          directionId: direction.id,
          error: error.message,
        }
      );

      throw error instanceof CharacterBuilderError
        ? error
        : new CharacterBuilderError(
            `Failed to generate clichés: ${error.message}`,
            error
          );
    }
  }

  // ============= Batch Operations =============

  /**
   * Get clichés for multiple directions
   *
   * @param {string[]} directionIds - Array of direction IDs
   * @returns {Promise<Map<string, Cliche>>} Map of directionId to Cliche
   */
  async getClichesForDirections(directionIds) {
    assertPresent(
      directionIds,
      'Direction IDs are required',
      CharacterBuilderError,
      this.#logger
    );

    const results = new Map();
    const uncached = [];

    // Check cache first
    for (const id of directionIds) {
      const cached = this.#getCachedCliches(id);
      if (cached) {
        results.set(id, cached);
      } else {
        uncached.push(id);
      }
    }

    // Batch fetch uncached
    if (uncached.length > 0 && this.#database) {
      try {
        // Fetch individually since no batch method exists
        for (const directionId of uncached) {
          const rawData =
            await this.#database.getClicheByDirectionId(directionId);
          if (rawData) {
            const cliche = Cliche.fromRawData(rawData);
            results.set(cliche.directionId, cliche);
            this.#cacheCliches(cliche.directionId, cliche);
          }
        }
      } catch (error) {
        this.#logger.error('Batch fetch failed:', error);
      }
    }

    return results;
  }

  /**
   * Delete clichés for a direction
   *
   * @param {string} directionId - Direction ID
   * @returns {Promise<boolean>} True if deleted
   */
  async deleteClichesForDirection(directionId) {
    assertNonBlankString(
      directionId,
      'directionId',
      'deleteClichesForDirection',
      this.#logger
    );

    try {
      const cliche = await this.getClichesByDirectionId(directionId);

      if (!cliche) {
        return false;
      }

      if (!this.#database) {
        throw new CharacterBuilderError(
          'Database not available for cliché deletion'
        );
      }

      // Delete the cliché
      await this.#database.deleteCliche(cliche.id);

      this.#invalidateClicheCache(directionId);

      this.#eventBus.dispatch(CHARACTER_BUILDER_EVENTS.CLICHES_DELETED, {
        directionId,
        clicheId: cliche.id,
      });

      return true;
    } catch (error) {
      this.#logger.error(`Failed to delete clichés for ${directionId}:`, error);
      throw error instanceof CharacterBuilderError
        ? error
        : new CharacterBuilderError(
            `Failed to delete clichés: ${error.message}`,
            error
          );
    }
  }

  /**
   * Remove a specific item from a cliché category
   *
   * @param {string} directionId - Direction ID
   * @param {string} categoryId - Category ID (e.g., 'names', 'physicalDescriptions')
   * @param {string} itemText - The exact text of the item to remove
   * @returns {Promise<Cliche>} Updated cliché instance
   */
  async removeClicheItem(directionId, categoryId, itemText) {
    assertNonBlankString(
      directionId,
      'directionId',
      'removeClicheItem',
      this.#logger
    );
    assertNonBlankString(
      categoryId,
      'categoryId',
      'removeClicheItem',
      this.#logger
    );
    assertNonBlankString(
      itemText,
      'itemText',
      'removeClicheItem',
      this.#logger
    );

    try {
      // Get existing clichés
      const existingCliche = await this.getClichesByDirectionId(directionId);
      if (!existingCliche) {
        throw new CharacterBuilderError(
          `No clichés found for direction: ${directionId}`
        );
      }

      // Create new cliché with item removed
      const updatedCliche = existingCliche.createWithItemRemoved(
        categoryId,
        itemText
      );

      // Update in database
      await this.#updateCliche(updatedCliche);

      // Invalidate cache and update with new data
      this.#invalidateClicheCache(directionId);
      this.#cacheCliches(directionId, updatedCliche);

      // Dispatch event
      this.#eventBus.dispatch(CHARACTER_BUILDER_EVENTS.CLICHE_ITEM_DELETED, {
        conceptId: updatedCliche.conceptId,
        directionId: updatedCliche.directionId,
        categoryId,
        itemText,
        remainingCount: updatedCliche.getTotalCount(),
      });

      this.#logger.info(
        `Removed item from cliché category ${categoryId} for direction ${directionId}`
      );

      return updatedCliche;
    } catch (error) {
      this.#logger.error(
        `Failed to remove cliché item for ${directionId}:`,
        error
      );
      throw error instanceof CharacterBuilderError
        ? error
        : new CharacterBuilderError(
            `Failed to remove cliché item: ${error.message}`,
            error
          );
    }
  }

  /**
   * Remove a specific trope from clichés
   *
   * @param {string} directionId - Direction ID
   * @param {string} tropeText - The exact text of the trope to remove
   * @returns {Promise<Cliche>} Updated cliché instance
   */
  async removeClicheTrope(directionId, tropeText) {
    assertNonBlankString(
      directionId,
      'directionId',
      'removeClicheTrope',
      this.#logger
    );
    assertNonBlankString(
      tropeText,
      'tropeText',
      'removeClicheTrope',
      this.#logger
    );

    try {
      // Get existing clichés
      const existingCliche = await this.getClichesByDirectionId(directionId);
      if (!existingCliche) {
        throw new CharacterBuilderError(
          `No clichés found for direction: ${directionId}`
        );
      }

      // Create new cliché with trope removed
      const updatedCliche = existingCliche.createWithTropeRemoved(tropeText);

      // Update in database
      await this.#updateCliche(updatedCliche);

      // Invalidate cache and update with new data
      this.#invalidateClicheCache(directionId);
      this.#cacheCliches(directionId, updatedCliche);

      // Dispatch event
      this.#eventBus.dispatch(CHARACTER_BUILDER_EVENTS.CLICHE_TROPE_DELETED, {
        conceptId: updatedCliche.conceptId,
        directionId: updatedCliche.directionId,
        tropeText,
        remainingCount: updatedCliche.getTotalCount(),
      });

      this.#logger.info(
        `Removed trope from clichés for direction ${directionId}`
      );

      return updatedCliche;
    } catch (error) {
      this.#logger.error(
        `Failed to remove cliché trope for ${directionId}:`,
        error
      );
      throw error instanceof CharacterBuilderError
        ? error
        : new CharacterBuilderError(
            `Failed to remove cliché trope: ${error.message}`,
            error
          );
    }
  }

  /**
   * Update cliché in database
   *
   * @param {Cliche} cliche - The updated cliché instance
   * @returns {Promise<void>}
   * @private
   */
  async #updateCliche(cliche) {
    if (!this.#database) {
      throw new CharacterBuilderError(
        'Database not available for cliché update'
      );
    }

    await this.#database.updateCliche(cliche.id, cliche.toJSON());
  }

  // ============= Core Motivations Operations =============

  /**
   * Generate new core motivations for a direction
   *
   * @param {string} conceptId - Character concept ID
   * @param {string} directionId - Thematic direction ID
   * @param {Array} cliches - Associated clichés for context
   * @returns {Promise<Array>} Generated motivation objects
   */
  async generateCoreMotivationsForDirection(conceptId, directionId, cliches) {
    assertNonBlankString(conceptId, 'Concept ID is required');
    assertNonBlankString(directionId, 'Direction ID is required');
    assertPresent(cliches, 'Clichés are required for generation');

    try {
      this.#logger.info(
        `Generating core motivations for direction ${directionId}`
      );

      // Get the concept
      const concept = await this.getCharacterConcept(conceptId);
      if (!concept) {
        throw new EntityNotFoundError(`Concept ${conceptId} not found`);
      }

      // Get the direction
      const direction =
        await this.#storageService.getThematicDirection(directionId);
      if (!direction) {
        throw new EntityNotFoundError(`Direction ${directionId} not found`);
      }

      // Verify direction belongs to concept
      if (direction.conceptId !== conceptId) {
        throw new ValidationError(
          'Direction does not belong to the specified concept'
        );
      }

      // Verify clichés exist
      if (!Array.isArray(cliches) || cliches.length === 0) {
        throw new ValidationError(
          'Cannot generate motivations without clichés context'
        );
      }

      // Dispatch generation started event
      this.#eventBus.dispatch(
        CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_GENERATION_STARTED,
        {
          conceptId,
          directionId,
          directionTitle: direction.title,
          timestamp: new Date().toISOString(),
        }
      );

      const startTime = Date.now();

      try {
        // Call the Core Motivations Generator service
        const generator = this.#container.resolve(
          tokens.ICoreMotivationsGenerator
        );
        const generatedMotivations = await generator.generate({
          concept,
          direction,
          cliches,
        });

        // Create CoreMotivation instances
        const motivations = generatedMotivations.map((rawMotivation) =>
          CoreMotivation.fromRawData({
            directionId,
            conceptId,
            ...rawMotivation,
            llmMetadata: {
              model: generator.getLastModelUsed(),
              temperature: 0.8,
              generationTime: Date.now() - startTime,
            },
          })
        );

        // Validate all motivations
        for (const motivation of motivations) {
          const validation = motivation.validate();
          if (!validation.valid) {
            this.#logger.warn(
              `Motivation validation issues: ${validation.errors.join(', ')}`
            );
          }
        }

        this.#logger.info(`Generated ${motivations.length} core motivations`);

        return motivations;
      } catch (error) {
        // Dispatch generation failed event
        this.#eventBus.dispatch(
          CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_GENERATION_FAILED,
          {
            conceptId,
            directionId,
            error: error.message,
            errorCode: error.code || 'GENERATION_ERROR',
          }
        );

        throw error;
      }
    } catch (error) {
      this.#logger.error('Failed to generate core motivations:', error);
      throw error;
    }
  }

  /**
   * Retrieve all motivations for a direction
   *
   * @param {string} directionId - Direction ID
   * @returns {Promise<Array>} Array of motivation objects
   */
  async getCoreMotivationsByDirectionId(directionId) {
    assertNonBlankString(directionId, 'Direction ID is required');

    const cacheKey = CacheKeys.motivationsForDirection(directionId);

    // Check cache first (new cache manager or fallback to old cache)
    if (this.#cacheManager) {
      try {
        const cached = this.#cacheManager.get(cacheKey);
        if (cached) {
          this.#eventBus.dispatch(
            CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_RETRIEVED,
            { directionId, source: 'cache', count: cached.length }
          );
          return cached;
        }
      } catch (cacheError) {
        // Log cache error but continue with database fallback
        this.#logger.warn(
          `Cache error for key ${cacheKey}: ${cacheError.message}`
        );
      }
    } else {
      // Fallback to old cache system
      const cached = this.#motivationCache?.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.#motivationCacheTTL) {
        this.#logger.info('Returning cached core motivations');
        this.#eventBus.dispatch(
          CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_RETRIEVED,
          {
            directionId,
            source: 'cache',
            count: cached.data.length,
          }
        );
        return cached.data;
      }
    }

    try {
      // Fetch from database
      const motivations =
        await this.#database.getCoreMotivationsByDirectionId(directionId);

      // Handle case where database returns null/undefined
      if (!motivations || !Array.isArray(motivations)) {
        this.#eventBus.dispatch(
          CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_RETRIEVED,
          { directionId, source: 'database', count: 0 }
        );
        return [];
      }

      // Convert to model instances
      const motivationModels = motivations.map((data) =>
        CoreMotivation.fromRawData(data)
      );

      // Cache with appropriate type
      if (this.#cacheManager) {
        try {
          this.#cacheManager.set(cacheKey, motivationModels, 'motivations');
        } catch (cacheError) {
          // Log cache error but don't fail the operation
          this.#logger.warn(
            `Failed to cache motivations for key ${cacheKey}: ${cacheError.message}`
          );
        }
      } else if (this.#motivationCache) {
        // Fallback to old cache system
        this.#motivationCache.set(cacheKey, {
          data: motivationModels,
          timestamp: Date.now(),
        });
      }

      this.#eventBus.dispatch(
        CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_RETRIEVED,
        {
          directionId,
          source: 'database',
          count: motivationModels?.length || 0,
        }
      );

      return motivationModels;
    } catch (error) {
      this.#logger.error(
        `Failed to get core motivations for direction ${directionId}:`,
        error
      );
      throw new CharacterBuilderError(
        `Failed to retrieve core motivations`,
        error
      );
    }
  }

  /**
   * Check if direction has motivations
   *
   * @param {string} directionId - Direction ID
   * @returns {Promise<boolean>} True if motivations exist
   */
  async hasCoreMotivationsForDirection(directionId) {
    assertNonBlankString(directionId, 'Direction ID is required');

    try {
      return await this.#database.hasCoreMotivationsForDirection(directionId);
    } catch (error) {
      this.#logger.error(
        `Failed to check core motivations for direction ${directionId}:`,
        error
      );
      return false;
    }
  }

  /**
   * Save core motivations (accumulative)
   *
   * @param {string} directionId - Direction ID
   * @param {Array} motivations - Array of motivation objects
   * @returns {Promise<Array>} Array of saved motivation IDs
   */
  async saveCoreMotivations(directionId, motivations) {
    assertNonBlankString(directionId, 'Direction ID is required');
    assertPresent(motivations, 'Motivations are required');

    if (!Array.isArray(motivations) || motivations.length === 0) {
      throw new ValidationError('Motivations must be a non-empty array');
    }

    try {
      // Convert to plain objects for storage
      const motivationData = motivations.map((m) => {
        if (m instanceof CoreMotivation) {
          return m.toJSON();
        }
        return m;
      });

      // Ensure all have the correct directionId
      motivationData.forEach((m) => {
        m.directionId = directionId;
      });

      // Save to database
      const savedIds = await this.#database.saveCoreMotivations(motivationData);

      // Invalidate related caches
      if (this.#cacheManager) {
        CacheInvalidation.invalidateMotivations(
          this.#cacheManager,
          directionId,
          motivationData[0]?.conceptId
        );
      } else if (this.#motivationCache) {
        // Fallback to old cache system
        const cacheKey = `motivations_${directionId}`;
        this.#motivationCache.delete(cacheKey);
      }

      // Dispatch completion event
      this.#eventBus.dispatch(
        CHARACTER_BUILDER_EVENTS.CORE_MOTIVATIONS_GENERATION_COMPLETED,
        {
          conceptId: motivationData[0].conceptId,
          directionId,
          motivationIds: savedIds,
          totalCount: await this.#database.getCoreMotivationsCount(directionId),
          generationTime: Date.now(),
        }
      );

      this.#logger.info(`Saved ${savedIds.length} core motivations`);

      return savedIds;
    } catch (error) {
      this.#logger.error('Failed to save core motivations:', error);
      throw error;
    }
  }

  /**
   * Remove individual motivation
   *
   * @param {string} directionId - Direction ID
   * @param {string} motivationId - Motivation ID to remove
   * @returns {Promise<boolean>} Success status
   */
  async removeCoreMotivationItem(directionId, motivationId) {
    assertNonBlankString(directionId, 'Direction ID is required');
    assertNonBlankString(motivationId, 'Motivation ID is required');

    try {
      const success = await this.#database.deleteCoreMotivation(motivationId);

      if (success) {
        // Invalidate related caches
        if (this.#cacheManager) {
          CacheInvalidation.invalidateMotivations(
            this.#cacheManager,
            directionId
          );
        } else if (this.#motivationCache) {
          // Fallback to old cache system
          const cacheKey = `motivations_${directionId}`;
          this.#motivationCache.delete(cacheKey);
        }

        this.#logger.info(`Removed core motivation ${motivationId}`);
      }

      return success;
    } catch (error) {
      this.#logger.error(
        `Failed to remove core motivation ${motivationId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Clear all motivations for a direction
   *
   * @param {string} directionId - Direction ID
   * @returns {Promise<number>} Number of deleted items
   */
  async clearCoreMotivationsForDirection(directionId) {
    assertNonBlankString(directionId, 'Direction ID is required');

    try {
      const deletedCount =
        await this.#database.deleteAllCoreMotivationsForDirection(directionId);

      // Clear cache
      if (this.#motivationCache) {
        const cacheKey = `motivations_${directionId}`;
        this.#motivationCache.delete(cacheKey);
      }

      this.#logger.info(
        `Cleared ${deletedCount} core motivations for direction ${directionId}`
      );

      return deletedCount;
    } catch (error) {
      this.#logger.error(
        `Failed to clear core motivations for direction ${directionId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get all core motivations for a concept
   *
   * @param {string} conceptId - Concept ID
   * @returns {Promise<object>} Map of directionId to motivations array
   */
  async getAllCoreMotivationsForConcept(conceptId) {
    assertNonBlankString(conceptId, 'Concept ID is required');

    try {
      // Get all motivations for the concept
      const allMotivations =
        await this.#database.getCoreMotivationsByConceptId(conceptId);

      // Group by direction
      const motivationsByDirection = {};

      for (const motivation of allMotivations) {
        if (!motivationsByDirection[motivation.directionId]) {
          motivationsByDirection[motivation.directionId] = [];
        }

        motivationsByDirection[motivation.directionId].push(
          CoreMotivation.fromRawData(motivation)
        );
      }

      this.#logger.info(
        `Retrieved motivations for ${Object.keys(motivationsByDirection).length} directions`
      );

      return motivationsByDirection;
    } catch (error) {
      this.#logger.error(
        `Failed to get all core motivations for concept ${conceptId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Export core motivations to text format
   *
   * @param {string} directionId - Direction ID
   * @returns {Promise<string>} Formatted text export
   */
  async exportCoreMotivationsToText(directionId) {
    assertNonBlankString(directionId, 'Direction ID is required');

    try {
      const motivations =
        await this.getCoreMotivationsByDirectionId(directionId);

      if (motivations.length === 0) {
        return 'No core motivations found for this direction.';
      }

      const direction =
        await this.#storageService.getThematicDirection(directionId);

      let text = `Core Motivations for: ${direction?.title || directionId}\n`;
      text += `${'='.repeat(60)}\n\n`;

      motivations.forEach((motivation, index) => {
        text += `Motivation Block ${index + 1}\n`;
        text += `${'-'.repeat(40)}\n`;
        text += `Core Motivation:\n${motivation.coreDesire}\n\n`;
        text += `Contradiction/Conflict:\n${motivation.internalContradiction}\n\n`;
        text += `Central Question:\n${motivation.centralQuestion}\n\n`;
        text += `Created: ${new Date(motivation.createdAt).toLocaleString()}\n`;
        text += `\n`;
      });

      text += `\nTotal Motivations: ${motivations.length}`;
      text += `\nGenerated on: ${new Date().toLocaleString()}`;

      return text;
    } catch (error) {
      this.#logger.error(
        `Failed to export core motivations for direction ${directionId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get statistics about core motivations
   *
   * @param {string} conceptId - Concept ID
   * @returns {Promise<object>} Statistics object
   */
  async getCoreMotivationsStatistics(conceptId) {
    assertNonBlankString(conceptId, 'Concept ID is required');

    try {
      const directions = await this.getThematicDirectionsByConceptId(conceptId);
      const stats = {
        totalDirections: directions.length,
        directionsWithMotivations: 0,
        totalMotivations: 0,
        averageMotivationsPerDirection: 0,
        directionStats: [],
      };

      for (const direction of directions) {
        const count = await this.#database.getCoreMotivationsCount(
          direction.id
        );

        if (count > 0) {
          stats.directionsWithMotivations++;
          stats.totalMotivations += count;

          stats.directionStats.push({
            directionId: direction.id,
            directionTitle: direction.title,
            motivationCount: count,
          });
        }
      }

      if (stats.directionsWithMotivations > 0) {
        stats.averageMotivationsPerDirection =
          stats.totalMotivations / stats.directionsWithMotivations;
      }

      return stats;
    } catch (error) {
      this.#logger.error(
        `Failed to get core motivations statistics for concept ${conceptId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Get thematic directions by concept ID
   *
   * @param {string} conceptId - Concept ID
   * @returns {Promise<Array>} Array of thematic directions
   */
  async getThematicDirectionsByConceptId(conceptId) {
    assertNonBlankString(conceptId, 'Concept ID is required');

    try {
      return await this.#storageService.getThematicDirections(conceptId);
    } catch (error) {
      this.#logger.error(
        `Failed to get thematic directions for concept ${conceptId}:`,
        error
      );
      throw error;
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

  /**
   * Test-only helper to set circuit breaker state
   *
   * @param {string} key - Circuit breaker key
   * @param {{failures: number, lastFailureTime: number}} state - Circuit breaker state
   * @returns {void}
   */
  __setCircuitBreakerStateForTests(key, state) {
    this.#circuitBreakers.set(key, state);
  }

  /**
   * Test-only helper to read circuit breaker state
   *
   * @param {string} key - Circuit breaker key
   * @returns {{failures: number, lastFailureTime: number}} Circuit breaker state snapshot
   */
  __getCircuitBreakerStateForTests(key) {
    return {
      failures: this.#getCircuitBreakerCount(key),
      lastFailureTime: this.#getLastFailureTime(key),
    };
  }

  // ============= Cliché Cache Management =============

  /**
   * Get cached clichés
   *
   * @param {string} directionId - Direction ID
   * @returns {Cliche|null} Cached cliche or null if expired/missing
   * @private
   */
  #getCachedCliches(directionId) {
    const cached = this.#clicheCache.get(directionId);

    if (cached && cached.timestamp + this.#clicheCacheTTL > Date.now()) {
      return cached.data;
    }

    // Remove expired cache
    if (cached) {
      this.#clicheCache.delete(directionId);
    }

    return null;
  }

  /**
   * Cache clichés with TTL
   *
   * @param {string} directionId - Direction ID
   * @param {Cliche} cliche - Cliche data to cache
   * @private
   */
  #cacheCliches(directionId, cliche) {
    this.#clicheCache.set(directionId, {
      data: cliche,
      timestamp: Date.now(),
    });

    // Limit cache size to prevent memory issues
    if (this.#clicheCache.size > 50) {
      const firstKey = this.#clicheCache.keys().next().value;
      this.#clicheCache.delete(firstKey);
    }
  }

  /**
   * Invalidate cache for a direction
   *
   * @param {string} directionId - Direction ID
   * @private
   */
  #invalidateClicheCache(directionId) {
    this.#clicheCache.delete(directionId);
  }

  /**
   * Generate character traits using the TraitsGenerator service
   *
   * @param {object} params - Generation parameters
   * @param {object} params.concept - Character concept object
   * @param {object} params.direction - Thematic direction object
   * @param {object} params.userInputs - User-provided core motivation, contradiction, question
   * @param {Array} params.cliches - Array of cliche objects to avoid
   * @param {object} [options] - Generation options
   * @param {string} [options.llmConfigId] - Specific LLM config to use
   * @param {number} [options.maxRetries] - Maximum retry attempts
   * @returns {Promise<object>} Generated traits data
   * @throws {CharacterBuilderError} If TraitsGenerator is not available or generation fails
   */
  async generateTraits(params, options = {}) {
    if (!this.#traitsGenerator) {
      throw new CharacterBuilderError(
        'TraitsGenerator service not available. Please ensure it is properly injected.'
      );
    }

    try {
      this.#logger.info(
        'CharacterBuilderService: Delegating traits generation',
        {
          conceptId: params.concept?.id,
          directionId: params.direction?.id,
          clichesCount: params.cliches?.length || 0,
        }
      );

      // Delegate to the TraitsGenerator service
      const result = await this.#traitsGenerator.generateTraits(
        params,
        options
      );

      this.#logger.info(
        'CharacterBuilderService: Traits generation completed',
        {
          conceptId: params.concept?.id,
          success: true,
        }
      );

      return result;
    } catch (error) {
      this.#logger.error(
        'CharacterBuilderService: Traits generation failed',
        error
      );

      // Dispatch error event
      this.#eventBus.dispatch({
        type: CHARACTER_BUILDER_EVENTS.ERROR_OCCURRED,
        payload: {
          error: error.message,
          operation: 'generateTraits',
          context: {
            conceptId: params.concept?.id,
            directionId: params.direction?.id,
          },
        },
      });

      throw new CharacterBuilderError(
        `Failed to generate traits: ${error.message}`,
        error
      );
    }
  }

  /**
   * Validate clichés against schema
   *
   * @param {Cliche} cliche - Cliche instance to validate
   * @returns {Promise<void>}
   * @private
   */
  async #validateCliches(cliche) {
    if (this.#schemaValidator) {
      const isValid = this.#schemaValidator.validateAgainstSchema(
        cliche.toJSON(),
        'schema://living-narrative-engine/cliche.schema.json'
      );

      if (!isValid) {
        const errors = this.#schemaValidator.formatAjvErrors();
        throw new CharacterBuilderError(`Invalid cliché data: ${errors}`);
      }
    }
  }

  /**
   * DEBUG METHOD: Dump all database contents for troubleshooting
   *
   * @returns {Promise<void>}
   */
  async debugDumpDatabase() {
    this.#logger.debug('DEBUG: Starting comprehensive database dump...');

    try {
      if (!this.#database) {
        this.#logger.warn('DEBUG: Database not available for debugging');
        return;
      }

      // Dump all concepts
      await this.#database.debugDumpAllCharacterConcepts();

      // Dump all thematic directions
      await this.#database.debugDumpAllThematicDirections();

      // Dump all clichés
      await this.#database.debugDumpAllCliches();

      this.#logger.debug('DEBUG: Database dump completed');
    } catch (error) {
      this.#logger.error('DEBUG: Error during database dump:', error);
    }
  }
}
