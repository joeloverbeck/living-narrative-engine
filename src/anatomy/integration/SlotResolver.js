/**
 * @file Orchestrator for clothing slot resolution strategies
 * @see src/interfaces/ISlotResolutionStrategy.js
 * @see src/anatomy/integration/strategies/BlueprintSlotStrategy.js
 * @see src/anatomy/integration/strategies/DirectSocketStrategy.js
 */

import {
  validateDependency,
  assertPresent,
} from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import BlueprintSlotStrategy from './strategies/BlueprintSlotStrategy.js';
import DirectSocketStrategy from './strategies/DirectSocketStrategy.js';
import ClothingSlotMappingStrategy from './strategies/ClothingSlotMappingStrategy.js';
import {
  AnatomyClothingCache,
  CacheKeyTypes,
} from '../cache/AnatomyClothingCache.js';
import { ClothingSlotNotFoundError } from '../../errors/clothingSlotErrors.js';

/** @typedef {import('../../interfaces/ISlotResolutionStrategy.js')} ISlotResolutionStrategy */
/** @typedef {import('../cache/AnatomyClothingCache.js').AnatomyClothingCache} AnatomyClothingCache */

/**
 * Orchestrates different slot resolution strategies
 * Follows Strategy Pattern to enable extensible slot resolution
 */
class SlotResolver {
  #logger;
  #strategies;
  #cache;

  /**
   * @param {object} params
   * @param {object} params.logger - Logger instance
   * @param {ISlotResolutionStrategy[]} [params.strategies] - Optional custom strategies
   * @param {object} params.entityManager - Entity manager for data access
   * @param {object} params.bodyGraphService - Body graph service
   * @param {object} params.anatomyBlueprintRepository - Blueprint repository
   * @param {object} params.anatomySocketIndex - Socket index service
   * @param {Map} [params.slotEntityMappings] - Optional slot-to-entity mappings
   * @param {AnatomyClothingCache} [params.cache] - Cache service
   */
  constructor({
    logger,
    strategies,
    entityManager,
    bodyGraphService,
    anatomyBlueprintRepository,
    anatomySocketIndex,
    slotEntityMappings,
    cache,
  }) {
    this.#logger = ensureValidLogger(logger, this.constructor.name);
    this.#cache = cache || new Map();

    // Initialize default strategies if none provided
    if (strategies) {
      this.#strategies = strategies;
    } else {
      // Create default strategies
      const blueprintStrategy = new BlueprintSlotStrategy({
        logger,
        entityManager,
        bodyGraphService,
        anatomyBlueprintRepository,
        anatomySocketIndex,
        slotEntityMappings,
      });

      const directSocketStrategy = new DirectSocketStrategy({
        logger,
        entityManager,
        bodyGraphService,
      });

      const clothingSlotMappingStrategy = new ClothingSlotMappingStrategy({
        logger,
        entityManager,
        anatomyBlueprintRepository,
        blueprintSlotStrategy: blueprintStrategy,
        directSocketStrategy,
      });

      // ClothingSlotMappingStrategy has highest priority (first in array)
      this.#strategies = [clothingSlotMappingStrategy, blueprintStrategy, directSocketStrategy];
    }

    // Validate all strategies implement the interface
    this.#strategies.forEach((strategy, index) => {
      validateDependency(strategy, 'ISlotResolutionStrategy', null, {
        requiredMethods: ['canResolve', 'resolve'],
      });
    });

    this.#logger.debug(
      `SlotResolver initialized with ${this.#strategies.length} strategies`
    );
  }

  /**
   * Resolves a clothing slot mapping to attachment points
   *
   * @param {string} entityId - Entity to resolve for
   * @param {string} slotId - Slot identifier for caching
   * @param {object} mapping - The clothing slot mapping configuration
   * @returns {Promise<ResolvedAttachmentPoint[]>} Array of resolved attachment points
   */
  async resolve(entityId, slotId, mapping) {
    assertPresent(entityId, 'Entity ID is required');
    assertPresent(slotId, 'Slot ID is required');
    assertPresent(mapping, 'Mapping is required');

    // Check cache
    const cacheKey = AnatomyClothingCache.createSlotResolutionKey(
      entityId,
      slotId
    );
    if (this.#cache.get) {
      // Using new cache service
      const cached = this.#cache.get(CacheKeyTypes.SLOT_RESOLUTION, cacheKey);
      if (cached) {
        this.#logger.debug(`Cache hit for slot resolution: ${cacheKey}`);
        return cached;
      }
    } else if (this.#cache.has(cacheKey)) {
      // Fallback to Map cache
      this.#logger.debug(`Cache hit for slot resolution: ${cacheKey}`);
      return this.#cache.get(cacheKey);
    }

    // Find the first strategy that can handle this mapping
    const strategy = this.#strategies.find((s) => s.canResolve(mapping));

    if (!strategy) {
      this.#logger.warn(
        `No strategy found for mapping type in slot '${slotId}'`
      );
      return [];
    }

    try {
      // Resolve using the selected strategy
      const attachmentPoints = await strategy.resolve(entityId, mapping);

      // Cache the result
      if (this.#cache.set && this.#cache.get) {
        // Using new cache service
        this.#cache.set(
          CacheKeyTypes.SLOT_RESOLUTION,
          cacheKey,
          attachmentPoints
        );
      } else {
        // Fallback to Map cache
        this.#cache.set(cacheKey, attachmentPoints);
      }

      this.#logger.debug(
        `Resolved slot '${slotId}' to ${attachmentPoints.length} attachment points using ${strategy.constructor.name}`
      );

      return attachmentPoints;
    } catch (err) {
      this.#logger.error(
        `Failed to resolve slot '${slotId}' for entity '${entityId}'`,
        err
      );
      throw err;
    }
  }

  /**
   * Adds a custom strategy to the resolver
   *
   * @param {ISlotResolutionStrategy} strategy - Strategy to add
   */
  addStrategy(strategy) {
    validateDependency(strategy, 'ISlotResolutionStrategy', null, {
      requiredMethods: ['canResolve', 'resolve'],
    });

    this.#strategies.push(strategy);
    this.#logger.debug(`Added new strategy: ${strategy.constructor.name}`);
  }

  /**
   * Clears the resolution cache
   */
  clearCache() {
    if (this.#cache.clearType) {
      // Using new cache service
      this.#cache.clearType(CacheKeyTypes.SLOT_RESOLUTION);
    } else {
      // Fallback to Map cache
      this.#cache.clear();
    }
    this.#logger.debug('Slot resolution cache cleared');
  }

  /**
   * Updates slot-to-entity mappings for blueprint strategy
   *
   * @param {Map<string, string>} mappings - Map of slot IDs to entity IDs
   */
  setSlotEntityMappings(mappings) {
    // Find blueprint strategy and update its mappings
    const blueprintStrategy = this.#strategies.find(
      (s) => s.constructor.name === 'BlueprintSlotStrategy'
    );

    if (
      blueprintStrategy &&
      typeof blueprintStrategy.setSlotEntityMappings === 'function'
    ) {
      blueprintStrategy.setSlotEntityMappings(mappings);
    }
  }

  /**
   * Gets the number of registered strategies
   *
   * @returns {number} Strategy count
   */
  getStrategyCount() {
    return this.#strategies.length;
  }

  /**
   * Resolves a clothing slot to attachment points for a given entity
   * Uses strict validation - clothing slots must exist in blueprint clothingSlotMappings
   *
   * @param {string} entityId - Entity to resolve for
   * @param {string} slotId - Clothing slot identifier to resolve
   * @returns {Promise<ResolvedAttachmentPoint[]>} Array of resolved attachment points
   * @throws {ClothingSlotNotFoundError} If clothing slot not found in blueprint
   * @throws {InvalidClothingSlotMappingError} If mapping structure is invalid
   */
  async resolveClothingSlot(entityId, slotId) {
    assertPresent(entityId, 'Entity ID is required');
    assertPresent(slotId, 'Slot ID is required');

    // Create clothing slot mapping with the provided slotId
    const mapping = { clothingSlotId: slotId };

    // Find the ClothingSlotMappingStrategy
    const strategy = this.#strategies.find(s => s.canResolve(mapping));

    if (!strategy) {
      throw new ClothingSlotNotFoundError(
        `Clothing slot '${slotId}' not found in blueprint clothing slot mappings`,
        slotId,
        'unknown'
      );
    }

    // Resolve using the strategy - let errors propagate
    return await strategy.resolve(entityId, mapping);
  }
}

export default SlotResolver;
