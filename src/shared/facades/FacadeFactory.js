/**
 * @file Factory for creating facade instances with proper dependency injection
 * @description Creates and configures facade instances with their required dependencies
 * @see src/shared/facades/BaseFacade.js
 * @see src/shared/facades/FacadeRegistry.js
 */

import { validateDependency, assertNonBlankString } from '../../utils/dependencyUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IEventBus} IEventBus */
/** @typedef {import('../../cache/UnifiedCache.js').UnifiedCache} IUnifiedCache */
/** @typedef {import('../facades/BaseFacade.js').default} BaseFacade */

/**
 * Factory configuration for facade creation
 *
 * @typedef {object} FacadeConfig
 * @property {string} name - Facade name/identifier
 * @property {Function} constructor - Facade constructor function
 * @property {string[]} [dependencies] - List of additional dependency tokens required
 * @property {object} [options] - Additional options passed to facade constructor
 */

/**
 * Factory for creating and managing facade instances
 * Handles dependency injection and lifecycle management for facades
 */
class FacadeFactory {
  #logger;
  #container;
  #instances = new Map();

  /**
   * @param {object} deps - Dependencies
   * @param {ILogger} deps.logger - Logger service
   * @param {object} deps.container - Dependency injection container
   * @param {object} [deps.registry] - Facade registry (optional, for registerFacade delegation)
   */
  constructor({ logger, container, registry }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(container, 'IContainer', logger, {
      requiredMethods: ['resolve', 'isRegistered'],
    });

    this.#logger = logger;
    this.#container = container;
    this.registry = registry; // Public for registry delegation

    this.#logger.debug('FacadeFactory initialized');
  }

  /**
   * Register facade with the registry (delegates to registry)
   *
   * @param {object} config - Facade configuration including metadata
   */
  registerFacade(config) {
    try {
      if (!config?.name) {
        throw new InvalidArgumentError('Facade name is required');
      }

      // This method delegates to the registry - it's kept for compatibility
      if (this.registry) {
        this.registry.register(config, config);
      }

      this.#logger.debug(`Registered facade: ${config.name}`);

    } catch (error) {
      this.#logger.error(`Failed to register facade: ${config?.name || 'unknown'}`, error);
      throw new InvalidArgumentError(`Failed to register facade ${config?.name || 'unknown'}: ${error.message}`);
    }
  }

  /**
   * Create a facade instance by name
   *
   * @param {string} facadeName - Name of the facade to create
   * @param {object} [overrideOptions] - Override options for this instance
   * @returns {BaseFacade} Configured facade instance
   * @throws {InvalidArgumentError} If facade is not registered or creation fails
   */
  createFacade(facadeName, overrideOptions = {}) {
    try {
      assertNonBlankString(facadeName, 'Facade name', 'createFacade', this.#logger);

      this.#logger.debug(`Creating facade: ${facadeName}`);

      // Resolve facade constructor from DI container
      const FacadeConstructor = this.#container.resolve(facadeName);

      // Resolve core dependencies
      const coreDependencies = this.#resolveCoreDepencies();

      // Merge with override options
      const dependencies = {
        ...coreDependencies,
        ...overrideOptions,
      };

      // Create facade instance
      const instance = new FacadeConstructor(dependencies);

      this.#logger.info(`Created facade: ${facadeName}`);
      return instance;

    } catch (error) {
      this.#logger.error(`Failed to create facade: ${facadeName}`, error);
      throw new InvalidArgumentError(`Failed to create facade ${facadeName}: ${error.message}`);
    }
  }

  /**
   * Create or retrieve a singleton facade instance
   *
   * @param {string} facadeName - Name of the facade
   * @param {object} [overrideOptions] - Override options for initial creation
   * @returns {BaseFacade} Facade instance (singleton)
   */
  getSingletonFacade(facadeName, overrideOptions = {}) {
    try {
      assertNonBlankString(facadeName, 'Facade name', 'getSingletonFacade', this.#logger);

      // Generate cache key based on facade name and options
      const cacheKey = this.#generateCacheKey(facadeName, overrideOptions);

      // Return existing instance if available
      if (this.#instances.has(cacheKey)) {
        this.#logger.debug(`Returning existing singleton facade: ${facadeName}`);
        return this.#instances.get(cacheKey);
      }

      // Create new singleton instance
      this.#logger.debug(`Creating singleton facade: ${facadeName}`);
      const instance = this.createFacade(facadeName, overrideOptions);
      this.#instances.set(cacheKey, instance);
      
      return instance;

    } catch (error) {
      this.#logger.error(`Failed to get singleton facade: ${facadeName}`, error);
      throw new InvalidArgumentError(`Failed to create facade ${facadeName}: ${error.message}`);
    }
  }

  /**
   * Clear singleton cache for specific facade or all facades
   *
   * @param {string} [facadeName] - Name of facade to clear, or all if not specified
   */
  clearSingletonCache(facadeName) {
    if (facadeName) {
      // Clear specific facade instances (all options combinations)
      const keysToDelete = [];
      for (const key of this.#instances.keys()) {
        if (key === facadeName || key.startsWith(facadeName + ':')) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => this.#instances.delete(key));
      this.#logger.debug(`Cleared singleton cache for: ${facadeName}`);
    } else {
      // Clear all
      this.#instances.clear();
      this.#logger.debug('Cleared all singleton cache');
    }
  }

  /**
   * Check if a facade is registered in the container
   *
   * @param {string} facadeName - Name of the facade to check
   * @returns {boolean} True if facade is registered
   */
  isRegistered(facadeName) {
    try {
      return this.#container.isRegistered(facadeName);
    } catch (error) {
      this.#logger.debug(`Error checking if facade is registered: ${facadeName}`, error);
      return false;
    }
  }

  /**
   * Check if a singleton instance exists for a facade
   *
   * @param {string} facadeName - Name of the facade to check
   * @param {object} [options] - Options to match
   * @returns {boolean} True if singleton exists
   */
  hasSingleton(facadeName, options = {}) {
    const cacheKey = this.#generateCacheKey(facadeName, options);
    return this.#instances.has(cacheKey);
  }

  /**
   * Get names of all cached facade instances
   *
   * @returns {string[]} Array of facade names with cached instances
   */
  getCachedFacadeNames() {
    const names = new Set();
    for (const key of this.#instances.keys()) {
      const facadeName = key.split(':')[0];
      names.add(facadeName);
    }
    return Array.from(names);
  }

  /**
   * Generate cache key for singleton instances based on facade name and options
   *
   * @private
   * @param {string} facadeName - Name of the facade
   * @param {object} options - Options object
   * @returns {string} Cache key
   */
  #generateCacheKey(facadeName, options) {
    if (Object.keys(options).length === 0) {
      return facadeName;
    }
    
    // Create deterministic hash of options
    const optionsStr = JSON.stringify(options, Object.keys(options).sort());
    return `${facadeName}:${Buffer.from(optionsStr).toString('base64')}`;
  }

  /**
   * Resolve core dependencies required by all facades
   *
   * @private
   * @returns {object} Core dependencies object
   */
  #resolveCoreDepencies() {
    try {
      return {
        logger: this.#container.resolve('ILogger'),
        eventBus: this.#container.resolve('IEventBus'),
        unifiedCache: this.#container.resolve('IUnifiedCache'),
        circuitBreaker: this.#container.isRegistered('ICircuitBreaker') 
          ? this.#container.resolve('ICircuitBreaker') 
          : null,
      };
    } catch (error) {
      this.#logger.error('Failed to resolve core dependencies', error);
      throw new InvalidArgumentError('Core facade dependencies not available');
    }
  }

}

export default FacadeFactory;