/**
 * @file Unit tests for TestScopeResolverRegistry
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import TestScopeResolverRegistry from '../../../common/engine/testScopeResolverRegistry.js';
import BaseScopeResolver from '../../../common/engine/baseScopeResolver.js';

// Mock resolver for testing
class MockResolver extends BaseScopeResolver {
  constructor(config) {
    super(config);
    this.resolveCalled = false;
  }

  resolve() {
    this.resolveCalled = true;
    return new Set(['entity1', 'entity2']);
  }
}

describe('TestScopeResolverRegistry', () => {
  let registry;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    registry = new TestScopeResolverRegistry({ logger: mockLogger });
  });

  describe('Constructor', () => {
    it('should create a registry with valid logger', () => {
      expect(registry).toBeInstanceOf(TestScopeResolverRegistry);
    });

    it('should throw error if logger is missing', () => {
      expect(() => {
        new TestScopeResolverRegistry({});
      }).toThrow('requires a logger');
    });

    it('should throw error if logger is null', () => {
      expect(() => {
        new TestScopeResolverRegistry({ logger: null });
      }).toThrow('requires a logger');
    });
  });

  describe('register()', () => {
    it('should register a valid resolver', () => {
      const resolver = new MockResolver({
        id: 'test:scope1',
        category: 'test',
        name: 'Test Scope 1',
      });

      registry.register(resolver);

      expect(registry.has('test:scope1')).toBe(true);
      expect(registry.get('test:scope1')).toBe(resolver);
    });

    it('should log debug message when registering', () => {
      const resolver = new MockResolver({
        id: 'test:scope1',
        category: 'test',
        name: 'Test Scope 1',
      });

      registry.register(resolver);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('test:scope1')
      );
    });

    it('should throw error for duplicate registration', () => {
      const resolver1 = new MockResolver({
        id: 'test:scope1',
        category: 'test',
        name: 'Test Scope 1',
      });

      const resolver2 = new MockResolver({
        id: 'test:scope1',
        category: 'test',
        name: 'Test Scope 1 Duplicate',
      });

      registry.register(resolver1);

      expect(() => {
        registry.register(resolver2);
      }).toThrow('already registered');
    });

    it('should warn if dependency is not yet registered', () => {
      const resolver = new MockResolver({
        id: 'test:scope1',
        category: 'test',
        name: 'Test Scope 1',
        dependencies: ['test:missing_dep'],
      });

      registry.register(resolver);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('not yet registered')
      );
    });

    it('should not warn if all dependencies are registered', () => {
      const dep = new MockResolver({
        id: 'test:dep',
        category: 'test',
        name: 'Dependency',
      });

      const resolver = new MockResolver({
        id: 'test:scope1',
        category: 'test',
        name: 'Test Scope 1',
        dependencies: ['test:dep'],
      });

      registry.register(dep);
      registry.register(resolver);

      // Check that warn was not called for dependencies
      const warnCalls = mockLogger.warn.mock.calls.filter((call) =>
        call[0].includes('not yet registered')
      );
      expect(warnCalls.length).toBe(0);
    });

    it('should throw error for invalid resolver (missing id)', () => {
      const invalidResolver = {
        category: 'test',
        name: 'Test',
        dependencies: [],
        resolve: () => new Set(),
        validate: () => true,
      };

      expect(() => {
        registry.register(invalidResolver);
      }).toThrow('Missing property: "id"');
    });

    it('should throw error for invalid resolver (missing resolve)', () => {
      const invalidResolver = {
        id: 'test:scope1',
        category: 'test',
        name: 'Test',
        dependencies: [],
        validate: () => true,
      };

      expect(() => {
        registry.register(invalidResolver);
      }).toThrow('Missing property: "resolve"');
    });

    it('should throw error if resolver.validate() fails', () => {
      class FailingResolver extends BaseScopeResolver {
        validate() {
          throw new Error('Custom validation error');
        }
      }

      const resolver = new FailingResolver({
        id: 'test:scope1',
        category: 'test',
        name: 'Test Scope 1',
      });

      expect(() => {
        registry.register(resolver);
      }).toThrow('failed its own validation');
    });
  });

  describe('registerBatch()', () => {
    it('should register multiple resolvers', () => {
      const resolvers = [
        new MockResolver({
          id: 'test:scope1',
          category: 'test',
          name: 'Test Scope 1',
        }),
        new MockResolver({
          id: 'test:scope2',
          category: 'test',
          name: 'Test Scope 2',
        }),
      ];

      registry.registerBatch(resolvers);

      expect(registry.has('test:scope1')).toBe(true);
      expect(registry.has('test:scope2')).toBe(true);
    });

    it('should throw error if input is not an array', () => {
      expect(() => {
        registry.registerBatch('not-array');
      }).toThrow('requires an array');
    });

    it('should register empty array without errors', () => {
      expect(() => {
        registry.registerBatch([]);
      }).not.toThrow();
    });
  });

  describe('get()', () => {
    it('should return resolver by ID', () => {
      const resolver = new MockResolver({
        id: 'test:scope1',
        category: 'test',
        name: 'Test Scope 1',
      });

      registry.register(resolver);

      expect(registry.get('test:scope1')).toBe(resolver);
    });

    it('should return null for non-existent scope', () => {
      expect(registry.get('test:nonexistent')).toBeNull();
    });
  });

  describe('getByCategory()', () => {
    it('should return resolvers by category', () => {
      const resolver1 = new MockResolver({
        id: 'positioning:scope1',
        category: 'positioning',
        name: 'Positioning Scope 1',
      });

      const resolver2 = new MockResolver({
        id: 'positioning:scope2',
        category: 'positioning',
        name: 'Positioning Scope 2',
      });

      const resolver3 = new MockResolver({
        id: 'inventory:scope1',
        category: 'inventory',
        name: 'Inventory Scope 1',
      });

      registry.registerBatch([resolver1, resolver2, resolver3]);

      const positioning = registry.getByCategory('positioning');
      expect(positioning).toHaveLength(2);
      expect(positioning).toContain(resolver1);
      expect(positioning).toContain(resolver2);
    });

    it('should return empty array for non-existent category', () => {
      expect(registry.getByCategory('nonexistent')).toEqual([]);
    });
  });

  describe('has()', () => {
    it('should return true for registered scope', () => {
      const resolver = new MockResolver({
        id: 'test:scope1',
        category: 'test',
        name: 'Test Scope 1',
      });

      registry.register(resolver);

      expect(registry.has('test:scope1')).toBe(true);
    });

    it('should return false for non-registered scope', () => {
      expect(registry.has('test:nonexistent')).toBe(false);
    });
  });

  describe('list()', () => {
    it('should return all registered scope IDs', () => {
      const resolvers = [
        new MockResolver({
          id: 'test:scope1',
          category: 'test',
          name: 'Test Scope 1',
        }),
        new MockResolver({
          id: 'test:scope2',
          category: 'test',
          name: 'Test Scope 2',
        }),
      ];

      registry.registerBatch(resolvers);

      const list = registry.list();
      expect(list).toContain('test:scope1');
      expect(list).toContain('test:scope2');
      expect(list).toHaveLength(2);
    });

    it('should return sorted list', () => {
      const resolvers = [
        new MockResolver({
          id: 'test:scope_z',
          category: 'test',
          name: 'Test Scope Z',
        }),
        new MockResolver({
          id: 'test:scope_a',
          category: 'test',
          name: 'Test Scope A',
        }),
      ];

      registry.registerBatch(resolvers);

      const list = registry.list();
      expect(list).toEqual(['test:scope_a', 'test:scope_z']);
    });

    it('should return empty array when no scopes registered', () => {
      expect(registry.list()).toEqual([]);
    });
  });

  describe('listByCategory()', () => {
    it('should return scopes organized by category', () => {
      const resolvers = [
        new MockResolver({
          id: 'positioning:scope1',
          category: 'positioning',
          name: 'Positioning Scope 1',
        }),
        new MockResolver({
          id: 'inventory:scope1',
          category: 'inventory',
          name: 'Inventory Scope 1',
        }),
      ];

      registry.registerBatch(resolvers);

      const byCategory = registry.listByCategory();
      expect(byCategory.positioning).toContain('positioning:scope1');
      expect(byCategory.inventory).toContain('inventory:scope1');
    });

    it('should return sorted scope IDs per category', () => {
      const resolvers = [
        new MockResolver({
          id: 'positioning:scope_z',
          category: 'positioning',
          name: 'Positioning Scope Z',
        }),
        new MockResolver({
          id: 'positioning:scope_a',
          category: 'positioning',
          name: 'Positioning Scope A',
        }),
      ];

      registry.registerBatch(resolvers);

      const byCategory = registry.listByCategory();
      expect(byCategory.positioning).toEqual([
        'positioning:scope_a',
        'positioning:scope_z',
      ]);
    });

    it('should return empty object when no scopes registered', () => {
      expect(registry.listByCategory()).toEqual({});
    });
  });

  describe('resolve()', () => {
    it('should resolve a registered scope', () => {
      const resolver = new MockResolver({
        id: 'test:scope1',
        category: 'test',
        name: 'Test Scope 1',
      });

      registry.register(resolver);

      const result = registry.resolve('test:scope1', {}, {});
      expect(result).toEqual(new Set(['entity1', 'entity2']));
      expect(resolver.resolveCalled).toBe(true);
    });

    it('should throw error for non-registered scope', () => {
      expect(() => {
        registry.resolve('test:nonexistent', {}, {});
      }).toThrow('No resolver registered');
    });

    it('should include available scopes in error message', () => {
      const resolver = new MockResolver({
        id: 'test:scope1',
        category: 'test',
        name: 'Test Scope 1',
      });

      registry.register(resolver);

      expect(() => {
        registry.resolve('test:nonexistent', {}, {});
      }).toThrow('test:scope1');

      expect(() => {
        registry.resolve('test:nonexistent', {}, {});
      }).toThrow('Available scopes');
    });

    it('should throw error if resolver.resolve() fails', () => {
      class FailingResolver extends BaseScopeResolver {
        resolve() {
          throw new Error('Resolution failed');
        }
      }

      const resolver = new FailingResolver({
        id: 'test:scope1',
        category: 'test',
        name: 'Test Scope 1',
      });

      registry.register(resolver);

      expect(() => {
        registry.resolve('test:scope1', {}, {});
      }).toThrow('Resolution failed');
    });

    it('should log error when resolution fails', () => {
      class FailingResolver extends BaseScopeResolver {
        resolve() {
          throw new Error('Resolution failed');
        }
      }

      const resolver = new FailingResolver({
        id: 'test:scope1',
        category: 'test',
        name: 'Test Scope 1',
      });

      registry.register(resolver);

      try {
        registry.resolve('test:scope1', {}, {});
      } catch {
        // Expected to throw
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to resolve'),
        expect.any(Error)
      );
    });
  });

  describe('clear()', () => {
    it('should clear all registrations', () => {
      const resolver = new MockResolver({
        id: 'test:scope1',
        category: 'test',
        name: 'Test Scope 1',
      });

      registry.register(resolver);
      expect(registry.has('test:scope1')).toBe(true);

      registry.clear();
      expect(registry.has('test:scope1')).toBe(false);
      expect(registry.list()).toEqual([]);
    });

    it('should clear category index', () => {
      const resolver = new MockResolver({
        id: 'test:scope1',
        category: 'test',
        name: 'Test Scope 1',
      });

      registry.register(resolver);
      expect(registry.getByCategory('test')).toHaveLength(1);

      registry.clear();
      expect(registry.getByCategory('test')).toEqual([]);
    });

    it('should log debug message', () => {
      registry.clear();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cleared all')
      );
    });
  });

  describe('count()', () => {
    it('should return count of registered resolvers', () => {
      expect(registry.count()).toBe(0);

      registry.register(
        new MockResolver({
          id: 'test:scope1',
          category: 'test',
          name: 'Test Scope 1',
        })
      );

      expect(registry.count()).toBe(1);

      registry.register(
        new MockResolver({
          id: 'test:scope2',
          category: 'test',
          name: 'Test Scope 2',
        })
      );

      expect(registry.count()).toBe(2);
    });

    it('should return 0 after clear', () => {
      registry.register(
        new MockResolver({
          id: 'test:scope1',
          category: 'test',
          name: 'Test Scope 1',
        })
      );

      registry.clear();
      expect(registry.count()).toBe(0);
    });
  });

  describe('Interface Validation', () => {
    it('should accept object with all required properties', () => {
      const validResolver = {
        id: 'test:scope1',
        category: 'test',
        name: 'Test Scope 1',
        dependencies: [],
        resolve: () => new Set(),
        validate: () => true,
      };

      expect(() => {
        registry.register(validResolver);
      }).not.toThrow();
    });

    it('should reject resolver with non-string id', () => {
      const invalidResolver = {
        id: 123,
        category: 'test',
        name: 'Test',
        dependencies: [],
        resolve: () => new Set(),
        validate: () => true,
      };

      expect(() => {
        registry.register(invalidResolver);
      }).toThrow('non-empty string');
    });

    it('should reject resolver with empty id', () => {
      const invalidResolver = {
        id: '',
        category: 'test',
        name: 'Test',
        dependencies: [],
        resolve: () => new Set(),
        validate: () => true,
      };

      expect(() => {
        registry.register(invalidResolver);
      }).toThrow('non-empty string');
    });

    it('should reject resolver with non-function resolve', () => {
      const invalidResolver = {
        id: 'test:scope1',
        category: 'test',
        name: 'Test',
        dependencies: [],
        resolve: 'not-a-function',
        validate: () => true,
      };

      expect(() => {
        registry.register(invalidResolver);
      }).toThrow('must be a function');
    });

    it('should reject resolver with non-array dependencies', () => {
      const invalidResolver = {
        id: 'test:scope1',
        category: 'test',
        name: 'Test',
        dependencies: 'not-array',
        resolve: () => new Set(),
        validate: () => true,
      };

      expect(() => {
        registry.register(invalidResolver);
      }).toThrow('must be an array');
    });

    it('should reject resolver with non-string dependency', () => {
      const invalidResolver = {
        id: 'test:scope1',
        category: 'test',
        name: 'Test',
        dependencies: ['valid:dep', 123],
        resolve: () => new Set(),
        validate: () => true,
      };

      expect(() => {
        registry.register(invalidResolver);
      }).toThrow('contain only strings');
    });
  });
});
