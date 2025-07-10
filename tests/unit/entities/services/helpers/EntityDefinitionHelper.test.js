/**
 * @file EntityDefinitionHelper.test.js - Comprehensive test suite for EntityDefinitionHelper
 * @description Tests all public methods and edge cases for EntityDefinitionHelper
 * @see src/entities/services/helpers/EntityDefinitionHelper.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { EntityDefinitionHelperTestBed } from '../../../../common/entities/index.js';
import { DefinitionNotFoundError } from '../../../../../src/errors/definitionNotFoundError.js';

describe('EntityDefinitionHelper - Constructor Validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityDefinitionHelperTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should instantiate successfully with valid dependencies', () => {
    expect(testBed.helper).toBeDefined();
    expect(typeof testBed.helper.getDefinitionForCreate).toBe('function');
    expect(typeof testBed.helper.getDefinitionForReconstruct).toBe('function');
    expect(typeof testBed.helper.hasDefinition).toBe('function');
    expect(typeof testBed.helper.preloadDefinitions).toBe('function');
    expect(typeof testBed.helper.validateDefinition).toBe('function');
    expect(typeof testBed.helper.getCacheStats).toBe('function');
    expect(typeof testBed.helper.clearCache).toBe('function');
    expect(typeof testBed.helper.getCachedDefinitionIds).toBe('function');
  });

  it.each([
    ['registry', { registry: null }],
    ['definitionCache', { definitionCache: null }],
    ['logger', { logger: null }],
  ])('should throw when %s is null or invalid', (dependencyName, overrides) => {
    expect(() => {
      new testBed.helper.constructor({
        registry: testBed.registry,
        definitionCache: testBed.definitionCache,
        logger: testBed.logger,
        ...overrides,
      });
    }).toThrow();
  });

  it('should validate registry has required methods', () => {
    const invalidRegistry = { someMethod: () => {} };
    expect(() => {
      new testBed.helper.constructor({
        registry: invalidRegistry,
        definitionCache: testBed.definitionCache,
        logger: testBed.logger,
      });
    }).toThrow();
  });

  it('should validate definitionCache has required methods', () => {
    const invalidCache = { someMethod: () => {} };
    expect(() => {
      new testBed.helper.constructor({
        registry: testBed.registry,
        definitionCache: invalidCache,
        logger: testBed.logger,
      });
    }).toThrow();
  });
});

describe('EntityDefinitionHelper - Cache Operations', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityDefinitionHelperTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('getCacheStats', () => {
    it('should return stats when cache has getStats method', () => {
      const mockStats = { size: 5, hits: 10, misses: 2 };
      testBed = new EntityDefinitionHelperTestBed({ enableCacheStats: true });
      testBed.definitionCache.getStats.mockReturnValue(mockStats);

      const stats = testBed.helper.getCacheStats();

      expect(stats).toEqual(mockStats);
      expect(testBed.definitionCache.getStats).toHaveBeenCalled();
    });

    it('should return default stats when cache lacks getStats method', () => {
      const stats = testBed.helper.getCacheStats();

      expect(stats).toEqual({
        size: 0,
        hits: 0,
        misses: 0,
      });
    });

    it('should use cache size property when available', () => {
      Object.defineProperty(testBed.definitionCache, 'size', {
        value: 3,
        configurable: true,
      });

      const stats = testBed.helper.getCacheStats();

      expect(stats.size).toBe(3);
    });
  });

  describe('clearCache', () => {
    it('should clear the cache and log debug message', () => {
      testBed.helper.clearCache();

      testBed.assertCacheOperations({ clears: 1 });
      testBed.assertLogOperations({ debugs: 1 });
    });
  });

  describe('getCachedDefinitionIds', () => {
    it('should return array of cached definition IDs when cache has keys method', () => {
      const mockKeys = ['def1', 'def2', 'def3'];
      testBed.definitionCache.keys.mockReturnValue(mockKeys);

      const ids = testBed.helper.getCachedDefinitionIds();

      expect(ids).toEqual(mockKeys);
      expect(testBed.definitionCache.keys).toHaveBeenCalled();
    });

    it('should return empty array when cache lacks keys method', () => {
      delete testBed.definitionCache.keys;

      const ids = testBed.helper.getCachedDefinitionIds();

      expect(ids).toEqual([]);
    });
  });
});

describe('EntityDefinitionHelper - Definition Retrieval', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityDefinitionHelperTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('getDefinitionForCreate', () => {
    it('should return cached definition when available', () => {
      const definitionId = 'test:definition';
      const mockDefinition = testBed.createValidDefinition(definitionId);

      testBed.setupCacheDefinitions(new Map([[definitionId, mockDefinition]]));

      const result = testBed.helper.getDefinitionForCreate(definitionId);

      expect(result).toBe(mockDefinition);
      testBed.assertCacheOperations({
        gets: 1,
        getIds: [definitionId],
      });
      testBed.assertRegistryOperations({ gets: 0 });
    });

    it('should fetch from registry when not cached', () => {
      const definitionId = 'test:definition';
      const mockDefinition = testBed.createValidDefinition(definitionId);

      testBed.definitionCache.get.mockReturnValue(undefined);
      testBed.setupRegistryDefinition(definitionId, mockDefinition);

      const result = testBed.helper.getDefinitionForCreate(definitionId);

      expect(result).toBe(mockDefinition);
      testBed.assertCacheOperations({
        gets: 1,
        sets: 1,
      });
      testBed.assertRegistryOperations({
        gets: 1,
        getIds: [definitionId],
      });
      testBed.assertLogOperations({ debugs: 2 });
    });

    it('should throw DefinitionNotFoundError when registry throws error', () => {
      const definitionId = 'test:definition';
      const registryError = new Error('Registry failed');

      testBed.definitionCache.get.mockReturnValue(undefined);
      testBed.setupRegistryError(definitionId, registryError);

      expect(() => {
        testBed.helper.getDefinitionForCreate(definitionId);
      }).toThrow(DefinitionNotFoundError);

      testBed.assertLogOperations({
        errors: 1,
        errorMessages: ['Failed to fetch definition'],
      });
    });

    it('should throw DefinitionNotFoundError when definition is null', () => {
      const definitionId = 'test:definition';

      testBed.definitionCache.get.mockReturnValue(undefined);
      testBed.setupRegistryDefinition(definitionId, null);

      expect(() => {
        testBed.helper.getDefinitionForCreate(definitionId);
      }).toThrow(DefinitionNotFoundError);

      testBed.assertLogOperations({
        warnings: 1,
      });
    });
  });

  describe('getDefinitionForReconstruct', () => {
    it('should call getDefinitionForCreate with debug context', () => {
      const definitionId = 'test:definition';
      const mockDefinition = testBed.createValidDefinition(definitionId);

      testBed.setupCacheDefinitions(new Map([[definitionId, mockDefinition]]));

      const result = testBed.helper.getDefinitionForReconstruct(definitionId);

      expect(result).toBe(mockDefinition);
      testBed.assertLogOperations({
        debugs: 1,
      });
    });
  });

  describe('hasDefinition', () => {
    it('should return true when definition is cached', () => {
      const definitionId = 'test:definition';

      testBed.definitionCache.has.mockReturnValue(true);

      const result = testBed.helper.hasDefinition(definitionId);

      expect(result).toBe(true);
      expect(testBed.definitionCache.has).toHaveBeenCalledWith(definitionId);
    });

    it('should check registry and cache result when not in cache', () => {
      const definitionId = 'test:definition';
      const mockDefinition = testBed.createValidDefinition(definitionId);

      testBed.definitionCache.has.mockReturnValue(false);
      testBed.setupRegistryDefinition(definitionId, mockDefinition);

      const result = testBed.helper.hasDefinition(definitionId);

      expect(result).toBe(true);
      testBed.assertRegistryOperations({
        gets: 1,
        getIds: [definitionId],
      });
      testBed.assertCacheOperations({ sets: 1 });
    });

    it('should return false when definition not found in registry', () => {
      const definitionId = 'test:definition';

      testBed.definitionCache.has.mockReturnValue(false);
      testBed.setupRegistryDefinition(definitionId, null);

      const result = testBed.helper.hasDefinition(definitionId);

      expect(result).toBe(false);
    });

    it('should return false and log debug when registry throws error', () => {
      const definitionId = 'test:definition';
      const registryError = new Error('Registry failed');

      testBed.definitionCache.has.mockReturnValue(false);
      testBed.setupRegistryError(definitionId, registryError);

      const result = testBed.helper.hasDefinition(definitionId);

      expect(result).toBe(false);
      testBed.assertLogOperations({ debugs: 1 });
    });
  });
});

describe('EntityDefinitionHelper - Bulk Operations', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityDefinitionHelperTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('preloadDefinitions', () => {
    it('should preload multiple definitions successfully', () => {
      const definitionIds = ['def1', 'def2', 'def3'];
      const definitions = definitionIds.map((id) =>
        testBed.createValidDefinition(id)
      );

      // Setup all definitions as not cached
      testBed.definitionCache.has.mockReturnValue(false);

      // Setup registry to return definitions
      definitionIds.forEach((id, index) => {
        testBed.registry.getEntityDefinition.mockImplementation((requestId) => {
          const idx = definitionIds.indexOf(requestId);
          return idx >= 0 ? definitions[idx] : null;
        });
      });

      const result = testBed.helper.preloadDefinitions(definitionIds);

      expect(result.loaded).toEqual(definitionIds);
      expect(result.failed).toHaveLength(0);
      expect(result.alreadyCached).toHaveLength(0);
      testBed.assertCacheOperations({ sets: 3 });
      testBed.assertLogOperations({ debugs: 1 });
    });

    it('should identify already cached definitions', () => {
      const definitionIds = ['def1', 'def2', 'def3'];
      const cachedIds = ['def1', 'def3'];

      testBed.definitionCache.has.mockImplementation((id) =>
        cachedIds.includes(id)
      );
      testBed.setupRegistryDefinition(
        'def2',
        testBed.createValidDefinition('def2')
      );

      const result = testBed.helper.preloadDefinitions(definitionIds);

      expect(result.alreadyCached).toEqual(cachedIds);
      expect(result.loaded).toEqual(['def2']);
      expect(result.failed).toHaveLength(0);
    });

    it('should handle failed definitions', () => {
      const definitionIds = ['def1', 'def2', 'def3'];

      testBed.definitionCache.has.mockReturnValue(false);
      testBed.registry.getEntityDefinition.mockImplementation((id) => {
        if (id === 'def2') throw new Error('Failed to load');
        if (id === 'def3') return null;
        return testBed.createValidDefinition(id);
      });

      const result = testBed.helper.preloadDefinitions(definitionIds);

      expect(result.loaded).toEqual(['def1']);
      expect(result.failed).toEqual(['def2', 'def3']);
      expect(result.alreadyCached).toHaveLength(0);
      testBed.assertLogOperations({ debugs: 2 }); // Two for each failed + summary
    });

    it('should handle empty definition list', () => {
      const result = testBed.helper.preloadDefinitions([]);

      expect(result.loaded).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(result.alreadyCached).toHaveLength(0);
    });
  });
});

describe('EntityDefinitionHelper - Validation', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityDefinitionHelperTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('validateDefinition', () => {
    it('should validate valid definition successfully', () => {
      const definitionId = 'test:definition';
      const definition = testBed.createValidDefinition(definitionId);

      expect(() => {
        testBed.helper.validateDefinition(definition, definitionId);
      }).not.toThrow();
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['string', 'invalid'],
      ['number', 123],
    ])('should throw error for %s definition', (type, definition) => {
      const definitionId = 'test:definition';

      expect(() => {
        testBed.helper.validateDefinition(definition, definitionId);
      }).toThrow(/not a valid object/);
    });

    it('should throw error for array definition', () => {
      const definitionId = 'test:definition';
      const definition = [];

      expect(() => {
        testBed.helper.validateDefinition(definition, definitionId);
      }).toThrow(/missing required property/);
    });

    it.each([
      ['id', { components: {} }],
      ['components', { id: 'test' }],
    ])(
      'should throw error when missing required property: %s',
      (property, definition) => {
        const definitionId = 'test:definition';

        expect(() => {
          testBed.helper.validateDefinition(definition, definitionId);
        }).toThrow(new RegExp(`missing required property: ${property}`));
      }
    );

    it('should throw error when ID does not match', () => {
      const definitionId = 'test:definition';
      const definition = {
        id: 'different:id',
        components: {},
      };

      expect(() => {
        testBed.helper.validateDefinition(definition, definitionId);
      }).toThrow(/ID mismatch/);
    });

    it('should throw error when components is not an object', () => {
      const definitionId = 'test:definition';
      const definition = {
        id: definitionId,
        components: 'invalid',
      };

      expect(() => {
        testBed.helper.validateDefinition(definition, definitionId);
      }).toThrow(/invalid components structure/);
    });

    it('should allow components to be undefined', () => {
      const definitionId = 'test:definition';
      const definition = {
        id: definitionId,
        components: undefined,
      };

      expect(() => {
        testBed.helper.validateDefinition(definition, definitionId);
      }).not.toThrow();
    });
  });
});

describe('EntityDefinitionHelper - Edge Cases', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EntityDefinitionHelperTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should handle cache operations with undefined values gracefully', () => {
    const definitionId = 'test:definition';

    testBed.definitionCache.get.mockReturnValue(undefined);
    testBed.setupRegistryDefinition(definitionId, undefined);

    expect(() => {
      testBed.helper.getDefinitionForCreate(definitionId);
    }).toThrow(DefinitionNotFoundError);
  });

  it('should handle cache set operations with proper validation', () => {
    const definitionId = 'test:definition';
    const mockDefinition = testBed.createValidDefinition(definitionId);

    testBed.definitionCache.get.mockReturnValue(undefined);
    testBed.setupRegistryDefinition(definitionId, mockDefinition);

    testBed.helper.getDefinitionForCreate(definitionId);

    expect(testBed.definitionCache.set).toHaveBeenCalledWith(
      definitionId,
      mockDefinition
    );
  });

  it('should handle concurrent access patterns', () => {
    const definitionId = 'test:definition';
    const mockDefinition = testBed.createValidDefinition(definitionId);

    testBed.setupCacheDefinitions(new Map([[definitionId, mockDefinition]]));

    // Multiple concurrent access attempts
    const results = [
      testBed.helper.getDefinitionForCreate(definitionId),
      testBed.helper.getDefinitionForReconstruct(definitionId),
      testBed.helper.hasDefinition(definitionId),
    ];

    results.forEach((result) => {
      expect(result).toBeTruthy();
    });
  });

  it('should maintain cache consistency across operations', () => {
    const definitionIds = ['def1', 'def2'];
    const definitions = definitionIds.map((id) =>
      testBed.createValidDefinition(id)
    );

    // Preload one definition
    testBed.definitionCache.has.mockReturnValue(false);
    testBed.setupRegistryDefinition(definitionIds[0], definitions[0]);

    testBed.helper.preloadDefinitions([definitionIds[0]]);

    // Check it's now available via hasDefinition
    testBed.definitionCache.has.mockImplementation(
      (id) => id === definitionIds[0]
    );

    expect(testBed.helper.hasDefinition(definitionIds[0])).toBe(true);
    expect(testBed.helper.hasDefinition(definitionIds[1])).toBe(false);
  });
});
