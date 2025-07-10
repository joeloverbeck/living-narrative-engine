/**
 * @file EntityDefinitionHelperTestBed - Test helper for EntityDefinitionHelper tests
 * @description Provides centralized setup and utilities for testing EntityDefinitionHelper
 */

import { jest } from '@jest/globals';
import EntityDefinitionHelper from '../../../src/entities/services/helpers/EntityDefinitionHelper.js';
import {
  createMockLogger,
  createSimpleMockDataRegistry,
  createMockDefinitionCache,
  createMockEntityDefinition,
} from '../mockFactories/index.js';
import BaseTestBed from '../baseTestBed.js';

/**
 * TestBed for EntityDefinitionHelper providing mocks and utilities
 */
export class EntityDefinitionHelperTestBed extends BaseTestBed {
  /**
   * Creates a new EntityDefinitionHelperTestBed instance.
   *
   * @param {object} [options] - Configuration options
   * @param {object} [options.registryOverrides] - Registry method overrides
   * @param {object} [options.cacheOverrides] - Cache method overrides
   * @param {boolean} [options.enableCacheStats] - Enable cache statistics
   * @param {Map<string, any>} [options.initialCache] - Initial cache entries
   */
  constructor({
    registryOverrides = {},
    cacheOverrides = {},
    enableCacheStats = false,
    initialCache = new Map(),
  } = {}) {
    super();

    // Create mock dependencies
    this.logger = createMockLogger();
    this.registry = createSimpleMockDataRegistry();
    this.definitionCache = createMockDefinitionCache({
      initialCache,
      enableStats: enableCacheStats,
    });

    // Apply overrides
    Object.assign(this.registry, registryOverrides);
    Object.assign(this.definitionCache, cacheOverrides);

    // Create helper instance
    this.helper = new EntityDefinitionHelper({
      registry: this.registry,
      definitionCache: this.definitionCache,
      logger: this.logger,
    });
  }

  /**
   * Creates a mock entity definition with the given ID and components.
   *
   * @param {string} id - Definition ID
   * @param {object} [options] - Definition options
   * @returns {object} Mock entity definition
   */
  createMockDefinition(id, options = {}) {
    return createMockEntityDefinition(id, options);
  }

  /**
   * Sets up the registry to return a specific definition for a given ID.
   *
   * @param {string} definitionId - Definition ID
   * @param {object|null} [definition] - Definition to return (null for not found)
   * @param {Error} [error] - Error to throw instead of returning
   */
  setupRegistryDefinition(definitionId, definition = null, error = null) {
    if (error) {
      this.registry.getEntityDefinition.mockImplementation((id) => {
        if (id === definitionId) throw error;
        return null;
      });
    } else {
      this.registry.getEntityDefinition.mockImplementation((id) => {
        if (id === definitionId) return definition;
        return null;
      });
    }
  }

  /**
   * Sets up the cache to contain specific definitions.
   *
   * @param {Map<string, any>} definitions - Map of ID to definition
   */
  setupCacheDefinitions(definitions) {
    definitions.forEach((def, id) => {
      this.definitionCache.has.mockImplementation((cacheId) => {
        if (cacheId === id) return true;
        return definitions.has(cacheId);
      });
      this.definitionCache.get.mockImplementation((cacheId) => {
        if (cacheId === id) return def;
        return definitions.get(cacheId);
      });
    });
  }

  /**
   * Asserts that the cache was accessed with specific operations.
   *
   * @param {object} expected - Expected cache operations
   * @param {number} [expected.gets] - Expected number of get calls
   * @param {number} [expected.sets] - Expected number of set calls
   * @param {number} [expected.clears] - Expected number of clear calls
   * @param {string[]} [expected.getIds] - Expected IDs that were requested
   */
  assertCacheOperations({ gets, sets, clears, getIds } = {}) {
    if (gets !== undefined) {
      expect(this.definitionCache.get).toHaveBeenCalledTimes(gets);
    }
    if (sets !== undefined) {
      expect(this.definitionCache.set).toHaveBeenCalledTimes(sets);
    }
    if (clears !== undefined) {
      expect(this.definitionCache.clear).toHaveBeenCalledTimes(clears);
    }
    if (getIds) {
      getIds.forEach((id) => {
        expect(this.definitionCache.get).toHaveBeenCalledWith(id);
      });
    }
  }

  /**
   * Asserts that the registry was accessed with specific operations.
   *
   * @param {object} expected - Expected registry operations
   * @param {number} [expected.gets] - Expected number of getEntityDefinition calls
   * @param {string[]} [expected.getIds] - Expected IDs that were requested
   */
  assertRegistryOperations({ gets, getIds } = {}) {
    if (gets !== undefined) {
      expect(this.registry.getEntityDefinition).toHaveBeenCalledTimes(gets);
    }
    if (getIds) {
      getIds.forEach((id) => {
        expect(this.registry.getEntityDefinition).toHaveBeenCalledWith(id);
      });
    }
  }

  /**
   * Asserts that specific log messages were generated.
   *
   * @param {object} expected - Expected log operations
   * @param {number} [expected.errors] - Expected number of error logs
   * @param {number} [expected.warnings] - Expected number of warning logs
   * @param {number} [expected.debugs] - Expected number of debug logs
   * @param {string[]} [expected.errorMessages] - Expected error message patterns
   */
  assertLogOperations({ errors, warnings, debugs, errorMessages } = {}) {
    if (errors !== undefined) {
      expect(this.logger.error).toHaveBeenCalledTimes(errors);
    }
    if (warnings !== undefined) {
      expect(this.logger.warn).toHaveBeenCalledTimes(warnings);
    }
    if (debugs !== undefined) {
      expect(this.logger.debug).toHaveBeenCalledTimes(debugs);
    }
    if (errorMessages) {
      errorMessages.forEach((pattern) => {
        expect(this.logger.error).toHaveBeenCalledWith(
          expect.stringContaining(pattern),
          expect.any(Error)
        );
      });
    }
  }

  /**
   * Creates a scenario where the registry throws an error.
   *
   * @param {string} definitionId - Definition ID that should cause error
   * @param {Error} [error] - Error to throw (defaults to generic error)
   */
  setupRegistryError(definitionId, error = new Error('Registry error')) {
    this.setupRegistryDefinition(definitionId, null, error);
  }

  /**
   * Creates valid test definition data.
   *
   * @param {string} id - Definition ID
   * @param {object} [components] - Component data
   * @returns {object} Valid definition
   */
  createValidDefinition(id, components = {}) {
    return {
      id,
      components,
      name: `Test ${id}`,
      description: `Test definition for ${id}`,
    };
  }

  /**
   * Creates invalid test definition data for validation testing.
   *
   * @param {string} type - Type of invalid definition
   * @returns {object|null|undefined} Invalid definition
   */
  createInvalidDefinition(type) {
    switch (type) {
      case 'null':
        return null;
      case 'undefined':
        return undefined;
      case 'not-object':
        return 'invalid';
      case 'missing-id':
        return { components: {} };
      case 'missing-components':
        return { id: 'test' };
      case 'wrong-id':
        return { id: 'wrong', components: {} };
      case 'invalid-components':
        return { id: 'test', components: 'invalid' };
      default:
        return {};
    }
  }

  /**
   * Cleanup method called after each test.
   */
  cleanup() {
    super.cleanup();
    jest.clearAllMocks();
  }
}

export default EntityDefinitionHelperTestBed;
