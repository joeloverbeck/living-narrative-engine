/**
 * @file Unit tests for FacadeRegistry
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import FacadeRegistry from '../../../../src/shared/facades/FacadeRegistry.js';

describe('FacadeRegistry', () => {
  let testBed;
  let mockFactory;
  let mockLogger;
  let registry;
  let mockEventBus;

  beforeEach(() => {
    testBed = createTestBed();
    mockFactory = testBed.createMock('factory', [
      'getSingletonFacade',
      'createFacade',
      'registerFacade',
      'isRegistered',
    ]);
    mockLogger = testBed.createMockLogger();
    mockEventBus = testBed.createMock('eventBus', ['dispatch', 'subscribe']);

    registry = new FacadeRegistry({
      facadeFactory: mockFactory,
      eventBus: mockEventBus,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('constructor', () => {
    it('should create registry with valid dependencies', () => {
      expect(registry).toBeInstanceOf(FacadeRegistry);
    });

    it('should throw error with invalid factory', () => {
      const mockEventBus = testBed.createMock('eventBus', [
        'dispatch',
        'subscribe',
      ]);
      expect(() => {
        new FacadeRegistry({
          facadeFactory: null,
          eventBus: mockEventBus,
          logger: mockLogger,
        });
      }).toThrow('Missing required dependency: IFacadeFactory');
    });

    it('should throw error with invalid logger', () => {
      const mockEventBus = testBed.createMock('eventBus', [
        'dispatch',
        'subscribe',
      ]);
      expect(() => {
        new FacadeRegistry({
          facadeFactory: mockFactory,
          eventBus: mockEventBus,
          logger: null,
        });
      }).toThrow('Missing required dependency: ILogger');
    });
  });

  describe('register', () => {
    it('should register facade with metadata', () => {
      const metadata = {
        name: 'TestFacade',
        description: 'Test facade',
        version: '1.0.0',
        capabilities: ['query', 'modify'],
        tags: ['test'],
      };
      const config = { timeout: 1000 };

      registry.register(metadata, config);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Registered facade: TestFacade v1.0.0'
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        'FACADE_REGISTERED',
        expect.objectContaining({
          name: 'TestFacade',
          version: '1.0.0',
        })
      );
    });

    it('should throw error for duplicate registration', () => {
      const metadata = { name: 'TestFacade', version: '1.0.0' };
      const config = {};

      registry.register(metadata, config);

      expect(() => {
        registry.register(metadata, config);
      }).toThrow('Facade TestFacade is already registered');
    });

    it('should require facade name', () => {
      const metadata = { description: 'Test facade' };

      expect(() => {
        registry.register(metadata, {});
      }).toThrow('Facade name is required');
    });

    it('should require facade version', () => {
      const metadata = { name: 'TestFacade' };

      expect(() => {
        registry.register(metadata, {});
      }).toThrow('Facade version is required');
    });

    it('should require metadata object', () => {
      expect(() => {
        registry.register(null, {});
      }).toThrow('Facade metadata must be an object');
    });

    it('should validate category type when provided', () => {
      expect(() => {
        registry.register(
          {
            name: 'InvalidCategoryFacade',
            version: '1.0.0',
            category: 123,
          },
          {}
        );
      }).toThrow('Facade category must be a string');
    });

    it('should validate description type when provided', () => {
      expect(() => {
        registry.register(
          {
            name: 'InvalidDescriptionFacade',
            version: '1.0.0',
            description: 42,
          },
          {}
        );
      }).toThrow('Facade description must be a string');
    });

    it('should require tags to be arrays when provided', () => {
      expect(() => {
        registry.register(
          {
            name: 'InvalidTagsFacade',
            version: '1.0.0',
            tags: 'tag',
          },
          {}
        );
      }).toThrow('Facade tags must be an array');
    });

    it('should require capabilities to be arrays when provided', () => {
      expect(() => {
        registry.register(
          {
            name: 'InvalidCapabilitiesFacade',
            version: '1.0.0',
            capabilities: 'capability',
          },
          {}
        );
      }).toThrow('Facade capabilities must be an array');
    });

    it('should validate singleton flag type when provided', () => {
      expect(() => {
        registry.register(
          {
            name: 'InvalidSingletonFacade',
            version: '1.0.0',
            singleton: 'yes',
          },
          {}
        );
      }).toThrow('Facade singleton flag must be boolean');
    });

    it('should handle empty capabilities and tags', () => {
      const metadata = {
        name: 'TestFacade',
        version: '1.0.0',
        capabilities: [],
        tags: [],
      };

      registry.register(metadata, {});

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Registered facade: TestFacade v1.0.0'
      );
    });

    it('should log and rethrow when factory registration fails', () => {
      const metadata = { name: 'BrokenFacade', version: '1.0.0' };
      const config = {};
      const error = new Error('Factory failure');
      mockFactory.registerFacade.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        registry.register(metadata, config);
      }).toThrow(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to register facade: BrokenFacade',
        error
      );
    });

    it('should normalize capabilities and tags to arrays', () => {
      const metadata = {
        name: 'TestFacade',
        version: '1.0.0',
      };

      registry.register(metadata, {});

      const registered = registry.getRegisteredFacades();
      expect(registered[0].capabilities).toEqual([]);
      expect(registered[0].tags).toEqual([]);
    });
  });

  describe('metadata accessors', () => {
    beforeEach(() => {
      registry.register(
        {
          name: 'MetaFacade',
          version: '1.0.0',
          description: 'Metadata fixture',
          category: 'core',
          capabilities: ['read'],
          tags: ['meta'],
        },
        { timeout: 50 }
      );
    });

    it('should return metadata for registered facade', () => {
      const metadata = registry.getMetadata('MetaFacade');

      expect(metadata.name).toBe('MetaFacade');
      expect(metadata.description).toBe('Metadata fixture');
    });

    it('should return null for unknown metadata lookup', () => {
      expect(registry.getMetadata('MissingFacade')).toBeNull();
    });

    it('should provide lists of all registered facades and categories', () => {
      const allFacades = registry.getAllFacades();
      const categories = registry.getCategories();

      expect(allFacades.map((f) => f.name)).toContain('MetaFacade');
      expect(categories).toEqual(['core']);
    });

    it('should return facades by category', () => {
      const facades = registry.getFacadesByCategory('core');

      expect(facades).toHaveLength(1);
      expect(facades[0].name).toBe('MetaFacade');
    });
  });

  describe('getFacade', () => {
    const mockFacade = { name: 'TestFacade' };

    beforeEach(() => {
      registry.register(
        {
          name: 'TestFacade',
          version: '1.0.0',
          capabilities: ['query'],
          tags: ['test'],
        },
        { timeout: 1000 }
      );
    });

    it('should get facade using singleton by default', () => {
      mockFactory.getSingletonFacade.mockReturnValue(mockFacade);

      const facade = registry.getFacade('TestFacade');

      expect(facade).toBe(mockFacade);
      expect(mockFactory.getSingletonFacade).toHaveBeenCalledWith(
        'TestFacade',
        { timeout: 1000 }
      );
    });

    it('should get facade with custom options', () => {
      mockFactory.getSingletonFacade.mockReturnValue(mockFacade);
      const options = { timeout: 2000, cacheEnabled: false };

      const facade = registry.getFacade('TestFacade', options);

      expect(facade).toBe(mockFacade);
      expect(mockFactory.getSingletonFacade).toHaveBeenCalledWith(
        'TestFacade',
        options
      );
    });

    it('should create new instance when singleton disabled', () => {
      mockFactory.createFacade.mockReturnValue(mockFacade);
      const options = { singleton: false, timeout: 2000 };

      const facade = registry.getFacade('TestFacade', options);

      expect(facade).toBe(mockFacade);
      expect(mockFactory.createFacade).toHaveBeenCalledWith('TestFacade', {
        timeout: 2000,
      });
    });

    it('should merge config options with provided options', () => {
      mockFactory.getSingletonFacade.mockReturnValue(mockFacade);
      const options = { cacheEnabled: false };

      registry.getFacade('TestFacade', options);

      expect(mockFactory.getSingletonFacade).toHaveBeenCalledWith(
        'TestFacade',
        {
          timeout: 1000,
          cacheEnabled: false,
        }
      );
    });

    it('should throw error for unregistered facade', () => {
      expect(() => {
        registry.getFacade('UnregisteredFacade');
      }).toThrow('Facade UnregisteredFacade is not registered');
    });

    it('should handle facade creation failure', () => {
      const error = new Error('Creation failed');
      mockFactory.getSingletonFacade.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        registry.getFacade('TestFacade');
      }).toThrow('Failed to get facade TestFacade: Creation failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get facade: TestFacade',
        error
      );
    });
  });

  describe('searchByTags', () => {
    beforeEach(() => {
      registry.register(
        {
          name: 'ClothingFacade',
          version: '1.0.0',
          tags: ['clothing', 'equipment', 'core'],
        },
        {}
      );

      registry.register(
        {
          name: 'AnatomyFacade',
          version: '1.0.0',
          tags: ['anatomy', 'body', 'core'],
        },
        {}
      );

      registry.register(
        {
          name: 'TestFacade',
          version: '1.0.0',
          tags: ['test', 'mock'],
        },
        {}
      );
    });

    it('should find facades with any matching tag', () => {
      const results = registry.searchByTags(['core', 'test']);

      expect(results).toHaveLength(3);
      expect(results.map((r) => r.name)).toContain('ClothingFacade');
      expect(results.map((r) => r.name)).toContain('AnatomyFacade');
      expect(results.map((r) => r.name)).toContain('TestFacade');
    });

    it('should find facades with all matching tags', () => {
      const results = registry.searchByTags(['core', 'clothing'], true);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('ClothingFacade');
    });

    it('should return empty array for no matches', () => {
      const results = registry.searchByTags(['nonexistent']);

      expect(results).toEqual([]);
    });

    it('should handle single tag string', () => {
      const results = registry.searchByTags('core');

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.name)).toContain('ClothingFacade');
      expect(results.map((r) => r.name)).toContain('AnatomyFacade');
    });

    it('should skip facades with invalid tag metadata structures', () => {
      const corrupted = registry.getMetadata('ClothingFacade');
      corrupted.tags = 'corrupted';

      const results = registry.searchByTags(['core']);

      expect(results.map((r) => r.name)).not.toContain('ClothingFacade');
    });

    it('should handle empty tags array', () => {
      const results = registry.searchByTags([]);

      expect(results).toEqual([]);
    });

    it('should be case sensitive', () => {
      const results = registry.searchByTags(['CORE']);

      expect(results).toEqual([]);
    });
  });

  describe('findByCapabilities', () => {
    beforeEach(() => {
      registry.register(
        {
          name: 'ClothingFacade',
          version: '1.0.0',
          capabilities: ['query', 'modify', 'validate'],
        },
        {}
      );

      registry.register(
        {
          name: 'AnatomyFacade',
          version: '1.0.0',
          capabilities: ['query', 'modify', 'graph', 'generate'],
        },
        {}
      );

      registry.register(
        {
          name: 'ReadOnlyFacade',
          version: '1.0.0',
          capabilities: ['query'],
        },
        {}
      );
    });

    it('should find facades with all required capabilities', () => {
      const results = registry.findByCapabilities(['query', 'modify']);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.name)).toContain('ClothingFacade');
      expect(results.map((r) => r.name)).toContain('AnatomyFacade');
    });

    it('should return empty array when no facades match', () => {
      const results = registry.findByCapabilities(['nonexistent']);

      expect(results).toEqual([]);
    });

    it('should handle single capability string', () => {
      const results = registry.findByCapabilities('query');

      expect(results).toHaveLength(3);
    });

    it('should handle facades with exact capability match', () => {
      const results = registry.findByCapabilities(['query']);

      expect(results).toHaveLength(3);
    });

    it('should skip facades with invalid capability metadata structures', () => {
      const corrupted = registry.getMetadata('ClothingFacade');
      corrupted.capabilities = 'broken';

      const results = registry.findByCapabilities(['query']);

      expect(results.map((r) => r.name)).not.toContain('ClothingFacade');
    });

    it('should require all capabilities to be present', () => {
      const results = registry.findByCapabilities(['query', 'modify', 'graph']);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('AnatomyFacade');
    });

    it('should handle empty capabilities array', () => {
      const results = registry.findByCapabilities([]);

      expect(results).toHaveLength(3); // All facades match empty requirements
    });
  });

  describe('getRegisteredFacades', () => {
    it('should return empty array when no facades registered', () => {
      const facades = registry.getRegisteredFacades();

      expect(facades).toEqual([]);
    });

    it('should return all registered facades', () => {
      registry.register(
        {
          name: 'Facade1',
          version: '1.0.0',
        },
        {}
      );

      registry.register(
        {
          name: 'Facade2',
          version: '2.0.0',
        },
        {}
      );

      const facades = registry.getRegisteredFacades();

      expect(facades).toHaveLength(2);
      expect(facades.map((f) => f.name)).toContain('Facade1');
      expect(facades.map((f) => f.name)).toContain('Facade2');
    });

    it('should return facade metadata and config', () => {
      const metadata = {
        name: 'TestFacade',
        version: '1.0.0',
        description: 'Test facade',
        capabilities: ['query'],
        tags: ['test'],
      };
      const config = { timeout: 1000 };

      registry.register(metadata, config);

      const facades = registry.getRegisteredFacades();
      const facade = facades[0];

      expect(facade.name).toBe('TestFacade');
      expect(facade.version).toBe('1.0.0');
      expect(facade.description).toBe('Test facade');
      expect(facade.capabilities).toEqual(['query']);
      expect(facade.tags).toEqual(['test']);
      expect(facade.config).toEqual(config);
    });
  });

  describe('category and lifecycle management', () => {
    beforeEach(() => {
      registry.register(
        {
          name: 'LifecycleFacade',
          version: '1.0.0',
          category: 'lifecycle',
        },
        {}
      );
      mockEventBus.dispatch.mockClear();
      mockLogger.info.mockClear();
      mockLogger.warn.mockClear();
    });

    it('should unregister facade and clean category index', () => {
      registry.unregister('LifecycleFacade');

      expect(registry.isRegistered('LifecycleFacade')).toBe(false);
      expect(registry.getFacadesByCategory('lifecycle')).toEqual([]);
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'FACADE_UNREGISTERED',
        payload: { name: 'LifecycleFacade', category: 'lifecycle' },
        timestamp: expect.any(Number),
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Unregistered facade: LifecycleFacade',
        { category: 'lifecycle' }
      );
    });

    it('should warn when unregistering unknown facade', () => {
      registry.unregister('UnknownFacade');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Attempted to unregister unknown facade: UnknownFacade'
      );
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();
    });

    it('should log and rethrow errors that occur during unregister', () => {
      const error = new Error('dispatch failed');
      mockEventBus.dispatch.mockImplementation(() => {
        throw error;
      });

      expect(() => registry.unregister('LifecycleFacade')).toThrow(error);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to unregister facade: LifecycleFacade',
        error
      );
    });

    it('should provide registry statistics', () => {
      const stats = registry.getStatistics();

      expect(stats).toMatchObject({
        totalFacades: 1,
        categories: 1,
        singletonInstances: 0,
        facadesByCategory: { lifecycle: 1 },
      });
    });

    it('should handle singleton clearing without stored instances', () => {
      registry.clearSingleton('LifecycleFacade');
      expect(mockEventBus.dispatch).not.toHaveBeenCalled();

      registry.clearAllSingletons();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleared 0 singleton facade instances'
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'FACADE_SINGLETONS_CLEARED',
        payload: { count: 0, names: [] },
        timestamp: expect.any(Number),
      });
    });

    it('should clear singleton instances and dispatch events when present', () => {
      const facadeInstance = { name: 'LifecycleFacade' };
      mockFactory.getSingletonFacade.mockReturnValue(facadeInstance);

      registry.getFacade('LifecycleFacade');

      mockEventBus.dispatch.mockClear();
      mockLogger.debug.mockClear();

      registry.clearSingleton('LifecycleFacade');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cleared singleton facade: LifecycleFacade'
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'FACADE_SINGLETON_CLEARED',
        payload: { name: 'LifecycleFacade' },
        timestamp: expect.any(Number),
      });
    });

    it('should clear all singleton instances and report cleared names', () => {
      const facadeInstance = { name: 'LifecycleFacade' };
      mockFactory.getSingletonFacade.mockReturnValue(facadeInstance);

      registry.getFacade('LifecycleFacade');

      mockEventBus.dispatch.mockClear();
      mockLogger.info.mockClear();

      registry.clearAllSingletons();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cleared 1 singleton facade instances'
      );
      expect(mockEventBus.dispatch).toHaveBeenCalledWith({
        type: 'FACADE_SINGLETONS_CLEARED',
        payload: { count: 1, names: ['LifecycleFacade'] },
        timestamp: expect.any(Number),
      });
    });
  });

  describe('isRegistered', () => {
    beforeEach(() => {
      registry.register(
        {
          name: 'TestFacade',
          version: '1.0.0',
        },
        {}
      );
    });

    it('should return true for registered facade', () => {
      expect(registry.isRegistered('TestFacade')).toBe(true);
    });

    it('should return false for unregistered facade', () => {
      expect(registry.isRegistered('UnregisteredFacade')).toBe(false);
    });

    it('should handle null/undefined facade name', () => {
      expect(registry.isRegistered(null)).toBe(false);
      expect(registry.isRegistered(undefined)).toBe(false);
    });
  });

  describe('getCapabilities', () => {
    beforeEach(() => {
      registry.register(
        {
          name: 'TestFacade',
          version: '1.0.0',
          capabilities: ['query', 'modify'],
        },
        {}
      );
    });

    it('should return capabilities for registered facade', () => {
      const capabilities = registry.getCapabilities('TestFacade');

      expect(capabilities).toEqual(['query', 'modify']);
    });

    it('should return empty array for unregistered facade', () => {
      const capabilities = registry.getCapabilities('UnregisteredFacade');

      expect(capabilities).toEqual([]);
    });

    it('should return empty array for facade without capabilities', () => {
      registry.register(
        {
          name: 'MinimalFacade',
          version: '1.0.0',
        },
        {}
      );

      const capabilities = registry.getCapabilities('MinimalFacade');

      expect(capabilities).toEqual([]);
    });
  });

  describe('getTags', () => {
    beforeEach(() => {
      registry.register(
        {
          name: 'TestFacade',
          version: '1.0.0',
          tags: ['test', 'mock'],
        },
        {}
      );
    });

    it('should return tags for registered facade', () => {
      const tags = registry.getTags('TestFacade');

      expect(tags).toEqual(['test', 'mock']);
    });

    it('should return empty array for unregistered facade', () => {
      const tags = registry.getTags('UnregisteredFacade');

      expect(tags).toEqual([]);
    });

    it('should return empty array for facade without tags', () => {
      registry.register(
        {
          name: 'MinimalFacade',
          version: '1.0.0',
        },
        {}
      );

      const tags = registry.getTags('MinimalFacade');

      expect(tags).toEqual([]);
    });
  });

  describe('getFacadeInfo', () => {
    beforeEach(() => {
      registry.register(
        {
          name: 'TestFacade',
          version: '1.0.0',
          description: 'Test facade for unit testing',
          capabilities: ['query', 'modify'],
          tags: ['test', 'mock'],
        },
        { timeout: 1000 }
      );
    });

    it('should return complete facade info', () => {
      const info = registry.getFacadeInfo('TestFacade');

      expect(info).toEqual({
        name: 'TestFacade',
        version: '1.0.0',
        description: 'Test facade for unit testing',
        capabilities: ['query', 'modify'],
        tags: ['test', 'mock'],
        config: { timeout: 1000 },
      });
    });

    it('should return null for unregistered facade', () => {
      const info = registry.getFacadeInfo('UnregisteredFacade');

      expect(info).toBeNull();
    });
  });

  describe('complex search scenarios', () => {
    beforeEach(() => {
      registry.register(
        {
          name: 'ClothingFacade',
          version: '1.0.0',
          capabilities: ['query', 'modify', 'validate', 'bulk'],
          tags: ['clothing', 'equipment', 'core', 'validated'],
        },
        {}
      );

      registry.register(
        {
          name: 'AnatomyFacade',
          version: '1.0.0',
          capabilities: ['query', 'modify', 'graph', 'generate', 'bulk'],
          tags: ['anatomy', 'body', 'core', 'generated'],
        },
        {}
      );

      registry.register(
        {
          name: 'TestFacade',
          version: '1.0.0',
          capabilities: ['query'],
          tags: ['test', 'mock'],
        },
        {}
      );
    });

    it('should combine tag and capability searches', () => {
      // Find core facades that can modify
      const coreResults = registry.searchByTags(['core']);
      const modifyResults = registry.findByCapabilities(['modify']);

      const intersection = coreResults.filter((core) =>
        modifyResults.some((modify) => modify.name === core.name)
      );

      expect(intersection).toHaveLength(2);
      expect(intersection.map((r) => r.name)).toContain('ClothingFacade');
      expect(intersection.map((r) => r.name)).toContain('AnatomyFacade');
    });

    it('should find facades with bulk capabilities', () => {
      const bulkFacades = registry.findByCapabilities(['bulk']);

      expect(bulkFacades).toHaveLength(2);
      expect(bulkFacades.map((r) => r.name)).toContain('ClothingFacade');
      expect(bulkFacades.map((r) => r.name)).toContain('AnatomyFacade');
    });

    it('should differentiate between similar capabilities', () => {
      const validateFacades = registry.findByCapabilities(['validate']);
      const generateFacades = registry.findByCapabilities(['generate']);

      expect(validateFacades).toHaveLength(1);
      expect(validateFacades[0].name).toBe('ClothingFacade');

      expect(generateFacades).toHaveLength(1);
      expect(generateFacades[0].name).toBe('AnatomyFacade');
    });
  });
});
