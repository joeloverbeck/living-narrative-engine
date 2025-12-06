/**
 * @file Unit tests for FacadeFactory
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import FacadeFactory from '../../../../src/shared/facades/FacadeFactory.js';

describe('FacadeFactory', () => {
  let testBed;
  let mockContainer;
  let mockRegistry;
  let mockLogger;
  let factory;

  beforeEach(() => {
    testBed = createTestBed();
    mockContainer = testBed.createMock('container', [
      'resolve',
      'isRegistered',
    ]);
    mockRegistry = testBed.createMock('registry', ['getFacade', 'register']);
    mockLogger = testBed.createMockLogger();

    // Setup container mocks for core dependencies
    mockContainer.resolve.mockImplementation((token) => {
      switch (token) {
        case 'ILogger':
          return mockLogger;
        case 'IEventBus':
          return { dispatch: jest.fn() };
        case 'IUnifiedCache':
          return { get: jest.fn(), set: jest.fn() };
        case 'ICircuitBreaker':
          return { execute: jest.fn() };
        default:
          return class MockFacade {
            constructor(options) {
              this.options = options;
            }
          };
      }
    });
    mockContainer.isRegistered.mockReturnValue(false); // Default to no circuit breaker

    factory = new FacadeFactory({
      container: mockContainer,
      registry: mockRegistry,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('constructor', () => {
    it('should create factory with valid dependencies', () => {
      expect(factory).toBeInstanceOf(FacadeFactory);
    });

    it('should throw error with invalid container', () => {
      expect(() => {
        new FacadeFactory({
          container: null,
          registry: mockRegistry,
          logger: mockLogger,
        });
      }).toThrow('Missing required dependency: IContainer');
    });

    it('should create with null registry', () => {
      expect(() => {
        new FacadeFactory({
          container: mockContainer,
          registry: null,
          logger: mockLogger,
        });
      }).not.toThrow();
    });

    it('should throw error with invalid logger', () => {
      expect(() => {
        new FacadeFactory({
          container: mockContainer,
          registry: mockRegistry,
          logger: null,
        });
      }).toThrow('Missing required dependency: ILogger');
    });
  });

  describe('createFacade', () => {
    const mockFacadeClass = class MockFacade {
      constructor(options) {
        this.options = options;
      }
    };

    beforeEach(() => {
      // Override the default mock to return the facade class for TestFacade
      mockContainer.resolve.mockImplementation((token) => {
        switch (token) {
          case 'ILogger':
            return mockLogger;
          case 'IEventBus':
            return { dispatch: jest.fn() };
          case 'IUnifiedCache':
            return { get: jest.fn(), set: jest.fn() };
          case 'ICircuitBreaker':
            return { execute: jest.fn() };
          case 'TestFacade':
            return mockFacadeClass;
          default:
            return mockFacadeClass;
        }
      });
    });

    it('should create new facade instance', () => {
      const options = { timeout: 1000 };

      const facade = factory.createFacade('TestFacade', options);

      expect(facade).toBeInstanceOf(mockFacadeClass);
      expect(facade.options.timeout).toBe(1000);
      expect(facade.options.logger).toBe(mockLogger);
      expect(facade.options.eventBus).toBeDefined();
      expect(facade.options.unifiedCache).toBeDefined();
      expect(facade.options.circuitBreaker).toBeNull();
      expect(mockContainer.resolve).toHaveBeenCalledWith('TestFacade');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Creating facade: TestFacade'
      );
    });

    it('should create facade with empty options', () => {
      const facade = factory.createFacade('TestFacade');

      expect(facade).toBeInstanceOf(mockFacadeClass);
      expect(facade.options.logger).toBe(mockLogger);
      expect(facade.options.eventBus).toBeDefined();
      expect(facade.options.unifiedCache).toBeDefined();
      expect(facade.options.circuitBreaker).toBeNull();
    });

    it('should handle facade creation failure', () => {
      const error = new Error('Container error');
      mockContainer.resolve.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        factory.createFacade('TestFacade');
      }).toThrow('Failed to create facade TestFacade: Container error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create facade: TestFacade',
        error
      );
    });

    it('should handle facade class instantiation failure', () => {
      const badFacadeClass = function () {
        throw new Error('Constructor error');
      };
      mockContainer.resolve.mockReturnValue(badFacadeClass);

      expect(() => {
        factory.createFacade('TestFacade');
      }).toThrow('Failed to create facade TestFacade: Constructor error');
    });
  });

  describe('getSingletonFacade', () => {
    const mockFacadeClass = class MockFacade {
      constructor(options) {
        this.options = options;
      }
    };

    beforeEach(() => {
      mockContainer.resolve.mockImplementation((token) => {
        switch (token) {
          case 'ILogger':
            return mockLogger;
          case 'IEventBus':
            return { dispatch: jest.fn() };
          case 'IUnifiedCache':
            return { get: jest.fn(), set: jest.fn() };
          case 'ICircuitBreaker':
            return { execute: jest.fn() };
          case 'TestFacade':
            return mockFacadeClass;
          default:
            return mockFacadeClass;
        }
      });
    });

    it('should create singleton facade on first call', () => {
      const options = { cacheEnabled: true };

      const facade = factory.getSingletonFacade('TestFacade', options);

      expect(facade).toBeInstanceOf(mockFacadeClass);
      expect(facade.options.cacheEnabled).toBe(true);
      expect(facade.options.logger).toBe(mockLogger);
      expect(facade.options.eventBus).toBeDefined();
      expect(facade.options.unifiedCache).toBeDefined();
      expect(facade.options.circuitBreaker).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Creating singleton facade: TestFacade'
      );
    });

    it('should return same instance on subsequent calls', () => {
      const facade1 = factory.getSingletonFacade('TestFacade');
      const facade2 = factory.getSingletonFacade('TestFacade');

      expect(facade1).toBe(facade2);
      // First call creates instance (resolves TestFacade + core deps = 4 calls)
      // Second call returns cached instance (no additional resolves)
      expect(mockContainer.resolve).toHaveBeenCalledTimes(4);
    });

    it('should create new instance with different options', () => {
      const facade1 = factory.getSingletonFacade('TestFacade', {
        timeout: 1000,
      });
      const facade2 = factory.getSingletonFacade('TestFacade', {
        timeout: 2000,
      });

      expect(facade1).not.toBe(facade2);
      expect(facade1.options.timeout).toBe(1000);
      expect(facade2.options.timeout).toBe(2000);
      // Both should have core dependencies
      expect(facade1.options.logger).toBe(mockLogger);
      expect(facade2.options.logger).toBe(mockLogger);
    });

    it('should use cached instance for same options', () => {
      const options = { timeout: 1000 };
      const facade1 = factory.getSingletonFacade('TestFacade', options);
      const facade2 = factory.getSingletonFacade('TestFacade', options);

      expect(facade1).toBe(facade2);
    });

    it('should handle singleton creation failure', () => {
      const error = new Error('Singleton error');
      mockContainer.resolve.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        factory.getSingletonFacade('TestFacade');
      }).toThrow('Failed to create facade TestFacade: Singleton error');
    });
  });

  describe('registerFacade', () => {
    it('should register facade configuration', () => {
      const config = {
        name: 'TestFacade',
        description: 'Test facade',
        version: '1.0.0',
        capabilities: ['query', 'modify'],
        tags: ['test', 'facade'],
      };

      factory.registerFacade(config);

      expect(mockRegistry.register).toHaveBeenCalledWith(
        {
          name: 'TestFacade',
          description: 'Test facade',
          version: '1.0.0',
          capabilities: ['query', 'modify'],
          tags: ['test', 'facade'],
        },
        config
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Registered facade: TestFacade'
      );
    });

    it('should handle registration failure', () => {
      const config = { name: 'TestFacade' };
      const error = new Error('Registration error');
      mockRegistry.register.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        factory.registerFacade(config);
      }).toThrow('Failed to register facade TestFacade: Registration error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to register facade: TestFacade',
        error
      );
    });

    it('should handle config without name', () => {
      const config = { description: 'Test facade' };

      expect(() => {
        factory.registerFacade(config);
      }).toThrow('Failed to register facade unknown: Facade name is required');
    });
  });

  describe('clearSingletonCache', () => {
    const mockFacadeClass = class MockFacade {
      constructor() {}
    };

    beforeEach(() => {
      mockContainer.resolve.mockReturnValue(mockFacadeClass);
    });

    it('should clear specific facade from cache', () => {
      // Create singleton
      const facade1 = factory.getSingletonFacade('TestFacade');

      // Clear cache
      factory.clearSingletonCache('TestFacade');

      // Get new instance
      const facade2 = factory.getSingletonFacade('TestFacade');

      expect(facade1).not.toBe(facade2);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cleared singleton cache for: TestFacade'
      );
    });

    it('should clear all facades from cache', () => {
      // Create multiple singletons
      factory.getSingletonFacade('TestFacade1');
      factory.getSingletonFacade('TestFacade2');

      // Clear all
      factory.clearSingletonCache();

      // Verify cache is cleared
      const facade1 = factory.getSingletonFacade('TestFacade1');
      const facade2 = factory.getSingletonFacade('TestFacade2');

      expect(mockContainer.resolve).toHaveBeenCalledTimes(16); // 2 creations * 4 calls each + 2 more creations * 4 calls each
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cleared all singleton cache'
      );
    });

    it('should handle clearing non-existent facade', () => {
      factory.clearSingletonCache('NonExistentFacade');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Cleared singleton cache for: NonExistentFacade'
      );
    });
  });

  describe('isRegistered', () => {
    it('should return true when facade is registered in container', () => {
      mockContainer.isRegistered.mockReturnValue(true);

      const result = factory.isRegistered('TestFacade');

      expect(result).toBe(true);
      expect(mockContainer.isRegistered).toHaveBeenCalledWith('TestFacade');
    });

    it('should return false when facade is not registered in container', () => {
      mockContainer.isRegistered.mockReturnValue(false);

      const result = factory.isRegistered('UnknownFacade');

      expect(result).toBe(false);
      expect(mockContainer.isRegistered).toHaveBeenCalledWith('UnknownFacade');
    });

    it('should return false and log debug when container throws error', () => {
      mockContainer.isRegistered.mockImplementation(() => {
        throw new Error('Container error');
      });

      const result = factory.isRegistered('ErrorFacade');

      expect(result).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Error checking if facade is registered: ErrorFacade',
        expect.any(Error)
      );
    });
  });

  describe('hasSingleton', () => {
    const mockFacadeClass = class MockFacade {
      constructor() {}
    };

    beforeEach(() => {
      mockContainer.resolve.mockReturnValue(mockFacadeClass);
    });

    it('should return false for non-cached facade', () => {
      expect(factory.hasSingleton('TestFacade')).toBe(false);
    });

    it('should return true for cached facade', () => {
      factory.getSingletonFacade('TestFacade');
      expect(factory.hasSingleton('TestFacade')).toBe(true);
    });

    it('should return false after cache clear', () => {
      factory.getSingletonFacade('TestFacade');
      factory.clearSingletonCache('TestFacade');
      expect(factory.hasSingleton('TestFacade')).toBe(false);
    });
  });

  describe('getCachedFacadeNames', () => {
    const mockFacadeClass = class MockFacade {
      constructor() {}
    };

    beforeEach(() => {
      mockContainer.resolve.mockReturnValue(mockFacadeClass);
    });

    it('should return empty array when no facades cached', () => {
      expect(factory.getCachedFacadeNames()).toEqual([]);
    });

    it('should return names of cached facades', () => {
      factory.getSingletonFacade('TestFacade1');
      factory.getSingletonFacade('TestFacade2');

      const names = factory.getCachedFacadeNames();
      expect(names).toHaveLength(2);
      expect(names).toContain('TestFacade1');
      expect(names).toContain('TestFacade2');
    });

    it('should update after cache operations', () => {
      factory.getSingletonFacade('TestFacade1');
      factory.getSingletonFacade('TestFacade2');

      expect(factory.getCachedFacadeNames()).toHaveLength(2);

      factory.clearSingletonCache('TestFacade1');

      const names = factory.getCachedFacadeNames();
      expect(names).toHaveLength(1);
      expect(names).toContain('TestFacade2');
    });
  });

  describe('cache key generation', () => {
    const mockFacadeClass = class MockFacade {
      constructor(options) {
        this.options = options;
      }
    };

    beforeEach(() => {
      mockContainer.resolve.mockImplementation((token) => {
        switch (token) {
          case 'ILogger':
            return mockLogger;
          case 'IEventBus':
            return { dispatch: jest.fn() };
          case 'IUnifiedCache':
            return { get: jest.fn(), set: jest.fn() };
          case 'ICircuitBreaker':
            return { execute: jest.fn() };
          case 'TestFacade':
            return mockFacadeClass;
          default:
            return mockFacadeClass;
        }
      });
    });

    it('should create different instances for different option values', () => {
      const facade1 = factory.getSingletonFacade('TestFacade', {
        timeout: 1000,
      });
      const facade2 = factory.getSingletonFacade('TestFacade', {
        timeout: 2000,
      });

      expect(facade1).not.toBe(facade2);
      expect(facade1.options.timeout).toBe(1000);
      expect(facade2.options.timeout).toBe(2000);
    });

    it('should create same instance for equivalent options', () => {
      const options1 = { timeout: 1000, enabled: true };
      const options2 = { timeout: 1000, enabled: true };

      const facade1 = factory.getSingletonFacade('TestFacade', options1);
      const facade2 = factory.getSingletonFacade('TestFacade', options2);

      expect(facade1).toBe(facade2);
    });

    it('should handle complex nested options', () => {
      const options1 = {
        timeout: 1000,
        cache: { ttl: 300, maxSize: 100 },
        features: ['a', 'b'],
      };
      const options2 = {
        timeout: 1000,
        cache: { ttl: 300, maxSize: 100 },
        features: ['a', 'b'],
      };

      const facade1 = factory.getSingletonFacade('TestFacade', options1);
      const facade2 = factory.getSingletonFacade('TestFacade', options2);

      expect(facade1).toBe(facade2);
    });

    it('should differentiate based on option order independence', () => {
      const options1 = { timeout: 1000, enabled: true };
      const options2 = { enabled: true, timeout: 1000 };

      const facade1 = factory.getSingletonFacade('TestFacade', options1);
      const facade2 = factory.getSingletonFacade('TestFacade', options2);

      expect(facade1).toBe(facade2);
    });
  });
});
