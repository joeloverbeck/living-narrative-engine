/**
 * @file tests/unit/scopeDsl/nodes/filterResolver.failFast.test.js
 * @description Tests for filter evaluation error handling behavior
 *
 * Validates that:
 * - condition_ref errors fail-fast (INV-EVAL-1 for configuration bugs)
 * - Non-condition_ref errors gracefully skip items (handle heterogeneous collections)
 */
import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import createFilterResolver from '../../../../src/scopeDsl/nodes/filterResolver.js';
import { ScopeResolutionError } from '../../../../src/scopeDsl/errors/scopeResolutionError.js';
import { ErrorCodes } from '../../../../src/scopeDsl/constants/errorCodes.js';

describe('filterResolver error handling behavior', () => {
  const ACTOR_ENTITY = {
    id: 'actor-1',
    components: {
      'core:position': { locationId: 'loc-actor' },
    },
  };

  const ENTITY_INSTANCE = {
    id: 'entity-1',
    components: {
      'core:position': { locationId: 'loc-actor' },
    },
    componentTypeIds: ['items-core:item'],
  };

  const baseNode = {
    type: 'Filter',
    parent: { type: 'Source' },
    logic: { '==': [{ var: 'entity.foo' }, 'bar'] },
  };

  /**
   * @param {object} overrides
   */
  function createCommonContext(overrides = {}) {
    return {
      actorEntity: { ...ACTOR_ENTITY },
      dispatcher: { resolve: jest.fn(() => new Set(['entity-1'])) },
      trace: { addLog: jest.fn() },
      runtimeCtx: {},
      scopeName: 'test-scope',
      ...overrides,
    };
  }

  /**
   * @param {object} overrides
   */
  function createCommonDeps(overrides = {}) {
    const logicEval = overrides.logicEval || {
      evaluate: jest.fn(() => true),
    };

    const entitiesGateway = overrides.entitiesGateway || {
      getEntityInstance: jest.fn((id) =>
        id === 'entity-1' ? { ...ENTITY_INSTANCE } : null
      ),
      getItemComponents: jest.fn(),
    };

    const locationProvider = overrides.locationProvider || {
      getLocation: jest.fn(() => ({ id: 'loc-actor' })),
    };

    return {
      logicEval,
      entitiesGateway,
      locationProvider,
      ...('errorHandler' in overrides
        ? { errorHandler: overrides.errorHandler }
        : {}),
    };
  }

  describe('condition_ref errors (fail-fast - INV-EVAL-1)', () => {
    it('should throw ScopeResolutionError for condition_ref resolution failures', () => {
      const logicEval = {
        evaluate: jest.fn(() => {
          throw new Error('Could not resolve condition_ref: missing_predicate');
        }),
      };

      const deps = createCommonDeps({ logicEval });
      const resolver = createFilterResolver(deps);
      const ctx = createCommonContext();

      expect(() => resolver.resolve(baseNode, ctx)).toThrow(
        /Could not resolve condition_ref/
      );
    });

    it('should throw ScopeResolutionError for condition phase errors', () => {
      const conditionError = new ScopeResolutionError('Condition resolution failed', {
        phase: 'condition_resolution',
        conditionId: 'test_condition',
      });
      conditionError.name = 'ScopeResolutionError';

      const logicEval = {
        evaluate: jest.fn(() => {
          throw conditionError;
        }),
      };

      const deps = createCommonDeps({ logicEval });
      const resolver = createFilterResolver(deps);
      const ctx = createCommonContext();

      expect(() => resolver.resolve(baseNode, ctx)).toThrow(ScopeResolutionError);
    });

    it('should use error handler for condition_ref errors when configured', () => {
      const errorHandler = {
        handleError: jest.fn(),
        getErrorBuffer: jest.fn(() => []),
      };

      const logicEval = {
        evaluate: jest.fn(() => {
          throw new Error('Could not resolve condition_ref: test_ref');
        }),
      };

      const deps = createCommonDeps({ logicEval, errorHandler });
      const resolver = createFilterResolver(deps);
      const ctx = createCommonContext();

      resolver.resolve(baseNode, ctx);

      expect(errorHandler.handleError).toHaveBeenCalledWith(
        expect.any(ScopeResolutionError),
        ctx,
        'FilterResolver',
        ErrorCodes.RESOLUTION_FAILED_GENERIC
      );
    });
  });

  describe('non-condition_ref errors (graceful skip)', () => {
    it('should gracefully skip items on TypeError during filter evaluation', () => {
      const logicEval = {
        evaluate: jest.fn(() => {
          throw new TypeError('Cannot read properties of undefined');
        }),
      };

      const deps = createCommonDeps({ logicEval });
      const resolver = createFilterResolver(deps);
      const ctx = createCommonContext();

      // Should NOT throw, just return empty set (item skipped)
      const result = resolver.resolve(baseNode, ctx);
      expect(result.size).toBe(0);
    });

    it('should gracefully skip items on ReferenceError during filter evaluation', () => {
      const logicEval = {
        evaluate: jest.fn(() => {
          throw new ReferenceError('undefinedVar is not defined');
        }),
      };

      const deps = createCommonDeps({ logicEval });
      const resolver = createFilterResolver(deps);
      const ctx = createCommonContext();

      // Should NOT throw, just return empty set (item skipped)
      const result = resolver.resolve(baseNode, ctx);
      expect(result.size).toBe(0);
    });

    it('should gracefully skip items on generic Error during filter evaluation', () => {
      const logicEval = {
        evaluate: jest.fn(() => {
          throw new Error('Some filter evaluation error');
        }),
      };

      const deps = createCommonDeps({ logicEval });
      const resolver = createFilterResolver(deps);
      const ctx = createCommonContext();

      // Should NOT throw, just return empty set (item skipped)
      const result = resolver.resolve(baseNode, ctx);
      expect(result.size).toBe(0);
    });

    it('should process remaining items after one fails', () => {
      let callCount = 0;
      const logicEval = {
        evaluate: jest.fn(() => {
          callCount++;
          if (callCount === 1) {
            throw new Error('First item fails');
          }
          return true; // Second item passes
        }),
      };

      const deps = createCommonDeps({ logicEval });
      const resolver = createFilterResolver(deps);
      const ctx = createCommonContext({
        dispatcher: { resolve: jest.fn(() => new Set(['entity-1', 'entity-2'])) },
      });

      // Should process both items, first fails (skipped), second passes
      const result = resolver.resolve(baseNode, ctx);
      expect(result.size).toBe(1);
      expect(result.has('entity-2')).toBe(true);
    });

    it('should handle heterogeneous collections gracefully', () => {
      // Simulates inventory with mixed item types (light sources, weapons, etc.)
      // Some items may lack components referenced in the filter
      let callCount = 0;
      const logicEval = {
        evaluate: jest.fn(() => {
          callCount++;
          // First two items don't have the component (throw), third passes
          if (callCount <= 2) {
            throw new Error('Cannot read properties of undefined');
          }
          return true;
        }),
      };

      const deps = createCommonDeps({ logicEval });
      const resolver = createFilterResolver(deps);
      const ctx = createCommonContext({
        dispatcher: { resolve: jest.fn(() => new Set(['weapon-1', 'clothing-1', 'light-1'])) },
      });

      // Only the light source (third item) should be in result
      const result = resolver.resolve(baseNode, ctx);
      expect(result.size).toBe(1);
      expect(result.has('light-1')).toBe(true);
    });
  });

  describe('with error handler configured (non-condition_ref errors)', () => {
    let errorHandler;

    beforeEach(() => {
      errorHandler = {
        handleError: jest.fn(),
        getErrorBuffer: jest.fn(() => []),
      };
    });

    it('should NOT call error handler for non-condition_ref errors (graceful skip)', () => {
      const logicEval = {
        evaluate: jest.fn(() => {
          throw new Error('Unexpected evaluation failure');
        }),
      };

      const deps = createCommonDeps({ logicEval, errorHandler });
      const resolver = createFilterResolver(deps);
      const ctx = createCommonContext();

      // With graceful skip, error handler is NOT called
      const result = resolver.resolve(baseNode, ctx);

      expect(result.size).toBe(0);
      expect(errorHandler.handleError).not.toHaveBeenCalled();
    });

    it('should still call error handler for condition_ref errors', () => {
      const logicEval = {
        evaluate: jest.fn(() => {
          throw new Error('Could not resolve condition_ref: missing_ref');
        }),
      };

      const deps = createCommonDeps({ logicEval, errorHandler });
      const resolver = createFilterResolver(deps);
      const ctx = createCommonContext();

      resolver.resolve(baseNode, ctx);

      expect(errorHandler.handleError).toHaveBeenCalledTimes(1);
      expect(errorHandler.handleError).toHaveBeenCalledWith(
        expect.any(ScopeResolutionError),
        ctx,
        'FilterResolver',
        ErrorCodes.RESOLUTION_FAILED_GENERIC
      );
    });
  });

  describe('backward compatibility', () => {
    it('should preserve condition_ref error handling behavior', () => {
      const logicEval = {
        evaluate: jest.fn(() => {
          throw new Error('Could not resolve condition_ref: missing_predicate');
        }),
      };

      const deps = createCommonDeps({ logicEval });
      const resolver = createFilterResolver(deps);
      const ctx = createCommonContext();

      // condition_ref errors still throw
      expect(() => resolver.resolve(baseNode, ctx)).toThrow(
        /Could not resolve condition_ref/
      );
    });

    it('should support all error types for graceful skip', () => {
      const errorTypes = [
        new Error('Generic error'),
        new TypeError('Type error'),
        new ReferenceError('Reference error'),
        new RangeError('Range error'),
      ];

      for (const errorToThrow of errorTypes) {
        const logicEval = {
          evaluate: jest.fn(() => {
            throw errorToThrow;
          }),
        };

        const deps = createCommonDeps({ logicEval });
        const resolver = createFilterResolver(deps);
        const ctx = createCommonContext();

        // All non-condition_ref errors should be gracefully skipped
        const result = resolver.resolve(baseNode, ctx);
        expect(result.size).toBe(0);
      }
    });
  });
});
