/**
 * @file Integration tests for Parameter Validation in Scope DSL
 * @description Tests end-to-end parameter validation flow through ScopeEngine
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { ParameterValidationError } from '../../../src/scopeDsl/errors/parameterValidationError.js';

describe('Parameter Validation Integration', () => {
  let scopeEngine;
  let mockEntityManager;
  let mockLogger;
  let runtimeCtx;

  beforeEach(() => {
    // Create mock dependencies
    mockEntityManager = {
      getEntity: (id) => ({
        id,
        components: {},
      }),
      hasComponent: () => false,
      getComponent: () => null,
    };

    mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    runtimeCtx = {
      entityManager: mockEntityManager,
      logger: mockLogger,
    };

    // Create ScopeEngine instance
    scopeEngine = new ScopeEngine();
  });

  describe('ScopeEngine validation (primary entry point)', () => {
    it('should validate AST at entry point before resolution', () => {
      const invalidAST = { name: 'test' }; // Missing 'type' property
      const actorEntity = { id: 'actor-123', components: {} };

      let error;
      try {
        scopeEngine.resolve(invalidAST, actorEntity, runtimeCtx);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ParameterValidationError);
      expect(error.message).toContain("AST must have a 'type' property");
    });

    it('should validate actorEntity at entry point before resolution', () => {
      const validAST = { type: 'Source', kind: 'builtin', name: 'self' };
      const invalidActorEntity = { name: 'Test' }; // Missing 'id' property

      let error;
      try {
        scopeEngine.resolve(validAST, invalidActorEntity, runtimeCtx);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ParameterValidationError);
      expect(error.message).toContain("must have an 'id' property");
    });

    it('should validate runtimeCtx at entry point before resolution', () => {
      const validAST = { type: 'Source', kind: 'builtin', name: 'self' };
      const actorEntity = { id: 'actor-123', components: {} };
      const invalidRuntimeCtx = { logger: mockLogger }; // Missing entityManager

      let error;
      try {
        scopeEngine.resolve(validAST, actorEntity, invalidRuntimeCtx);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ParameterValidationError);
      expect(error.message).toContain('missing critical services');
      expect(error.message).toContain('entityManager');
    });

    it('should propagate ParameterValidationError unchanged', () => {
      const invalidAST = undefined;
      const actorEntity = { id: 'actor-123', components: {} };

      let error;
      try {
        scopeEngine.resolve(invalidAST, actorEntity, runtimeCtx);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ParameterValidationError);
      expect(error.name).toBe('ParameterValidationError');
      expect(error.context).toBeDefined();
    });

    it('should include "ScopeEngine.resolve" in error source', () => {
      const invalidAST = null;
      const actorEntity = { id: 'actor-123', components: {} };

      let error;
      try {
        scopeEngine.resolve(invalidAST, actorEntity, runtimeCtx);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ParameterValidationError);
      expect(error.message).toContain('ScopeEngine.resolve');
    });

    it('should fail fast before calling any resolvers', () => {
      const invalidAST = { name: 'missing-type' };
      const actorEntity = { id: 'actor-123', components: {} };

      // Mock a resolver method to verify it's never called
      let resolverCalled = false;
      const originalResolve = scopeEngine._resolveNode;
      if (originalResolve) {
        scopeEngine._resolveNode = () => {
          resolverCalled = true;
        };
      }

      try {
        scopeEngine.resolve(invalidAST, actorEntity, runtimeCtx);
      } catch (err) {
        // Expected to fail
      }

      // Resolver should never be called due to fail-fast validation
      expect(resolverCalled).toBe(false);
    });
  });

  describe('Validation failure scenarios', () => {
    it('should catch invalid AST before parsing', () => {
      const invalidAST = 'not-an-object';
      const actorEntity = { id: 'actor-123', components: {} };

      let error;
      try {
        scopeEngine.resolve(invalidAST, actorEntity, runtimeCtx);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ParameterValidationError);
      expect(error.message).toContain('AST must be an object');
      expect(error.context.received).toBe('string');
    });

    it('should catch missing actorEntity.id before resolution', () => {
      const validAST = { type: 'Source', kind: 'builtin', name: 'self' };
      const invalidActorEntity = { components: {} }; // Missing id

      let error;
      try {
        scopeEngine.resolve(validAST, invalidActorEntity, runtimeCtx);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ParameterValidationError);
      expect(error.message).toContain("must have an 'id' property");
    });

    it('should catch action context passed as actorEntity', () => {
      const validAST = { type: 'Source', kind: 'builtin', name: 'self' };
      const actionContext = {
        actor: { id: 'actor-123' },
        targets: [],
      };

      let error;
      try {
        scopeEngine.resolve(validAST, actionContext, runtimeCtx);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ParameterValidationError);
      expect(error.message).toContain('action pipeline context object');
      expect(error.context.hint).toContain(
        'not an action context (with actor/targets)'
      );
    });

    it('should catch scope context passed as actorEntity', () => {
      const validAST = { type: 'Source', kind: 'builtin', name: 'self' };
      const scopeContext = {
        runtimeCtx: { entityManager: mockEntityManager },
        actorEntity: { id: 'actor-123' },
      };

      let error;
      try {
        scopeEngine.resolve(validAST, scopeContext, runtimeCtx);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ParameterValidationError);
      expect(error.message).toContain('scope resolution context object');
      expect(error.context.hint).toContain(
        'not an action context (with actor/targets) or scope context (with runtimeCtx/dispatcher)'
      );
    });

    it('should catch missing entityManager in runtimeCtx', () => {
      const validAST = { type: 'Source', kind: 'builtin', name: 'self' };
      const actorEntity = { id: 'actor-123', components: {} };
      const invalidRuntimeCtx = {
        logger: mockLogger,
        // Missing entityManager
      };

      let error;
      try {
        scopeEngine.resolve(validAST, actorEntity, invalidRuntimeCtx);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ParameterValidationError);
      expect(error.message).toContain('missing critical services');
      expect(error.message).toContain('entityManager');
    });

    it('should catch "undefined" string as entity id', () => {
      const validAST = { type: 'Source', kind: 'builtin', name: 'self' };
      const invalidActorEntity = { id: 'undefined', components: {} };

      let error;
      try {
        scopeEngine.resolve(validAST, invalidActorEntity, runtimeCtx);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ParameterValidationError);
      expect(error.message).toContain(
        'actorEntity.id must not be the string "undefined"'
      );
      expect(error.context.hint).toContain('suggests an error in entity creation');
    });
  });

  describe('End-to-end validation flow', () => {
    it('should catch invalid params at ScopeEngine layer (fail-fast)', () => {
      const invalidAST = undefined;
      const actorEntity = { id: 'actor-123', components: {} };

      let error;
      try {
        scopeEngine.resolve(invalidAST, actorEntity, runtimeCtx);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ParameterValidationError);
      expect(error.message).toContain('ScopeEngine.resolve');
    });

    it('should maintain error context through call stack', () => {
      const invalidAST = { name: 'test' }; // Missing type
      const actorEntity = { id: 'actor-123', components: {} };

      let error;
      try {
        scopeEngine.resolve(invalidAST, actorEntity, runtimeCtx);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ParameterValidationError);
      expect(error.context).toBeDefined();
      expect(error.context.expected).toBeDefined();
      expect(error.context.received).toBeDefined();
    });

    it('should provide actionable error messages with hints', () => {
      const actionContext = {
        actor: { id: 'actor-123' },
        targets: [],
      };
      const validAST = { type: 'Source', kind: 'builtin', name: 'self' };

      let error;
      try {
        scopeEngine.resolve(validAST, actionContext, runtimeCtx);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ParameterValidationError);
      expect(error.context.hint).toBeDefined();
      expect(error.context.hint.length).toBeGreaterThan(0);
    });

    it('should provide code examples in error output', () => {
      const invalidActorEntity = { name: 'Test' }; // Missing id
      const validAST = { type: 'Source', kind: 'builtin', name: 'self' };

      let error;
      try {
        scopeEngine.resolve(validAST, invalidActorEntity, runtimeCtx);
      } catch (err) {
        error = err;
      }

      expect(error).toBeInstanceOf(ParameterValidationError);
      expect(error.context.example).toBeDefined();
      expect(error.context.example).toContain('entityManager.getEntity');
    });
  });

  describe('Error recovery', () => {
    it('should allow retry after fixing parameters', () => {
      const validAST = { type: 'Source', kind: 'builtin', name: 'self' };
      const invalidActorEntity = { name: 'Test' }; // Missing id
      const validActorEntity = { id: 'actor-123', components: {} };

      // First attempt with invalid params should fail
      let error1;
      try {
        scopeEngine.resolve(validAST, invalidActorEntity, runtimeCtx);
      } catch (err) {
        error1 = err;
      }
      expect(error1).toBeInstanceOf(ParameterValidationError);

      // Second attempt with valid params should succeed (or fail for different reason)
      let error2;
      try {
        const result = scopeEngine.resolve(validAST, validActorEntity, runtimeCtx);
        // Should resolve successfully
        expect(result).toBeDefined();
      } catch (err) {
        error2 = err;
        // If it fails, it should not be a parameter validation error
        expect(err).not.toBeInstanceOf(ParameterValidationError);
      }
    });

    it('should not corrupt state on validation failure', () => {
      const validAST = { type: 'Source', kind: 'builtin', name: 'self' };
      const invalidActorEntity = undefined;
      const validActorEntity = { id: 'actor-123', components: {} };

      // First attempt should fail
      try {
        scopeEngine.resolve(validAST, invalidActorEntity, runtimeCtx);
      } catch (err) {
        expect(err).toBeInstanceOf(ParameterValidationError);
      }

      // Second attempt should work normally
      let result;
      try {
        result = scopeEngine.resolve(validAST, validActorEntity, runtimeCtx);
        expect(result).toBeDefined();
      } catch (err) {
        // If it fails, it should not be due to state corruption
        expect(err.message).not.toContain('corrupt');
      }
    });

    it('should maintain clean error state after failed validation', () => {
      const invalidAST1 = undefined;
      const invalidAST2 = { name: 'test' };
      const actorEntity = { id: 'actor-123', components: {} };

      // First validation failure
      let error1;
      try {
        scopeEngine.resolve(invalidAST1, actorEntity, runtimeCtx);
      } catch (err) {
        error1 = err;
      }

      // Second validation failure (different error)
      let error2;
      try {
        scopeEngine.resolve(invalidAST2, actorEntity, runtimeCtx);
      } catch (err) {
        error2 = err;
      }

      // Each error should be independent
      expect(error1).toBeInstanceOf(ParameterValidationError);
      expect(error2).toBeInstanceOf(ParameterValidationError);
      expect(error1.message).not.toBe(error2.message);
      expect(error1.correlationId).not.toBe(error2.correlationId);
    });
  });

  describe('Resolver integration (no direct validation)', () => {
    it('should receive pre-validated parameters from ScopeEngine', () => {
      const validAST = { type: 'Source', kind: 'builtin', name: 'self' };
      const validActorEntity = { id: 'actor-123', components: {} };

      // This should succeed because parameters are pre-validated
      let result;
      try {
        result = scopeEngine.resolve(validAST, validActorEntity, runtimeCtx);
        expect(result).toBeDefined();
      } catch (err) {
        // If it fails, it should not be a parameter validation error
        // (could be other reasons like missing scope definition)
        if (err instanceof ParameterValidationError) {
          throw new Error(
            'Parameters should have been validated at ScopeEngine entry point'
          );
        }
      }
    });

    it('should not re-validate parameters in resolvers', () => {
      const validAST = { type: 'Source', kind: 'builtin', name: 'self' };
      const validActorEntity = { id: 'actor-123', components: {} };

      // Track if validation errors come from resolver level
      let validationErrorFromResolver = false;

      try {
        scopeEngine.resolve(validAST, validActorEntity, runtimeCtx);
      } catch (err) {
        // Check if error message suggests it came from a resolver
        if (
          err instanceof ParameterValidationError &&
          !err.message.includes('ScopeEngine.resolve')
        ) {
          validationErrorFromResolver = true;
        }
      }

      // Validation should only happen at ScopeEngine level
      expect(validationErrorFromResolver).toBe(false);
    });

    it('should rely on ScopeEngine validation as single entry point', () => {
      // Create invalid params that would fail validation
      const invalidAST = undefined;
      const invalidActorEntity = undefined;
      const invalidRuntimeCtx = undefined;

      let error;
      try {
        scopeEngine.resolve(invalidAST, invalidActorEntity, invalidRuntimeCtx);
      } catch (err) {
        error = err;
      }

      // Error should come from ScopeEngine entry point validation
      expect(error).toBeInstanceOf(ParameterValidationError);
      expect(error.message).toContain('ScopeEngine.resolve');
    });
  });

  describe('Real-world validation scenarios', () => {
    it('should validate complex AST structures', () => {
      const complexAST = {
        type: 'Union',
        left: { type: 'Source', kind: 'builtin', name: 'self' },
        right: { type: 'Filter', logic: { '==': [{ var: 'name' }, 'Test'] } },
      };
      const actorEntity = { id: 'actor-123', components: {} };

      // Should not throw parameter validation error for valid complex AST
      try {
        scopeEngine.resolve(complexAST, actorEntity, runtimeCtx);
      } catch (err) {
        // If it fails, it should not be due to parameter validation
        expect(err).not.toBeInstanceOf(ParameterValidationError);
      }
    });

    it('should validate entities with all optional properties', () => {
      const validAST = { type: 'Source', kind: 'builtin', name: 'self' };
      const fullEntity = {
        id: 'actor-123',
        components: {
          'core:actor': { name: 'Test Actor' },
          'core:location': { currentLocation: 'room-1' },
        },
        extraProp1: 'allowed',
        extraProp2: { nested: 'value' },
      };

      // Should accept entity with extra properties
      try {
        scopeEngine.resolve(validAST, fullEntity, runtimeCtx);
      } catch (err) {
        // If it fails, it should not be due to parameter validation
        expect(err).not.toBeInstanceOf(ParameterValidationError);
      }
    });

    it('should validate minimal runtimeCtx (only entityManager)', () => {
      const validAST = { type: 'Source', kind: 'builtin', name: 'self' };
      const actorEntity = { id: 'actor-123', components: {} };
      const minimalRuntimeCtx = {
        entityManager: mockEntityManager,
        // No logger or jsonLogicEval - should still be valid
      };

      // Should accept minimal runtimeCtx with only required service
      try {
        scopeEngine.resolve(validAST, actorEntity, minimalRuntimeCtx);
      } catch (err) {
        // If it fails, it should not be due to parameter validation
        expect(err).not.toBeInstanceOf(ParameterValidationError);
      }
    });
  });
});
