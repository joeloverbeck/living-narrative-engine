/**
 * @file Integration tests for ScopeResolutionError wrapping
 * @description Tests that scope resolution errors are properly wrapped with enhanced context
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import { ScopeResolutionError } from '../../../src/scopeDsl/errors/scopeResolutionError.js';
import createFilterResolver from '../../../src/scopeDsl/nodes/filterResolver.js';

describe('Error Wrapping Integration', () => {
  describe('ScopeRegistry - Scope not found errors', () => {
    let registry;

    beforeEach(() => {
      registry = new ScopeRegistry();
      registry.initialize({
        'core:test_scope': {
          expr: 'actor.items[]',
          ast: { type: 'Source', name: 'actor' },
        },
        'positioning:close_actors': {
          expr: 'close_actors',
          ast: { type: 'Source', name: 'close_actors' },
        },
      });
    });

    it('should wrap with registered scopes list', () => {
      expect(() => {
        registry.getScopeOrThrow('nonexistent:scope');
      }).toThrow(ScopeResolutionError);
    });

    it('should include scope name in wrapped error', () => {
      let caughtError;
      try {
        registry.getScopeOrThrow('missing:scope');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ScopeResolutionError);
      expect(caughtError.context.scopeName).toBe('missing:scope');
    });

    it('should provide spelling suggestion', () => {
      let caughtError;
      try {
        registry.getScopeOrThrow('nonexistent:scope');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ScopeResolutionError);
      expect(caughtError.context.suggestion).toBeDefined();
      expect(caughtError.context.suggestion).toContain('Available scopes');
    });

    it('should include phase: scope lookup', () => {
      let caughtError;
      try {
        registry.getScopeOrThrow('missing:scope');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ScopeResolutionError);
      expect(caughtError.context.phase).toBe('scope lookup');
    });

    it('should provide hint for missing scope', () => {
      let caughtError;
      try {
        registry.getScopeOrThrow('unknown:scope');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ScopeResolutionError);
      expect(caughtError.context.hint).toBeDefined();
      expect(caughtError.context.hint).toContain('registered');
    });

    it('should include example with actual scope', () => {
      let caughtError;
      try {
        registry.getScopeOrThrow('bad:scope');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ScopeResolutionError);
      expect(caughtError.context.example).toBeDefined();
      expect(caughtError.context.example).toContain('core:test_scope');
    });

    it('should handle empty registry gracefully', () => {
      const emptyRegistry = new ScopeRegistry();
      emptyRegistry.initialize({});

      let caughtError;
      try {
        emptyRegistry.getScopeOrThrow('any:scope');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ScopeResolutionError);
      expect(caughtError.context.suggestion).toContain('No scopes are currently registered');
    });
  });

  describe('FilterResolver - Filter evaluation errors', () => {
    let filterResolver;
    let mockLogicEval;
    let mockEntitiesGateway;
    let mockLocationProvider;

    beforeEach(() => {
      mockLogicEval = {
        evaluate: jest.fn(),
      };

      mockEntitiesGateway = {
        getEntityInstance: jest.fn(),
        getComponent: jest.fn(),
      };

      mockLocationProvider = {
        getLocation: jest.fn(() => ({ id: 'location1' })),
      };

      filterResolver = createFilterResolver({
        logicEval: mockLogicEval,
        entitiesGateway: mockEntitiesGateway,
        locationProvider: mockLocationProvider,
      });
    });

    it('should wrap JSON Logic errors', () => {
      const error = new Error('Could not resolve condition_ref: test_condition');
      mockLogicEval.evaluate.mockImplementation(() => {
        throw error;
      });

      const node = {
        type: 'Filter',
        parent: {
          type: 'Source',
          name: 'actor',
        },
        logic: { '==': [{ var: 'test' }, true] },
      };

      const mockDispatcher = {
        resolve: jest.fn(() => new Set(['entity1'])),
      };

      const ctx = {
        actorEntity: { id: 'actor1' },
        dispatcher: mockDispatcher,
        runtimeCtx: {},
      };

      expect(() => {
        filterResolver.resolve(node, ctx);
      }).toThrow(ScopeResolutionError);
    });

    it('should include entity ID in context', () => {
      const error = new Error('Could not resolve condition_ref: missing');
      mockLogicEval.evaluate.mockImplementation(() => {
        throw error;
      });

      const node = {
        type: 'Filter',
        parent: { type: 'Source', name: 'actor' },
        logic: { '==': [{ var: 'test' }, true] },
      };

      const mockDispatcher = {
        resolve: jest.fn(() => new Set(['entity123'])),
      };

      const ctx = {
        actorEntity: { id: 'actor1' },
        dispatcher: mockDispatcher,
        runtimeCtx: {},
      };

      let caughtError;
      try {
        filterResolver.resolve(node, ctx);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ScopeResolutionError);
      expect(caughtError.context.parameters).toBeDefined();
      expect(caughtError.context.parameters.entityId).toBe('entity123');
    });

    it('should include filter logic in context', () => {
      const error = new Error('Could not resolve condition_ref: test');
      mockLogicEval.evaluate.mockImplementation(() => {
        throw error;
      });

      const filterLogic = { '==': [{ var: 'field' }, 'value'] };
      const node = {
        type: 'Filter',
        parent: { type: 'Source', name: 'actor' },
        logic: filterLogic,
      };

      const mockDispatcher = {
        resolve: jest.fn(() => new Set(['entity1'])),
      };

      const ctx = {
        actorEntity: { id: 'actor1' },
        dispatcher: mockDispatcher,
        runtimeCtx: {},
      };

      let caughtError;
      try {
        filterResolver.resolve(node, ctx);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ScopeResolutionError);
      expect(caughtError.context.parameters.filterLogic).toEqual(filterLogic);
    });

    it('should preserve original evaluation error', () => {
      const originalError = new Error('Could not resolve condition_ref: missing_condition');
      mockLogicEval.evaluate.mockImplementation(() => {
        throw originalError;
      });

      const node = {
        type: 'Filter',
        parent: { type: 'Source', name: 'actor' },
        logic: { '==': [{ var: 'test' }, true] },
      };

      const mockDispatcher = {
        resolve: jest.fn(() => new Set(['entity1'])),
      };

      const ctx = {
        actorEntity: { id: 'actor1' },
        dispatcher: mockDispatcher,
        runtimeCtx: {},
      };

      let caughtError;
      try {
        filterResolver.resolve(node, ctx);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ScopeResolutionError);
      expect(caughtError.context.originalError).toBeDefined();
      expect(caughtError.context.originalError.message).toContain('Could not resolve condition_ref');
    });
  });

  describe('Error chain preservation', () => {
    it('should maintain original error message', () => {
      const registry = new ScopeRegistry();
      registry.initialize({});

      let caughtError;
      try {
        registry.getScopeOrThrow('test:scope');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError.message).toContain('not found');
    });

    it('should maintain original stack trace', () => {
      const registry = new ScopeRegistry();
      registry.initialize({});

      let caughtError;
      try {
        registry.getScopeOrThrow('test:scope');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError.stack).toBeDefined();
      expect(caughtError.stack).toContain('ScopeResolutionError');
    });

    it('should not double-wrap ScopeResolutionError', () => {
      // This test ensures that if a ScopeResolutionError is already thrown,
      // it doesn't get wrapped again
      const registry = new ScopeRegistry();
      registry.initialize({});

      let caughtError;
      try {
        registry.getScopeOrThrow('test:scope');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ScopeResolutionError);
      expect(caughtError.name).toBe('ScopeResolutionError');

      // Verify it's not wrapped multiple times by checking the structure
      expect(caughtError.context.originalError).toBeUndefined();
    });
  });

  describe('Error formatting', () => {
    it('should format error with all context sections', () => {
      const registry = new ScopeRegistry();
      registry.initialize({
        'core:items': { expr: 'items', ast: { type: 'Source', name: 'items' } },
      });

      let caughtError;
      try {
        registry.getScopeOrThrow('unknown:scope');
      } catch (err) {
        caughtError = err;
      }

      const formatted = caughtError.toString();
      expect(formatted).toContain('Scope:');
      expect(formatted).toContain('Phase:');
      expect(formatted).toContain('Parameters:');
      expect(formatted).toContain('Hint:');
      expect(formatted).toContain('Suggestion:');
    });

    it('should include hints and suggestions', () => {
      const registry = new ScopeRegistry();
      registry.initialize({
        'test:scope1': { expr: 'test1', ast: { type: 'Source', name: 'test1' } },
        'test:scope2': { expr: 'test2', ast: { type: 'Source', name: 'test2' } },
      });

      let caughtError;
      try {
        registry.getScopeOrThrow('missing:scope');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError.context.hint).toBeDefined();
      expect(caughtError.context.suggestion).toBeDefined();
      expect(caughtError.context.hint.length).toBeGreaterThan(0);
      expect(caughtError.context.suggestion.length).toBeGreaterThan(0);
    });

    it('should provide actionable error messages', () => {
      const registry = new ScopeRegistry();
      registry.initialize({
        'positioning:close': { expr: 'close', ast: { type: 'Source', name: 'close' } },
      });

      let caughtError;
      try {
        registry.getScopeOrThrow('positioning:far');
      } catch (err) {
        caughtError = err;
      }

      const message = caughtError.toString();

      // Should mention what was requested
      expect(message).toContain('positioning:far');

      // Should suggest checking registration
      expect(message.toLowerCase()).toContain('registered');

      // Should provide an example
      expect(caughtError.context.example).toBeDefined();
    });
  });

  describe('ScopeResolutionError context validation', () => {
    it('should serialize Error objects in originalError', () => {
      const originalError = new Error('Original error message');
      const scopeError = new ScopeResolutionError(
        'Wrapped error',
        {
          scopeName: 'test:scope',
          phase: 'test phase',
          originalError: originalError,
        }
      );

      expect(scopeError.context.originalError).toBeDefined();
      expect(scopeError.context.originalError.message).toBe('Original error message');
      expect(scopeError.context.originalError.name).toBe('Error');
      expect(scopeError.context.originalError.stack).toBeDefined();
    });

    it('should handle string originalError', () => {
      const scopeError = new ScopeResolutionError(
        'Error message',
        {
          scopeName: 'test:scope',
          phase: 'test',
          originalError: 'String error message',
        }
      );

      expect(scopeError.context.originalError).toBe('String error message');
    });

    it('should include all standard context fields', () => {
      const error = new ScopeResolutionError(
        'Test error',
        {
          scopeName: 'test:scope',
          phase: 'test phase',
          parameters: { key: 'value' },
          expected: 'Expected value',
          received: 'Received value',
          hint: 'Test hint',
          suggestion: 'Test suggestion',
          example: 'Test example',
        }
      );

      expect(error.context.scopeName).toBe('test:scope');
      expect(error.context.phase).toBe('test phase');
      expect(error.context.parameters).toEqual({ key: 'value' });
      expect(error.context.expected).toBe('Expected value');
      expect(error.context.received).toBe('Received value');
      expect(error.context.hint).toBe('Test hint');
      expect(error.context.suggestion).toBe('Test suggestion');
      expect(error.context.example).toBe('Test example');
    });
  });
});
