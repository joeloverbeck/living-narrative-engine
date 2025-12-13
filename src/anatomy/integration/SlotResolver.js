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
   * @param {AnatomyClothingCache} [params.cache] - Cache service
   * @param {object} [params.cacheCoordinator] - Optional cache coordinator
   */
  constructor({
    logger,
    strategies,
    entityManager,
    bodyGraphService,
    anatomyBlueprintRepository,
    anatomySocketIndex,
    cache,
    cacheCoordinator,
  }) {
    this.#logger = ensureValidLogger(logger, this.constructor.name);
    this.#cache = cache || new Map();

    // Register cache with coordinator if both are provided and cache is a Map
    if (cacheCoordinator && this.#cache instanceof Map) {
      cacheCoordinator.registerCache('slotResolver', this.#cache);
      this.#logger.debug('Registered SlotResolver cache with coordinator');
    }

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
      this.#strategies = [
        clothingSlotMappingStrategy,
        blueprintStrategy,
        directSocketStrategy,
      ];
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
   * @param {Map<string, string>} [slotEntityMappings] - Optional slot-to-entity mappings for this character
   * @returns {Promise<ResolvedAttachmentPoint[]>} Array of resolved attachment points
   */
  async resolve(entityId, slotId, mapping, slotEntityMappings) {
    assertPresent(entityId, 'Entity ID is required');
    assertPresent(slotId, 'Slot ID is required');
    assertPresent(mapping, 'Mapping is required');

    // Check cache
    const cacheKey = AnatomyClothingCache.createSlotResolutionKey(
      entityId,
      slotId
    );
    const supportsCacheServiceInterface =
      this.#cache &&
      typeof this.#cache.get === 'function' &&
      this.#cache.get.length >= 2;

    if (supportsCacheServiceInterface) {
      // Using new cache service
      const cached = this.#cache.get(CacheKeyTypes.SLOT_RESOLUTION, cacheKey);
      if (cached) {
        this.#logger.debug(`Cache hit for slot resolution: ${cacheKey}`);
        return cached;
      }
    } else if (
      this.#cache &&
      typeof this.#cache.has === 'function' &&
      typeof this.#cache.get === 'function' &&
      this.#cache.has(cacheKey)
    ) {
      // Fallback to Map cache
      this.#logger.debug(`Cache hit for slot resolution: ${cacheKey}`);
      return this.#cache.get(cacheKey);
    }

    // Find the first strategy that can handle this mapping
    this.#logger.debug(
      `SlotResolver: Attempting to resolve slot '${slotId}' for entity '${entityId}' with mapping: ${JSON.stringify(mapping)}`
    );

    const strategy = this.#strategies.find((s) => s.canResolve(mapping));

    if (!strategy) {
      this.#logger.warn(
        `SlotResolver: No strategy found for mapping type in slot '${slotId}'. Available strategies: ${this.#strategies.length}`
      );
      return [];
    }

    this.#logger.debug(
      `SlotResolver: Using strategy '${strategy.constructor.name}' for slot '${slotId}'`
    );

    try {
      // Resolve using the selected strategy
      const attachmentPoints = await strategy.resolve(
        entityId,
        mapping,
        slotEntityMappings
      );

      // Cache the result
      if (
        supportsCacheServiceInterface &&
        typeof this.#cache.set === 'function'
      ) {
        // Using new cache service
        this.#cache.set(
          CacheKeyTypes.SLOT_RESOLUTION,
          cacheKey,
          attachmentPoints
        );
      } else if (typeof this.#cache.set === 'function') {
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
   * Propagates slot-to-entity mapping overrides to strategies that support it
   *
   * @param {Map<string, string>|object} slotEntityMappings
   */
  setSlotEntityMappings(slotEntityMappings) {
    this.#strategies
      .filter(
        (strategy) => typeof strategy.setSlotEntityMappings === 'function'
      )
      .forEach((strategy) =>
        strategy.setSlotEntityMappings(slotEntityMappings)
      );
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
   * @param {Map<string, string>} [slotEntityMappings] - Optional slot-to-entity mappings for this character
   * @returns {Promise<ResolvedAttachmentPoint[]>} Array of resolved attachment points
   * @throws {ClothingSlotNotFoundError} If clothing slot not found in blueprint
   * @throws {InvalidClothingSlotMappingError} If mapping structure is invalid
   */
  async resolveClothingSlot(entityId, slotId, slotEntityMappings) {
    assertPresent(entityId, 'Entity ID is required');
    assertPresent(slotId, 'Slot ID is required');

    // Create clothing slot mapping with the provided slotId
    const mapping = { clothingSlotId: slotId };

    // Find the ClothingSlotMappingStrategy
    const strategy = this.#strategies.find((s) => s.canResolve(mapping));

    if (!strategy) {
      throw new ClothingSlotNotFoundError(
        `Clothing slot '${slotId}' not found in blueprint clothing slot mappings`,
        slotId,
        'unknown'
      );
    }

    // Resolve using the strategy - let errors propagate
    return await strategy.resolve(entityId, mapping, slotEntityMappings);
  }
}

export default SlotResolver;
