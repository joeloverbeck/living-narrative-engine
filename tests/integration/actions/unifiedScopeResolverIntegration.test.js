/**
 * @file Integration tests for UnifiedScopeResolver delegation from TargetResolutionService
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import {
  TARGET_DOMAIN_SELF,
  TARGET_DOMAIN_NONE,
} from '../../../src/constants/targetDomains.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';

describe('UnifiedScopeResolver Integration', () => {
  let container;
  let targetResolutionService;
  let unifiedScopeResolver;

  beforeEach(() => {
    // Create DOM elements needed by container configuration
    const outputDiv = document.createElement('div');
    const inputElement = document.createElement('input');
    const titleElement = document.createElement('h1');

    // Create and configure container
    container = new AppContainer();
    configureContainer(container, {
      outputDiv,
      inputElement,
      titleElement,
      document,
    });

    // Resolve services
    targetResolutionService = container.resolve(
      tokens.ITargetResolutionService
    );
    unifiedScopeResolver = container.resolve('IUnifiedScopeResolver');
  });

  describe('TargetResolutionService delegation to UnifiedScopeResolver', () => {
    it('should successfully resolve special scope NONE', () => {
      const actorEntity = {
        id: 'actor123',
        definitionId: 'core:actor',
        componentTypeIds: [],
      };

      const discoveryContext = {
        currentLocation: 'location1',
      };

      const result = targetResolutionService.resolveTargets(
        TARGET_DOMAIN_NONE,
        actorEntity,
        discoveryContext
      );

      expect(result.success).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toEqual(ActionTargetContext.noTarget());
    });

    it('should successfully resolve special scope SELF', () => {
      const actorEntity = {
        id: 'actor456',
        definitionId: 'core:actor',
        componentTypeIds: [],
      };

      const discoveryContext = {
        currentLocation: 'location2',
      };

      const result = targetResolutionService.resolveTargets(
        TARGET_DOMAIN_SELF,
        actorEntity,
        discoveryContext
      );

      expect(result.success).toBe(true);
      expect(result.value).toHaveLength(1);
      expect(result.value[0]).toEqual(
        ActionTargetContext.forEntity('actor456')
      );
    });

    it('should handle validation errors consistently', () => {
      const discoveryContext = {
        currentLocation: 'location3',
      };

      // Test with null actor
      const result = targetResolutionService.resolveTargets(
        'test:invalid-scope',
        null,
        discoveryContext
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      // The error context is wrapped, need to access the actual error
      const errorContext = result.errors[0];
      expect(errorContext.error.message).toContain(
        'Resolution context is missing actor entity'
      );
      expect(errorContext.error.name).toBe('InvalidContextError');
    });

    it('should handle missing scope definitions', () => {
      const actorEntity = {
        id: 'actor789',
        definitionId: 'core:actor',
        componentTypeIds: [],
      };

      const discoveryContext = {
        currentLocation: 'location4',
      };

      // Use a scope that doesn't exist
      const result = targetResolutionService.resolveTargets(
        'test:non-existent-scope',
        actorEntity,
        discoveryContext
      );

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      // The error context is wrapped, need to access the actual error
      const errorContext = result.errors[0];
      expect(errorContext.error.message).toContain('Missing scope definition');
      expect(errorContext.error.name).toBe('ScopeNotFoundError');
    });
  });

  describe('UnifiedScopeResolver features', () => {
    it('should support batch resolution through UnifiedScopeResolver', () => {
      const requests = [
        {
          scopeName: TARGET_DOMAIN_NONE,
          context: {
            actor: { id: 'actor1' },
            actorLocation: 'loc1',
            actionContext: { currentLocation: 'loc1' },
          },
        },
        {
          scopeName: TARGET_DOMAIN_SELF,
          context: {
            actor: { id: 'actor2' },
            actorLocation: 'loc2',
            actionContext: { currentLocation: 'loc2' },
          },
        },
      ];

      const result = unifiedScopeResolver.resolveBatch(requests);

      expect(result.success).toBe(true);
      expect(result.value).toBeInstanceOf(Map);
      expect(result.value.size).toBe(2);

      expect(result.value.get(TARGET_DOMAIN_NONE).size).toBe(0);
      expect(result.value.get(TARGET_DOMAIN_SELF).size).toBe(1);
      expect(Array.from(result.value.get(TARGET_DOMAIN_SELF))[0]).toBe(
        'actor2'
      );
    });
  });

  describe('Trace Context Integration', () => {
    it('should use withSpan method when trace context provides it', () => {
      const withSpanMock = jest.fn((name, fn, attrs) => {
        // Call the function synchronously
        return fn();
      });

      const traceContext = {
        withSpan: withSpanMock,
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const actorEntity = {
        id: 'actor-trace-1',
        definitionId: 'core:actor',
        componentTypeIds: [],
      };

      const context = {
        actor: actorEntity,
        actorLocation: 'location1',
        trace: traceContext,
        actionId: 'test-action-123',
      };

      const result = unifiedScopeResolver.resolve(TARGET_DOMAIN_SELF, context);

      expect(result.success).toBe(true);
      expect(withSpanMock).toHaveBeenCalledWith(
        'scope.resolve',
        expect.any(Function),
        {
          scopeName: TARGET_DOMAIN_SELF,
          actorId: 'actor-trace-1',
          actionId: 'test-action-123',
        }
      );
    });

    it('should log trace info for special scope resolution', () => {
      const traceContext = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const actorEntity = {
        id: 'actor-trace-2',
        definitionId: 'core:actor',
        componentTypeIds: [],
      };

      const context = {
        actor: actorEntity,
        actorLocation: 'location1',
        trace: traceContext,
      };

      const result = unifiedScopeResolver.resolve(TARGET_DOMAIN_NONE, context);

      expect(result.success).toBe(true);
      expect(traceContext.info).toHaveBeenCalledWith(
        "Resolving scope 'none'.",
        'UnifiedScopeResolver.resolve'
      );
      expect(traceContext.info).toHaveBeenCalledWith(
        "Resolved special scope 'none'.",
        'UnifiedScopeResolver.resolve',
        { entityCount: 0 }
      );
    });

    it('should log trace warning for actor without components', () => {
      const traceContext = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const actorEntity = {
        id: 'actor-no-components',
        definitionId: 'core:actor',
        componentTypeIds: [], // No components
      };

      const context = {
        actor: actorEntity,
        actorLocation: 'location1',
        trace: traceContext,
      };

      // Use the actual scope "self" which is built-in
      const result = unifiedScopeResolver.resolve(TARGET_DOMAIN_SELF, context);

      expect(result.success).toBe(true);
      expect(traceContext.warn).toHaveBeenCalledWith(
        'Actor entity actor-no-components has no components.',
        'UnifiedScopeResolver.#buildActorWithComponents'
      );
    });
  });

  describe('Context Validation', () => {
    it('should validate various invalid actor ID scenarios', () => {
      const testCases = [
        { id: null, description: 'null actor ID' },
        { id: undefined, description: 'undefined actor ID' },
        { id: '', description: 'empty string actor ID' },
        { id: '   ', description: 'whitespace actor ID' },
        { id: 'null', description: 'string "null" actor ID' },
        { id: 'undefined', description: 'string "undefined" actor ID' },
      ];

      testCases.forEach(({ id, description }) => {
        const context = {
          actor: { id },
          actorLocation: 'location1',
        };

        const result = unifiedScopeResolver.resolve('some-scope', context);

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('Invalid actor entity ID');
        expect(result.errors[0].name).toBe('InvalidActorIdError');
      });
    });

    it('should fail when actor location is missing', () => {
      const context = {
        actor: { id: 'valid-actor-id' },
        // actorLocation is missing
      };

      const result = unifiedScopeResolver.resolve('some-scope', context);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain(
        'Resolution context is missing actor location'
      );
      expect(result.errors[0].name).toBe('InvalidContextError');
    });

    it('should provide proper error context for validation failures', () => {
      const context = {
        actor: { id: '' },
        actorLocation: 'location1',
        actionId: 'test-action-456',
      };

      const result = unifiedScopeResolver.resolve('test-scope', context);

      expect(result.success).toBe(false);
      const error = result.errors[0];
      expect(error.phase).toBe('validation');
      expect(error.scopeName).toBe('test-scope');
      expect(error.suggestions).toBeDefined();
      expect(error.suggestions).toContain(
        'Ensure the actor entity is properly initialized'
      );
    });
  });

  describe('Batch Resolution', () => {
    it('should handle mixed success and failure in batch resolution', () => {
      const requests = [
        {
          scopeName: TARGET_DOMAIN_SELF,
          context: {
            actor: { id: 'batch-actor-1' },
            actorLocation: 'loc1',
          },
        },
        {
          scopeName: 'core:non-existent-batch-scope', // This will fail
          context: {
            actor: { id: 'batch-actor-2' },
            actorLocation: 'loc2',
          },
        },
        {
          scopeName: TARGET_DOMAIN_NONE,
          context: {
            actor: { id: 'batch-actor-3' },
            actorLocation: 'loc3',
          },
        },
      ];

      const result = unifiedScopeResolver.resolveBatch(requests);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].scopeName).toBe('core:non-existent-batch-scope');
      expect(result.errors[0].message).toContain('Missing scope definition');
    });

    it('should aggregate errors from multiple failed batch requests', () => {
      const requests = [
        {
          scopeName: 'core:invalid-scope-1',
          context: {
            actor: { id: 'batch-actor-1' },
            actorLocation: 'loc1',
          },
        },
        {
          scopeName: 'core:invalid-scope-2',
          context: {
            actor: null, // Invalid context
            actorLocation: 'loc2',
          },
        },
        {
          scopeName: 'core:invalid-scope-3',
          context: {
            actor: { id: 'batch-actor-3' },
            // Missing actorLocation
          },
        },
      ];

      const result = unifiedScopeResolver.resolveBatch(requests);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);

      // Check that scope names are added to errors
      const scopeNames = result.errors.map((err) => err.scopeName);
      expect(scopeNames).toContain('core:invalid-scope-1');
      expect(scopeNames).toContain('core:invalid-scope-2');
      expect(scopeNames).toContain('core:invalid-scope-3');
    });
  });

  describe('Error Context Building', () => {
    it('should generate fix suggestions for ScopeNotFoundError', () => {
      const context = {
        actor: { id: 'suggestion-actor' },
        actorLocation: 'location1',
      };

      const result = unifiedScopeResolver.resolve(
        'test:missing-scope',
        context
      );

      expect(result.success).toBe(false);
      const error = result.errors[0];
      expect(error.suggestions).toContain(
        "Verify scope 'test:missing-scope' is defined in a loaded mod"
      );
      expect(error.suggestions).toContain('Check for typos in the scope name');
      expect(error.suggestions).toContain(
        'Ensure the mod containing this scope is loaded'
      );
    });
  });

  describe('Special Cases', () => {
    it('should handle actor component loading for actors with empty componentTypeIds', () => {
      const actorEntity = {
        id: 'empty-components-actor',
        definitionId: 'core:actor',
        componentTypeIds: [], // Empty array means no components
      };

      const context = {
        actor: actorEntity,
        actorLocation: 'location1',
      };

      const result = unifiedScopeResolver.resolve(TARGET_DOMAIN_SELF, context);

      expect(result.success).toBe(true);
      expect(result.value).toEqual(new Set(['empty-components-actor']));
    });

    it('should skip entity validation when validateEntities is false', () => {
      const actorEntity = {
        id: 'skip-validation-actor',
        definitionId: 'core:actor',
        componentTypeIds: [],
      };

      const context = {
        actor: actorEntity,
        actorLocation: 'location1',
      };

      const result = unifiedScopeResolver.resolve(TARGET_DOMAIN_SELF, context, {
        validateEntities: false,
      });

      expect(result.success).toBe(true);
      expect(result.value).toEqual(new Set(['skip-validation-actor']));
    });

    it('should validate entities when validateEntities is true', () => {
      const actorEntity = {
        id: 'validate-entities-actor',
        definitionId: 'core:actor',
        componentTypeIds: [],
      };

      const context = {
        actor: actorEntity,
        actorLocation: 'location1',
      };

      const result = unifiedScopeResolver.resolve(TARGET_DOMAIN_SELF, context, {
        validateEntities: true,
      });

      // This should succeed for self scope as the actor entity is valid
      expect(result.success).toBe(true);
      expect(result.value).toEqual(new Set(['validate-entities-actor']));
    });

    it('should handle scope resolution with caching disabled', () => {
      const actorEntity = {
        id: 'no-cache-actor',
        definitionId: 'core:actor',
        componentTypeIds: [],
      };

      const context = {
        actor: actorEntity,
        actorLocation: 'location1',
      };

      // First call with caching disabled
      const result1 = unifiedScopeResolver.resolve(
        TARGET_DOMAIN_SELF,
        context,
        {
          useCache: false,
        }
      );
      expect(result1.success).toBe(true);

      // Second call with caching disabled should still work
      const result2 = unifiedScopeResolver.resolve(
        TARGET_DOMAIN_SELF,
        context,
        {
          useCache: false,
        }
      );
      expect(result2.success).toBe(true);
      expect(result2.value).toEqual(new Set(['no-cache-actor']));
    });

    it('should handle scope resolution with caching enabled', () => {
      const actorEntity = {
        id: 'cache-actor',
        definitionId: 'core:actor',
        componentTypeIds: [],
      };

      const context = {
        actor: actorEntity,
        actorLocation: 'location1',
      };

      // First call with caching enabled
      const result1 = unifiedScopeResolver.resolve(
        TARGET_DOMAIN_SELF,
        context,
        {
          useCache: true,
          cacheTTL: 5000,
        }
      );
      expect(result1.success).toBe(true);

      // Second call should potentially use cache (but we can't easily verify without internal access)
      const result2 = unifiedScopeResolver.resolve(
        TARGET_DOMAIN_SELF,
        context,
        {
          useCache: true,
        }
      );
      expect(result2.success).toBe(true);
      expect(result2.value).toEqual(new Set(['cache-actor']));
    });
  });
});
