/**
 * @file Central registry for facade management and discovery
 * @description Manages facade registration, lifecycle, and provides discovery capabilities
 * @see src/shared/facades/FacadeFactory.js
 * @see src/shared/facades/BaseFacade.js
 */

import {
  validateDependency,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IEventBus} IEventBus */
/** @typedef {import('./FacadeFactory.js').default} FacadeFactory */

/**
 * Facade metadata for registry management
 * @typedef {object} FacadeMetadata
 * @property {string} name - Facade name/identifier
 * @property {string} category - Facade category (e.g., 'clothing', 'anatomy', 'core')
 * @property {string} version - Facade version
 * @property {string} description - Human-readable description
 * @property {string[]} [tags] - Optional tags for categorization
 * @property {object} [capabilities] - Capabilities/features this facade provides
 * @property {Date} registeredAt - Registration timestamp
 * @property {boolean} singleton - Whether this facade should be treated as singleton
 */

/**
 * Registry for managing facade lifecycles and discovery
 * Provides centralized access to all available facades in the system
 */
class FacadeRegistry {
  #logger;
  #eventBus;
  #facadeFactory;
  #registry = new Map();
  #categories = new Map();
  #singletonInstances = new Map();

  /**
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger service
   * @param {IEventBus} deps.eventBus - Event bus service
   * @param {FacadeFactory} deps.facadeFactory - Facade factory service
   */
  constructor({ logger, eventBus, facadeFactory }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(eventBus, 'IEventBus', logger, {
      requiredMethods: ['dispatch', 'subscribe'],
    });
    validateDependency(facadeFactory, 'IFacadeFactory', logger, {
      requiredMethods: ['registerFacade', 'createFacade', 'isRegistered'],
    });

    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#facadeFactory = facadeFactory;

    this.#logger.debug('FacadeRegistry initialized');
  }

  /**
   * Register a facade with metadata
   * @param {FacadeMetadata} metadata - Facade metadata
   * @param {object} facadeConfig - Facade configuration for factory
   * @throws {InvalidArgumentError} If registration fails
   */
  register(metadata, facadeConfig) {
    try {
      this.#validateMetadata(metadata);

      if (this.#registry.has(metadata.name)) {
        throw new InvalidArgumentError(
          `Facade ${metadata.name} is already registered`
        );
      }

      // Register with factory first
      this.#facadeFactory.registerFacade(facadeConfig);

      // Store metadata with registration timestamp and normalize arrays
      const enrichedMetadata = {
        ...metadata,
        capabilities: metadata.capabilities || [],
        tags: metadata.tags || [],
        config: facadeConfig,
        registeredAt: new Date(),
        singleton: metadata.singleton !== false, // Default to true
      };

      this.#registry.set(metadata.name, enrichedMetadata);

      // Update category index if category is provided
      if (metadata.category) {
        this.#updateCategoryIndex(metadata.name, metadata.category);
      }

      // Dispatch registration event
      this.#eventBus.dispatch('FACADE_REGISTERED', {
        name: metadata.name,
        category: metadata.category,
        version: metadata.version,
        timestamp: Date.now(),
      });

      this.#logger.debug(
        `Registered facade: ${metadata.name} v${metadata.version}`
      );
    } catch (error) {
      this.#logger.error(
        `Failed to register facade: ${metadata?.name || 'unknown'}`,
        error
      );
      throw error;
    }
  }

  /**
   * Get a facade instance by name
   * @param {string} facadeName - Name of the facade
   * @param {object} [options] - Options for facade creation
   * @returns {*} Facade instance
   * @throws {InvalidArgumentError} If facade is not registered
   */
  getFacade(facadeName, options = {}) {
    try {
      assertNonBlankString(
        facadeName,
        'Facade name',
        'getFacade',
        this.#logger
      );

      const metadata = this.#registry.get(facadeName);
      if (!metadata) {
        throw new InvalidArgumentError(
          `Facade ${facadeName} is not registered`
        );
      }

      // Merge config options with provided options
      const mergedOptions = {
        ...metadata.config,
        ...options,
      };

      // Check if singleton is disabled in options
      const useSingleton = options.singleton !== false;

      // Remove singleton flag from options before passing to factory
      const { singleton: _, ...factoryOptions } = mergedOptions;

      if (useSingleton) {
        const facade = this.#facadeFactory.getSingletonFacade(
          facadeName,
          factoryOptions
        );

        this.#singletonInstances.set(facadeName, facade);

        return facade;
      } else {
        return this.#facadeFactory.createFacade(facadeName, factoryOptions);
      }
    } catch (error) {
      if (
        error instanceof InvalidArgumentError &&
        error.message.includes('is not registered')
      ) {
        throw error; // Re-throw unregistered facade error as-is
      }
      this.#logger.error(`Failed to get facade: ${facadeName}`, error);
      throw new InvalidArgumentError(
        `Failed to get facade ${facadeName}: ${error.message}`
      );
    }
  }

  /**
   * Check if a facade is registered
   * @param {string} facadeName - Name of the facade
   * @returns {boolean} True if facade is registered
   */
  isRegistered(facadeName) {
    return this.#registry.has(facadeName);
  }

  /**
   * Get facade metadata
   * @param {string} facadeName - Name of the facade
   * @returns {FacadeMetadata|null} Facade metadata or null if not found
   */
  getMetadata(facadeName) {
    return this.#registry.get(facadeName) || null;
  }

  /**
   * Get all registered facades
   * @returns {FacadeMetadata[]} Array of all facade metadata
   */
  getAllFacades() {
    return Array.from(this.#registry.values());
  }

  /**
   * Get registered facades (alias for getAllFacades for test compatibility)
   * @returns {FacadeMetadata[]} Array of all facade metadata
   */
  getRegisteredFacades() {
    return this.getAllFacades();
  }

  /**
   * Get facades by category
   * @param {string} category - Facade category
   * @returns {FacadeMetadata[]} Array of facades in the category
   */
  getFacadesByCategory(category) {
    const facadeNames = this.#categories.get(category) || [];
    return facadeNames
      .map((name) => this.#registry.get(name))
      .filter((metadata) => metadata !== undefined);
  }

  /**
   * Search facades by tags
   * @param {string[]} tags - Array of tags to search for
   * @param {boolean} [matchAll=false] - Whether to match all tags or any tag
   * @returns {FacadeMetadata[]} Array of matching facades
   */
  searchByTags(tags, matchAll = false) {
    // Handle string input by converting to array
    if (typeof tags === 'string') {
      tags = [tags];
    }

    if (!Array.isArray(tags) || tags.length === 0) {
      return [];
    }

    return Array.from(this.#registry.values()).filter((metadata) => {
      if (!metadata.tags || !Array.isArray(metadata.tags)) {
        return false;
      }

      if (matchAll) {
        return tags.every((tag) => metadata.tags.includes(tag));
      } else {
        return tags.some((tag) => metadata.tags.includes(tag));
      }
    });
  }

  /**
   * Get available categories
   * @returns {string[]} Array of available categories
   */
  getCategories() {
    return Array.from(this.#categories.keys());
  }

  /**
   * Get facade capabilities
   * @param {string} facadeName - Name of the facade
   * @returns {string[]} Array of facade capabilities or empty array if not found
   */
  getCapabilities(facadeName) {
    const metadata = this.#registry.get(facadeName);
    return metadata?.capabilities || [];
  }

  /**
   * Get facade tags
   * @param {string} facadeName - Name of the facade
   * @returns {string[]} Array of facade tags or empty array if not found
   */
  getTags(facadeName) {
    const metadata = this.#registry.get(facadeName);
    return metadata?.tags || [];
  }

  /**
   * Get complete facade information
   * @param {string} facadeName - Name of the facade
   * @returns {FacadeMetadata|null} Complete facade metadata or null if not found
   */
  getFacadeInfo(facadeName) {
    const metadata = this.#registry.get(facadeName);
    if (!metadata) {
      return null;
    }

    // Return only the expected fields for facade info
    return {
      name: metadata.name,
      version: metadata.version,
      description: metadata.description,
      capabilities: metadata.capabilities,
      tags: metadata.tags,
      config: metadata.config,
    };
  }

  /**
   * Find facades with specific capabilities
   * @param {string[]|string} requiredCapabilities - Required capabilities array or single capability
   * @returns {FacadeMetadata[]} Array of facades with matching capabilities
   */
  findByCapabilities(requiredCapabilities) {
    // Handle string input
    if (typeof requiredCapabilities === 'string') {
      requiredCapabilities = [requiredCapabilities];
    }

    if (
      !Array.isArray(requiredCapabilities) ||
      requiredCapabilities.length === 0
    ) {
      return Array.from(this.#registry.values());
    }

    return Array.from(this.#registry.values()).filter((metadata) => {
      if (!metadata.capabilities || !Array.isArray(metadata.capabilities)) {
        return false;
      }

      // Check if facade has all required capabilities
      return requiredCapabilities.every((capability) =>
        metadata.capabilities.includes(capability)
      );
    });
  }

  /**
   * Clear a singleton instance
   * @param {string} facadeName - Name of the facade
   */
  clearSingleton(facadeName) {
    if (this.#singletonInstances.has(facadeName)) {
      this.#singletonInstances.delete(facadeName);
      this.#logger.debug(`Cleared singleton facade: ${facadeName}`);

      // Dispatch event
      this.#eventBus.dispatch({
        type: 'FACADE_SINGLETON_CLEARED',
        payload: { name: facadeName },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Clear all singleton instances
   */
  clearAllSingletons() {
    const count = this.#singletonInstances.size;
    const names = Array.from(this.#singletonInstances.keys());

    this.#singletonInstances.clear();

    this.#logger.info(`Cleared ${count} singleton facade instances`);

    // Dispatch event
    this.#eventBus.dispatch({
      type: 'FACADE_SINGLETONS_CLEARED',
      payload: { count, names },
      timestamp: Date.now(),
    });
  }

  /**
   * Unregister a facade
   * @param {string} facadeName - Name of the facade to unregister
   */
  unregister(facadeName) {
    try {
      assertNonBlankString(
        facadeName,
        'Facade name',
        'unregister',
        this.#logger
      );

      const metadata = this.#registry.get(facadeName);
      if (!metadata) {
        this.#logger.warn(
          `Attempted to unregister unknown facade: ${facadeName}`
        );
        return;
      }

      // Clear singleton instance if exists
      this.clearSingleton(facadeName);

      // Remove from registry
      this.#registry.delete(facadeName);

      // Update category index
      this.#removeFacadeFromCategory(facadeName, metadata.category);

      // Dispatch event
      this.#eventBus.dispatch({
        type: 'FACADE_UNREGISTERED',
        payload: {
          name: facadeName,
          category: metadata.category,
        },
        timestamp: Date.now(),
      });

      this.#logger.info(`Unregistered facade: ${facadeName}`, {
        category: metadata.category,
      });
    } catch (error) {
      this.#logger.error(`Failed to unregister facade: ${facadeName}`, error);
      throw error;
    }
  }

  /**
   * Get registry statistics
   * @returns {object} Registry statistics
   */
  getStatistics() {
    const stats = {
      totalFacades: this.#registry.size,
      categories: this.#categories.size,
      singletonInstances: this.#singletonInstances.size,
      facadesByCategory: {},
    };

    // Count facades per category
    for (const [category, facades] of this.#categories.entries()) {
      stats.facadesByCategory[category] = facades.length;
    }

    return stats;
  }

  /**
   * Update category index when registering facade
   * @private
   * @param {string} facadeName - Name of the facade
   * @param {string} category - Category name
   */
  #updateCategoryIndex(facadeName, category) {
    if (!this.#categories.has(category)) {
      this.#categories.set(category, []);
    }

    const categoryFacades = this.#categories.get(category);
    if (!categoryFacades.includes(facadeName)) {
      categoryFacades.push(facadeName);
    }
  }

  /**
   * Remove facade from category index
   * @private
   * @param {string} facadeName - Name of the facade
   * @param {string} category - Category name
   */
  #removeFacadeFromCategory(facadeName, category) {
    const categoryFacades = this.#categories.get(category);
    if (categoryFacades) {
      const index = categoryFacades.indexOf(facadeName);
      if (index > -1) {
        categoryFacades.splice(index, 1);
      }

      // Remove empty categories
      if (categoryFacades.length === 0) {
        this.#categories.delete(category);
      }
    }
  }

  /**
   * Validate facade metadata
   * @private
   * @param {FacadeMetadata} metadata - Metadata to validate
   * @throws {InvalidArgumentError} If metadata is invalid
   */
  #validateMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object') {
      throw new InvalidArgumentError('Facade metadata must be an object');
    }

    if (
      !metadata.name ||
      typeof metadata.name !== 'string' ||
      metadata.name.trim() === ''
    ) {
      throw new InvalidArgumentError('Facade name is required');
    }
    if (
      !metadata.version ||
      typeof metadata.version !== 'string' ||
      metadata.version.trim() === ''
    ) {
      throw new InvalidArgumentError('Facade version is required');
    }

    // Category and description are optional to match test expectations
    if (metadata.category && typeof metadata.category !== 'string') {
      throw new InvalidArgumentError('Facade category must be a string');
    }
    if (metadata.description && typeof metadata.description !== 'string') {
      throw new InvalidArgumentError('Facade description must be a string');
    }

    if (metadata.tags && !Array.isArray(metadata.tags)) {
      throw new InvalidArgumentError('Facade tags must be an array');
    }

    if (metadata.capabilities && !Array.isArray(metadata.capabilities)) {
      throw new InvalidArgumentError('Facade capabilities must be an array');
    }

    if (
      metadata.singleton !== undefined &&
      typeof metadata.singleton !== 'boolean'
    ) {
      throw new InvalidArgumentError('Facade singleton flag must be boolean');
    }
  }
}

export default FacadeRegistry;
