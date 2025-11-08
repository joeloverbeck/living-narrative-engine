/**
 * @file Unit tests for BaseScopeResolver
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import BaseScopeResolver from '../../../common/engine/baseScopeResolver.js';

describe('BaseScopeResolver', () => {
  describe('Constructor', () => {
    it('should create a resolver with valid configuration', () => {
      const resolver = new BaseScopeResolver({
        id: 'test:scope',
        category: 'test',
        name: 'Test Scope',
        dependencies: [],
      });

      expect(resolver.id).toBe('test:scope');
      expect(resolver.category).toBe('test');
      expect(resolver.name).toBe('Test Scope');
      expect(resolver.dependencies).toEqual([]);
    });

    it('should create a resolver with dependencies', () => {
      const resolver = new BaseScopeResolver({
        id: 'test:scope',
        category: 'test',
        name: 'Test Scope',
        dependencies: ['test:dep1', 'test:dep2'],
      });

      expect(resolver.dependencies).toEqual(['test:dep1', 'test:dep2']);
    });

    it('should throw error if id is missing', () => {
      expect(() => {
        new BaseScopeResolver({
          category: 'test',
          name: 'Test Scope',
        });
      }).toThrow('valid id');
    });

    it('should throw error if id is not a string', () => {
      expect(() => {
        new BaseScopeResolver({
          id: 123,
          category: 'test',
          name: 'Test Scope',
        });
      }).toThrow('valid id');
    });

    it('should throw error if category is missing', () => {
      expect(() => {
        new BaseScopeResolver({
          id: 'test:scope',
          name: 'Test Scope',
        });
      }).toThrow('valid category');
    });

    it('should throw error if name is missing', () => {
      expect(() => {
        new BaseScopeResolver({
          id: 'test:scope',
          category: 'test',
        });
      }).toThrow('valid name');
    });

    it('should throw error if dependencies is not an array', () => {
      expect(() => {
        new BaseScopeResolver({
          id: 'test:scope',
          category: 'test',
          name: 'Test Scope',
          dependencies: 'not-array',
        });
      }).toThrow('dependencies must be an array');
    });
  });

  describe('Getters', () => {
    let resolver;

    beforeEach(() => {
      resolver = new BaseScopeResolver({
        id: 'test:scope',
        category: 'test',
        name: 'Test Scope',
        dependencies: ['test:dep1'],
      });
    });

    it('should expose id via getter', () => {
      expect(resolver.id).toBe('test:scope');
    });

    it('should expose category via getter', () => {
      expect(resolver.category).toBe('test');
    });

    it('should expose name via getter', () => {
      expect(resolver.name).toBe('Test Scope');
    });

    it('should expose dependencies via getter', () => {
      expect(resolver.dependencies).toEqual(['test:dep1']);
    });
  });

  describe('resolve()', () => {
    it('should throw error when not implemented', () => {
      const resolver = new BaseScopeResolver({
        id: 'test:scope',
        category: 'test',
        name: 'Test Scope',
      });

      expect(() => {
        resolver.resolve({}, {});
      }).toThrow('resolve() must be implemented');
    });

    it('should include class name in error message', () => {
      class TestResolver extends BaseScopeResolver {}
      const resolver = new TestResolver({
        id: 'test:scope',
        category: 'test',
        name: 'Test Scope',
      });

      expect(() => {
        resolver.resolve({}, {});
      }).toThrow('TestResolver');
    });
  });

  describe('validate()', () => {
    it('should return true for valid resolver', () => {
      const resolver = new BaseScopeResolver({
        id: 'test:scope',
        category: 'test',
        name: 'Test Scope',
      });

      expect(resolver.validate()).toBe(true);
    });

    it('should validate after construction', () => {
      // Constructor calls validation, so if it doesn't throw, validation passed
      expect(() => {
        new BaseScopeResolver({
          id: 'test:scope',
          category: 'test',
          name: 'Test Scope',
        });
      }).not.toThrow();
    });
  });

  describe('_ensureSet()', () => {
    let resolver;

    beforeEach(() => {
      resolver = new BaseScopeResolver({
        id: 'test:scope',
        category: 'test',
        name: 'Test Scope',
      });
    });

    it('should return Set as-is', () => {
      const input = new Set(['a', 'b', 'c']);
      const result = resolver._ensureSet(input);

      expect(result).toBe(input);
      expect(result).toEqual(new Set(['a', 'b', 'c']));
    });

    it('should convert array to Set', () => {
      const input = ['a', 'b', 'c'];
      const result = resolver._ensureSet(input);

      expect(result).toBeInstanceOf(Set);
      expect(result).toEqual(new Set(['a', 'b', 'c']));
    });

    it('should remove duplicates when converting array', () => {
      const input = ['a', 'b', 'a', 'c', 'b'];
      const result = resolver._ensureSet(input);

      expect(result).toEqual(new Set(['a', 'b', 'c']));
    });

    it('should throw error for non-Set, non-Array values', () => {
      expect(() => {
        resolver._ensureSet('not-a-set');
      }).toThrow('must return a Set or Array');
    });

    it('should throw error for null', () => {
      expect(() => {
        resolver._ensureSet(null);
      }).toThrow('must return a Set or Array');
    });

    it('should throw error for undefined', () => {
      expect(() => {
        resolver._ensureSet(undefined);
      }).toThrow('must return a Set or Array');
    });

    it('should throw error for objects', () => {
      expect(() => {
        resolver._ensureSet({ a: 1 });
      }).toThrow('must return a Set or Array');
    });
  });

  describe('_validateContext()', () => {
    let resolver;

    beforeEach(() => {
      resolver = new BaseScopeResolver({
        id: 'test:scope',
        category: 'test',
        name: 'Test Scope',
      });
    });

    it('should not throw for valid context', () => {
      const context = { actor: 'entity1', target: 'entity2' };
      expect(() => {
        resolver._validateContext(context, ['actor', 'target']);
      }).not.toThrow();
    });

    it('should not throw for empty required properties', () => {
      const context = { actor: 'entity1' };
      expect(() => {
        resolver._validateContext(context, []);
      }).not.toThrow();
    });

    it('should throw if context is not an object', () => {
      expect(() => {
        resolver._validateContext('not-object', ['actor']);
      }).toThrow('requires context object');
    });

    it('should throw if context is null', () => {
      expect(() => {
        resolver._validateContext(null, ['actor']);
      }).toThrow('requires context object');
    });

    it('should throw if required property is missing', () => {
      const context = { actor: 'entity1' };
      expect(() => {
        resolver._validateContext(context, ['actor', 'target']);
      }).toThrow('requires context.target');
    });
  });

  describe('_validateRuntimeContext()', () => {
    let resolver;

    beforeEach(() => {
      resolver = new BaseScopeResolver({
        id: 'test:scope',
        category: 'test',
        name: 'Test Scope',
      });
    });

    it('should not throw for valid runtime context', () => {
      const runtimeCtx = {
        entityManager: {},
        logger: {},
      };
      expect(() => {
        resolver._validateRuntimeContext(runtimeCtx, [
          'entityManager',
          'logger',
        ]);
      }).not.toThrow();
    });

    it('should not throw for empty required services', () => {
      const runtimeCtx = { entityManager: {} };
      expect(() => {
        resolver._validateRuntimeContext(runtimeCtx, []);
      }).not.toThrow();
    });

    it('should throw if runtime context is not an object', () => {
      expect(() => {
        resolver._validateRuntimeContext('not-object', ['entityManager']);
      }).toThrow('requires runtimeCtx object');
    });

    it('should throw if runtime context is null', () => {
      expect(() => {
        resolver._validateRuntimeContext(null, ['entityManager']);
      }).toThrow('requires runtimeCtx object');
    });

    it('should throw if required service is missing', () => {
      const runtimeCtx = { entityManager: {} };
      expect(() => {
        resolver._validateRuntimeContext(runtimeCtx, [
          'entityManager',
          'logger',
        ]);
      }).toThrow('requires runtimeCtx.logger');
    });
  });

  describe('Subclass Implementation', () => {
    it('should allow subclass to implement resolve()', () => {
      class TestResolver extends BaseScopeResolver {
        resolve() {
          return new Set(['entity1', 'entity2']);
        }
      }

      const resolver = new TestResolver({
        id: 'test:scope',
        category: 'test',
        name: 'Test Scope',
      });

      const result = resolver.resolve({}, {});
      expect(result).toEqual(new Set(['entity1', 'entity2']));
    });

    it('should allow subclass to override validate()', () => {
      class TestResolver extends BaseScopeResolver {
        validate() {
          super.validate();
          // Add custom validation
          if (this.id !== 'test:scope') {
            throw new Error('Invalid test scope ID');
          }
          return true;
        }
      }

      const resolver = new TestResolver({
        id: 'test:scope',
        category: 'test',
        name: 'Test Scope',
      });

      expect(resolver.validate()).toBe(true);
    });

    it('should allow subclass to use helper methods', () => {
      class TestResolver extends BaseScopeResolver {
        resolve(ctx, runtimeCtx) {
          this._validateContext(ctx, ['actor']);
          this._validateRuntimeContext(runtimeCtx, ['entityManager']);
          return this._ensureSet(['entity1']);
        }
      }

      const resolver = new TestResolver({
        id: 'test:scope',
        category: 'test',
        name: 'Test Scope',
      });

      const result = resolver.resolve(
        { actor: 'entity1' },
        { entityManager: {} }
      );
      expect(result).toEqual(new Set(['entity1']));
    });
  });
});
