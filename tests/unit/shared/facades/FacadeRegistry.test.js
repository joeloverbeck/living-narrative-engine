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

  beforeEach(() => {
    testBed = createTestBed();
    mockFactory = testBed.createMock('factory', ['getSingletonFacade', 'createFacade', 'registerFacade', 'isRegistered']);
    mockLogger = testBed.createMockLogger();
    const mockEventBus = testBed.createMock('eventBus', ['dispatch', 'subscribe']);

    registry = new FacadeRegistry({
      facadeFactory: mockFactory,
      eventBus: mockEventBus,
      logger: mockLogger
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
      const mockEventBus = testBed.createMock('eventBus', ['dispatch', 'subscribe']);
      expect(() => {
        new FacadeRegistry({
          facadeFactory: null,
          eventBus: mockEventBus,
          logger: mockLogger
        });
      }).toThrow('Missing required dependency: IFacadeFactory');
    });

    it('should throw error with invalid logger', () => {
      const mockEventBus = testBed.createMock('eventBus', ['dispatch', 'subscribe']);
      expect(() => {
        new FacadeRegistry({
          facadeFactory: mockFactory,
          eventBus: mockEventBus,
          logger: null
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
        tags: ['test']
      };
      const config = { timeout: 1000 };

      registry.register(metadata, config);

      expect(mockLogger.info).toHaveBeenCalledWith('Registered facade: TestFacade v1.0.0');
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

    it('should handle empty capabilities and tags', () => {
      const metadata = {
        name: 'TestFacade',
        version: '1.0.0',
        capabilities: [],
        tags: []
      };

      registry.register(metadata, {});

      expect(mockLogger.info).toHaveBeenCalledWith('Registered facade: TestFacade v1.0.0');
    });

    it('should normalize capabilities and tags to arrays', () => {
      const metadata = {
        name: 'TestFacade',
        version: '1.0.0'
      };

      registry.register(metadata, {});

      const registered = registry.getRegisteredFacades();
      expect(registered[0].capabilities).toEqual([]);
      expect(registered[0].tags).toEqual([]);
    });
  });

  describe('getFacade', () => {
    const mockFacade = { name: 'TestFacade' };

    beforeEach(() => {
      registry.register({
        name: 'TestFacade',
        version: '1.0.0',
        capabilities: ['query'],
        tags: ['test']
      }, { timeout: 1000 });
    });

    it('should get facade using singleton by default', () => {
      mockFactory.getSingletonFacade.mockReturnValue(mockFacade);

      const facade = registry.getFacade('TestFacade');

      expect(facade).toBe(mockFacade);
      expect(mockFactory.getSingletonFacade).toHaveBeenCalledWith('TestFacade', { timeout: 1000 });
    });

    it('should get facade with custom options', () => {
      mockFactory.getSingletonFacade.mockReturnValue(mockFacade);
      const options = { timeout: 2000, cacheEnabled: false };

      const facade = registry.getFacade('TestFacade', options);

      expect(facade).toBe(mockFacade);
      expect(mockFactory.getSingletonFacade).toHaveBeenCalledWith('TestFacade', options);
    });

    it('should create new instance when singleton disabled', () => {
      mockFactory.createFacade.mockReturnValue(mockFacade);
      const options = { singleton: false, timeout: 2000 };

      const facade = registry.getFacade('TestFacade', options);

      expect(facade).toBe(mockFacade);
      expect(mockFactory.createFacade).toHaveBeenCalledWith('TestFacade', { timeout: 2000 });
    });

    it('should merge config options with provided options', () => {
      mockFactory.getSingletonFacade.mockReturnValue(mockFacade);
      const options = { cacheEnabled: false };

      registry.getFacade('TestFacade', options);

      expect(mockFactory.getSingletonFacade).toHaveBeenCalledWith('TestFacade', {
        timeout: 1000,
        cacheEnabled: false
      });
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
      registry.register({
        name: 'ClothingFacade',
        version: '1.0.0',
        tags: ['clothing', 'equipment', 'core']
      }, {});

      registry.register({
        name: 'AnatomyFacade',
        version: '1.0.0',
        tags: ['anatomy', 'body', 'core']
      }, {});

      registry.register({
        name: 'TestFacade',
        version: '1.0.0',
        tags: ['test', 'mock']
      }, {});
    });

    it('should find facades with any matching tag', () => {
      const results = registry.searchByTags(['core', 'test']);

      expect(results).toHaveLength(3);
      expect(results.map(r => r.name)).toContain('ClothingFacade');
      expect(results.map(r => r.name)).toContain('AnatomyFacade');
      expect(results.map(r => r.name)).toContain('TestFacade');
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
      expect(results.map(r => r.name)).toContain('ClothingFacade');
      expect(results.map(r => r.name)).toContain('AnatomyFacade');
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
      registry.register({
        name: 'ClothingFacade',
        version: '1.0.0',
        capabilities: ['query', 'modify', 'validate']
      }, {});

      registry.register({
        name: 'AnatomyFacade',
        version: '1.0.0',
        capabilities: ['query', 'modify', 'graph', 'generate']
      }, {});

      registry.register({
        name: 'ReadOnlyFacade',
        version: '1.0.0',
        capabilities: ['query']
      }, {});
    });

    it('should find facades with all required capabilities', () => {
      const results = registry.findByCapabilities(['query', 'modify']);

      expect(results).toHaveLength(2);
      expect(results.map(r => r.name)).toContain('ClothingFacade');
      expect(results.map(r => r.name)).toContain('AnatomyFacade');
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
      registry.register({
        name: 'Facade1',
        version: '1.0.0'
      }, {});

      registry.register({
        name: 'Facade2',
        version: '2.0.0'
      }, {});

      const facades = registry.getRegisteredFacades();

      expect(facades).toHaveLength(2);
      expect(facades.map(f => f.name)).toContain('Facade1');
      expect(facades.map(f => f.name)).toContain('Facade2');
    });

    it('should return facade metadata and config', () => {
      const metadata = {
        name: 'TestFacade',
        version: '1.0.0',
        description: 'Test facade',
        capabilities: ['query'],
        tags: ['test']
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

  describe('isRegistered', () => {
    beforeEach(() => {
      registry.register({
        name: 'TestFacade',
        version: '1.0.0'
      }, {});
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
      registry.register({
        name: 'TestFacade',
        version: '1.0.0',
        capabilities: ['query', 'modify']
      }, {});
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
      registry.register({
        name: 'MinimalFacade',
        version: '1.0.0'
      }, {});

      const capabilities = registry.getCapabilities('MinimalFacade');

      expect(capabilities).toEqual([]);
    });
  });

  describe('getTags', () => {
    beforeEach(() => {
      registry.register({
        name: 'TestFacade',
        version: '1.0.0',
        tags: ['test', 'mock']
      }, {});
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
      registry.register({
        name: 'MinimalFacade',
        version: '1.0.0'
      }, {});

      const tags = registry.getTags('MinimalFacade');

      expect(tags).toEqual([]);
    });
  });

  describe('getFacadeInfo', () => {
    beforeEach(() => {
      registry.register({
        name: 'TestFacade',
        version: '1.0.0',
        description: 'Test facade for unit testing',
        capabilities: ['query', 'modify'],
        tags: ['test', 'mock']
      }, { timeout: 1000 });
    });

    it('should return complete facade info', () => {
      const info = registry.getFacadeInfo('TestFacade');

      expect(info).toEqual({
        name: 'TestFacade',
        version: '1.0.0',
        description: 'Test facade for unit testing',
        capabilities: ['query', 'modify'],
        tags: ['test', 'mock'],
        config: { timeout: 1000 }
      });
    });

    it('should return null for unregistered facade', () => {
      const info = registry.getFacadeInfo('UnregisteredFacade');

      expect(info).toBeNull();
    });
  });

  describe('complex search scenarios', () => {
    beforeEach(() => {
      registry.register({
        name: 'ClothingFacade',
        version: '1.0.0',
        capabilities: ['query', 'modify', 'validate', 'bulk'],
        tags: ['clothing', 'equipment', 'core', 'validated']
      }, {});

      registry.register({
        name: 'AnatomyFacade',
        version: '1.0.0',
        capabilities: ['query', 'modify', 'graph', 'generate', 'bulk'],
        tags: ['anatomy', 'body', 'core', 'generated']
      }, {});

      registry.register({
        name: 'TestFacade',
        version: '1.0.0',
        capabilities: ['query'],
        tags: ['test', 'mock']
      }, {});
    });

    it('should combine tag and capability searches', () => {
      // Find core facades that can modify
      const coreResults = registry.searchByTags(['core']);
      const modifyResults = registry.findByCapabilities(['modify']);
      
      const intersection = coreResults.filter(core =>
        modifyResults.some(modify => modify.name === core.name)
      );

      expect(intersection).toHaveLength(2);
      expect(intersection.map(r => r.name)).toContain('ClothingFacade');
      expect(intersection.map(r => r.name)).toContain('AnatomyFacade');
    });

    it('should find facades with bulk capabilities', () => {
      const bulkFacades = registry.findByCapabilities(['bulk']);

      expect(bulkFacades).toHaveLength(2);
      expect(bulkFacades.map(r => r.name)).toContain('ClothingFacade');
      expect(bulkFacades.map(r => r.name)).toContain('AnatomyFacade');
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