/**
 * @file PerformanceTestBed - Optimized test bed for performance testing
 * @description Provides lightweight container initialization and batch entity operations
 * for improved performance test execution speed
 */

import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

/**
 * Performance-optimized test bed for ScopeDSL and other performance tests
 */
export class PerformanceTestBed {
  /**
   * Static container instance shared across tests
   *
   * @type {AppContainer|null}
   */
  static #sharedContainer = null;

  /**
   * Entity definition cache to avoid recreation
   *
   * @type {Map<string, EntityDefinition>}
   */
  static #entityCache = new Map();

  /**
   * DOM elements cache
   *
   * @type {object | null}
   */
  static #domElements = null;

  /**
   * Get or create a shared container instance
   * Reuses container across tests to avoid initialization overhead
   *
   * @returns {Promise<AppContainer>} Configured container
   */
  static async getSharedContainer() {
    if (!this.#sharedContainer) {
      this.#sharedContainer = await this.createLightweightContainer();
    }
    return this.#sharedContainer;
  }

  /**
   * Create a lightweight container with minimal services
   * Only initializes services required for scope testing
   *
   * @returns {Promise<AppContainer>} Configured container
   */
  static async createLightweightContainer() {
    // Set environment variables to disable debug config loading and remote logging
    // This prevents the container from making network requests during initialization
    process.env.SKIP_DEBUG_CONFIG = 'true';
    process.env.DEBUG_LOG_MODE = 'test';
    process.env.NODE_ENV = 'test';

    const container = new AppContainer();

    // Create minimal DOM elements if not cached
    if (!this.#domElements) {
      this.#domElements = this.createMinimalDOMElements();
    }

    // Configure with minimal options - skip unnecessary systems
    await configureContainer(container, {
      ...this.#domElements,
      includeUI: false, // Skip UI components
      includeCharacterBuilder: false, // Skip character builder
      includeGameSystems: true, // Need this for scope testing
    });

    return container;
  }

  /**
   * Create minimal DOM elements required for container
   *
   * @returns {object} DOM elements
   */
  static createMinimalDOMElements() {
    const outputDiv = document.createElement('div');
    outputDiv.id = 'outputDiv';
    const messageList = document.createElement('ul');
    messageList.id = 'message-list';
    outputDiv.appendChild(messageList);

    const inputElement = document.createElement('input');
    inputElement.id = 'inputBox';

    const titleElement = document.createElement('h1');
    titleElement.id = 'gameTitle';

    // Add to document body for tests that need them
    document.body.appendChild(outputDiv);
    document.body.appendChild(inputElement);
    document.body.appendChild(titleElement);

    return {
      outputDiv,
      inputElement,
      titleElement,
      document,
    };
  }

  /**
   * Batch create entity definitions for performance
   *
   * @param {string} prefix - Entity ID prefix
   * @param {number} count - Number of entities to create
   * @param {Function} componentGenerator - Function to generate components for each entity
   * @returns {Array<EntityDefinition>} Array of entity definitions
   */
  static createEntityDefinitionsBatch(prefix, count, componentGenerator) {
    const definitions = [];

    for (let i = 0; i < count; i++) {
      const id = `${prefix}-${i}`;

      // Check cache first
      if (this.#entityCache.has(id)) {
        definitions.push(this.#entityCache.get(id));
        continue;
      }

      const def = {
        id,
        description: `${prefix} entity ${i}`,
        components: componentGenerator(i),
      };

      const entityDef = new EntityDefinition(id, def);
      this.#entityCache.set(id, entityDef);
      definitions.push(entityDef);
    }

    return definitions;
  }

  /**
   * Batch register and create entity instances
   * More efficient than individual creation
   *
   * @param {Array<EntityDefinition>} definitions - Entity definitions
   * @param {object} registry - Data registry service
   * @param {object} entityManager - Entity manager service
   * @returns {Promise<Array>} Created entity instances
   */
  static async batchCreateEntities(definitions, registry, entityManager) {
    // Batch register all definitions first
    for (const def of definitions) {
      registry.store('entityDefinitions', def.id, def);
    }

    // Then batch create instances
    const instances = await Promise.all(
      definitions.map((def) =>
        entityManager.createEntityInstance(def.id, {
          instanceId: def.id,
          definitionId: def.id,
          components: def.components,
        })
      )
    );

    return instances;
  }

  /**
   * Create a large test dataset optimized for performance
   *
   * @param {number} actorCount - Number of actors to create
   * @param {object} services - Container services
   * @returns {Promise<object>} Test dataset
   */
  static async createOptimizedTestDataset(actorCount, services) {
    const { registry, entityManager } = services;

    // Create unique location ID for each test
    const testId = Date.now() + Math.random().toString(36).substring(2, 9);
    const locationId = `test-location-${testId}`;

    // Create location first
    const locationDef = new EntityDefinition(locationId, {
      id: locationId,
      description: 'Test location',
      components: {
        'core:location': {
          name: 'Test Arena',
          exits: [],
        },
      },
    });

    registry.store('entityDefinitions', locationDef.id, locationDef);
    const location = await entityManager.createEntityInstance(locationDef.id, {
      instanceId: locationDef.id,
      definitionId: locationDef.id,
      components: locationDef.components,
    });

    // Batch create actors
    const actorDefs = this.createEntityDefinitionsBatch(
      `test-actor-${testId}`,
      actorCount,
      (i) => ({
        'core:actor': { name: `Test Actor ${i}` },
        'core:stats': {
          level: Math.floor(Math.random() * 20) + 1,
          strength: Math.floor(Math.random() * 30) + 5,
          attributes: {
            physical: {
              strength: {
                base: {
                  value: Math.floor(Math.random() * 20) + 10,
                },
              },
            },
          },
        },
        'core:health': {
          current: Math.floor(Math.random() * 100) + 1,
          max: 100,
        },
        'core:location': { locationId: locationDef.id },
      })
    );

    await this.batchCreateEntities(actorDefs, registry, entityManager);

    // Create fewer items (10% of actors)
    const itemCount = Math.floor(actorCount / 10);
    const itemDefs = this.createEntityDefinitionsBatch(
      `test-item-${testId}`,
      itemCount,
      (i) => ({
        'core:item': { name: `Test Item ${i}` },
        'core:value': Math.floor(Math.random() * 500),
      })
    );

    await this.batchCreateEntities(itemDefs, registry, entityManager);

    return {
      actors: actorDefs.map((d) => ({ id: d.id })),
      items: itemDefs.map((d) => ({ id: d.id })),
      location: { id: locationDef.id },
    };
  }

  /**
   * Clean up shared resources
   * Call this in afterAll() hook
   */
  static cleanup() {
    // Clear caches
    this.#entityCache.clear();

    // Clean up DOM
    if (this.#domElements) {
      document.body.innerHTML = '';
      this.#domElements = null;
    }

    // Clean up container
    if (
      this.#sharedContainer &&
      typeof this.#sharedContainer.cleanup === 'function'
    ) {
      this.#sharedContainer.cleanup();
      this.#sharedContainer = null;
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * Reset entity cache between tests if needed
   * Lighter weight than full cleanup
   */
  static resetEntityCache() {
    this.#entityCache.clear();
  }
}

export default PerformanceTestBed;
