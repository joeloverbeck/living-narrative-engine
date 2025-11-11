/**
 * @file Unit tests for UnifiedScopeResolver
 * @see specs/unified-scope-resolver-consolidation-spec.md
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UnifiedScopeResolver } from '../../../../src/actions/scopes/unifiedScopeResolver.js';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import {
  TARGET_DOMAIN_SELF,
  TARGET_DOMAIN_NONE,
} from '../../../../src/constants/targetDomains.js';
import { ERROR_PHASES } from '../../../../src/actions/errors/actionErrorTypes.js';

describe('UnifiedScopeResolver', () => {
  let resolver;
  let mockScopeRegistry;
  let mockScopeEngine;
  let mockEntityManager;
  let mockJsonLogicEvaluationService;
  let mockDslParser;
  let mockLogger;
  let mockActionErrorContextBuilder;
  let mockCacheStrategy;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock dependencies
    mockScopeRegistry = {
      getScope: jest.fn(),
    };

    mockScopeEngine = {
      resolve: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      getEntityInstance: jest.fn().mockReturnValue({ id: 'valid-entity' }),
    };

    mockJsonLogicEvaluationService = {
      evaluate: jest.fn(),
    };

    mockDslParser = {
      parse: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockActionErrorContextBuilder = {
      buildErrorContext: jest.fn((params) => ({
        ...params.error,
        phase: params.phase,
        actorId: params.actorId,
        scopeName: params.additionalContext?.scopeName,
        suggestions: params.additionalContext?.suggestions || [],
      })),
    };

    mockCacheStrategy = {
      generateKey: jest.fn(
        (scopeName, context) =>
          `${scopeName}:${context.actor.id}:${context.actorLocation}`
      ),
      getSync: jest.fn(),
      setSync: jest.fn(),
    };

    resolver = new UnifiedScopeResolver({
      scopeRegistry: mockScopeRegistry,
      scopeEngine: mockScopeEngine,
      entityManager: mockEntityManager,
      jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      dslParser: mockDslParser,
      logger: mockLogger,
      actionErrorContextBuilder: mockActionErrorContextBuilder,
      cacheStrategy: mockCacheStrategy,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('resolve', () => {
    const createValidContext = () => ({
      actor: {
        id: 'actor123',
        componentTypeIds: ['core:actor'],
      },
      actorLocation: 'location1',
      actionContext: {},
    });

    describe('special scopes', () => {
      it('should resolve NONE scope to empty set', () => {
        const context = createValidContext();

        const result = resolver.resolve(TARGET_DOMAIN_NONE, context);

        expect(result.success).toBe(true);
        expect(result.value).toEqual(new Set());
        expect(mockScopeRegistry.getScope).not.toHaveBeenCalled();
      });

      it('should resolve SELF scope to actor ID set', () => {
        const context = createValidContext();

        const result = resolver.resolve(TARGET_DOMAIN_SELF, context);

        expect(result.success).toBe(true);
        expect(result.value).toEqual(new Set(['actor123']));
        expect(mockScopeRegistry.getScope).not.toHaveBeenCalled();
      });

      it('should log trace information for special scopes when trace is provided', () => {
        const trace = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        };
        const context = {
          ...createValidContext(),
          actor: { id: 'actor123', components: {} },
          trace,
        };

        const result = resolver.resolve(TARGET_DOMAIN_SELF, context);

        expect(result.success).toBe(true);
        expect(trace.info).toHaveBeenCalledWith(
          `Resolving scope '${TARGET_DOMAIN_SELF}'.`,
          'UnifiedScopeResolver.resolve'
        );
        expect(trace.info).toHaveBeenCalledWith(
          `Resolved special scope '${TARGET_DOMAIN_SELF}'.`,
          'UnifiedScopeResolver.resolve',
          expect.objectContaining({ entityCount: 1 })
        );
      });

      it('should propagate component loading failure for SELF scope', () => {
        const context = createValidContext();
        mockEntityManager.getComponentData.mockImplementation(() => {
          throw new Error('Component load failed');
        });

        const result = resolver.resolve(TARGET_DOMAIN_SELF, context);

        expect(result.success).toBe(false);
        expect(result.errors[0].message).toBe(
          'Failed to load any components for actor'
        );
      });
    });

    describe('context validation', () => {
      it('should fail when context is missing', () => {
        const result = resolver.resolve('some-scope', null);

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain(
          'Resolution context is missing actor entity'
        );
        expect(result.errors[0].name).toBe('InvalidContextError');
      });

      it('should fail when actor is missing', () => {
        const context = { actorLocation: 'location1' };

        const result = resolver.resolve('some-scope', context);

        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain(
          'Resolution context is missing actor entity'
        );
      });

      it('should fail when actor ID is invalid', () => {
        const context = {
          actor: { id: null },
          actorLocation: 'location1',
        };

        const result = resolver.resolve('some-scope', context);

        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain('Invalid actor entity ID');
        expect(result.errors[0].name).toBe('InvalidActorIdError');
      });

      it('should fail when actor location is missing', () => {
        const context = {
          actor: { id: 'actor123' },
          actionId: 'action-42',
        };

        const result = resolver.resolve('some-scope', context);

        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain(
          'Resolution context is missing actor location'
        );
      });
    });

    describe('caching', () => {
      it('should use cache when enabled and available', () => {
        const context = createValidContext();
        const cachedResult = ActionResult.success(
          new Set(['entity1', 'entity2'])
        );
        mockCacheStrategy.getSync.mockReturnValue(cachedResult);

        const result = resolver.resolve('test-scope', context, {
          useCache: true,
        });

        expect(mockCacheStrategy.generateKey).toHaveBeenCalledWith(
          'test-scope',
          context
        );
        expect(mockCacheStrategy.getSync).toHaveBeenCalled();
        expect(result).toBe(cachedResult);
        expect(mockScopeRegistry.getScope).not.toHaveBeenCalled();
      });

      it('should log cache hit telemetry when trace is available', () => {
        const trace = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        };
        const context = { ...createValidContext(), trace };
        const cachedResult = ActionResult.success(new Set(['entity1']));
        mockCacheStrategy.getSync.mockReturnValue(cachedResult);

        const result = resolver.resolve('test-scope', context, {
          useCache: true,
        });

        expect(result).toBe(cachedResult);
        expect(trace.info).toHaveBeenCalledWith(
          "Resolved scope 'test-scope' from cache with 1 entities.",
          'UnifiedScopeResolver.resolve',
          expect.objectContaining({ entityIds: ['entity1'] })
        );
      });

      it('should skip cache when disabled', () => {
        const context = createValidContext();
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        mockScopeEngine.resolve.mockReturnValue(new Set(['entity1']));
        mockEntityManager.getComponentData.mockReturnValue({
          name: 'Test Actor',
        });

        const result = resolver.resolve('test-scope', context, {
          useCache: false,
        });

        expect(mockCacheStrategy.getSync).not.toHaveBeenCalled();
        expect(result.success).toBe(true);
      });

      it('should cache successful results', () => {
        const context = createValidContext();
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        const resolvedSet = new Set(['entity1']);
        mockScopeEngine.resolve.mockReturnValue(resolvedSet);
        mockEntityManager.getComponentData.mockReturnValue({
          name: 'Test Actor',
        });

        const result = resolver.resolve('test-scope', context, {
          useCache: true,
          cacheTTL: 10000,
        });

        expect(result.success).toBe(true);
        expect(mockCacheStrategy.setSync).toHaveBeenCalledWith(
          'test-scope:actor123:location1',
          result,
          10000
        );
      });

      it('should not cache failed results', () => {
        const context = createValidContext();
        mockScopeRegistry.getScope.mockReturnValue(null);

        const result = resolver.resolve('test-scope', context, {
          useCache: true,
        });

        expect(result.success).toBe(false);
        expect(mockCacheStrategy.setSync).not.toHaveBeenCalled();
      });
    });

    describe('scope resolution', () => {
      it('should handle missing scope definition', () => {
        const context = createValidContext();
        mockScopeRegistry.getScope.mockReturnValue(null);

        const result = resolver.resolve('missing-scope', context);

        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain(
          "Missing scope definition: Scope 'missing-scope' not found"
        );
        expect(result.errors[0].name).toBe('ScopeNotFoundError');
      });

      it('should handle scope with empty expression', () => {
        const context = createValidContext();
        mockScopeRegistry.getScope.mockReturnValue({ expr: '  ' });

        const result = resolver.resolve('empty-expr-scope', context);

        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain('has no expression');
      });

      it('should use pre-parsed AST when available', () => {
        const context = createValidContext();
        const ast = { type: 'all' };
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: ast,
        });
        mockScopeEngine.resolve.mockReturnValue(new Set(['entity1']));
        mockEntityManager.getComponentData.mockReturnValue({
          name: 'Test Actor',
        });

        const result = resolver.resolve('test-scope', context);

        expect(result.success).toBe(true);
        expect(mockDslParser.parse).not.toHaveBeenCalled();
        expect(mockScopeEngine.resolve).toHaveBeenCalledWith(
          ast,
          expect.any(Object),
          expect.any(Object),
          undefined
        );
      });

      it('should parse expression when AST not available', () => {
        const context = createValidContext();
        const ast = { type: 'all' };
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
        });
        mockDslParser.parse.mockReturnValue(ast);
        mockScopeEngine.resolve.mockReturnValue(new Set(['entity1']));
        mockEntityManager.getComponentData.mockReturnValue({
          name: 'Test Actor',
        });

        const result = resolver.resolve('test-scope', context);

        expect(result.success).toBe(true);
        expect(mockDslParser.parse).toHaveBeenCalledWith('all');
        expect(mockScopeEngine.resolve).toHaveBeenCalledWith(
          ast,
          expect.any(Object),
          expect.any(Object),
          undefined
        );
      });

      it('should handle parse errors', () => {
        const context = createValidContext();
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'invalid expression',
        });
        const parseError = new Error('Parse error');
        mockDslParser.parse.mockImplementation(() => {
          throw parseError;
        });

        const result = resolver.resolve('test-scope', context);

        expect(result.success).toBe(false);
        expect(result.errors[0].message).toBe('Parse error');
        expect(result.errors[0].name).toBe('ScopeParseError');
      });

      it('should handle scope engine errors', () => {
        const context = createValidContext();
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        const engineError = new Error('Engine error');
        mockScopeEngine.resolve.mockImplementation(() => {
          throw engineError;
        });

        const result = resolver.resolve('test-scope', context);

        expect(result.success).toBe(false);
        expect(result.errors[0].message).toBe('Engine error');
        expect(result.errors[0].phase).toBe(ERROR_PHASES.SCOPE_RESOLUTION);
      });

      it('should handle invalid scope engine results', () => {
        const context = createValidContext();
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        mockScopeEngine.resolve.mockReturnValue(null);

        const result = resolver.resolve('test-scope', context);

        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain(
          'Scope engine returned invalid result'
        );
      });

      it('should log detailed debug info for available furniture scope', () => {
        const context = createValidContext();
        context.actor.components = {};
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        const resolvedSet = new Set(['seat-1']);
        mockScopeEngine.resolve.mockReturnValue(resolvedSet);
        mockEntityManager.getComponentData.mockReturnValue({});
        mockEntityManager.getEntityInstance.mockReturnValue({ id: 'seat-1' });

        const result = resolver.resolve('positioning:available_furniture', context);

        expect(result.success).toBe(true);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'UnifiedScopeResolver: Resolving available_furniture scope',
          expect.objectContaining({
            scopeName: 'positioning:available_furniture',
            actorId: 'actor123',
          })
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'UnifiedScopeResolver: Before scope engine resolve',
          expect.objectContaining({
            scopeName: 'positioning:available_furniture',
            hasAst: true,
          })
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'UnifiedScopeResolver: After scope engine resolve',
          expect.objectContaining({
            resolvedCount: 1,
            isSet: true,
          })
        );
      });

      it('should include debug metadata when available furniture scope resolves to invalid data', () => {
        const context = createValidContext();
        context.actor = { id: 'actor123', components: {} };
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        mockScopeEngine.resolve.mockReturnValue(null);

        const result = resolver.resolve('positioning:available_furniture', context);

        expect(result.success).toBe(false);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'UnifiedScopeResolver: After scope engine resolve',
          expect.objectContaining({
            resolvedIds: null,
            resolvedCount: 0,
            isSet: false,
          })
        );
      });
    });

    describe('entity validation', () => {
      it('should validate resolved entities when enabled', () => {
        const context = createValidContext();
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        mockScopeEngine.resolve.mockReturnValue(
          new Set(['entity1', 'entity2'])
        );
        mockEntityManager.getEntityInstance
          .mockReturnValueOnce({ id: 'entity1' })
          .mockReturnValueOnce(null);

        const result = resolver.resolve('test-scope', context, {
          validateEntities: true,
        });

        expect(result.success).toBe(false);
        expect(result.errors[0].message).toContain(
          'resolved to 1 non-existent entities'
        );
        expect(result.errors[0].name).toBe('InvalidResolvedEntitiesError');
        expect(result.errors[0].invalidEntityIds).toEqual(['entity2']);
      });

      it('should skip entity validation when disabled', () => {
        const context = createValidContext();
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        mockScopeEngine.resolve.mockReturnValue(
          new Set(['entity1', 'entity2'])
        );

        const result = resolver.resolve('test-scope', context, {
          validateEntities: false,
        });

        expect(result.success).toBe(true);
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
      });

      it('should treat entity manager exceptions as invalid entities', () => {
        const context = createValidContext();
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        mockScopeEngine.resolve.mockReturnValue(new Set(['entity1']));
        mockEntityManager.getEntityInstance.mockImplementation(() => {
          throw new Error('Lookup failed');
        });

        const result = resolver.resolve('test-scope', context, {
          validateEntities: true,
        });

        expect(result.success).toBe(false);
        expect(result.errors[0].invalidEntityIds).toEqual(['entity1']);
        expect(result.errors[0].name).toBe('InvalidResolvedEntitiesError');
      });
    });

    describe('actor component loading', () => {
      it('should use existing components if available', () => {
        const context = {
          actor: {
            id: 'actor123',
            components: { 'core:actor': { name: 'Test Actor' } },
          },
          actorLocation: 'location1',
        };
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        mockScopeEngine.resolve.mockReturnValue(new Set(['entity1']));
        mockEntityManager.getComponentData.mockReturnValue({
          name: 'Test Actor',
        });

        const result = resolver.resolve('test-scope', context);

        expect(result.success).toBe(true);
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
      });

      it('should load components when not available', () => {
        const context = createValidContext();
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        mockEntityManager.getComponentData.mockReturnValue({
          name: 'Test Actor',
        });
        mockScopeEngine.resolve.mockReturnValue(new Set(['entity1']));
        mockEntityManager.getComponentData.mockReturnValue({
          name: 'Test Actor',
        });

        const result = resolver.resolve('test-scope', context);

        expect(result.success).toBe(true);
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          'actor123',
          'core:actor'
        );
      });

      it('should handle component loading errors gracefully', () => {
        const context = createValidContext();
        context.actor.componentTypeIds = ['core:actor', 'core:inventory'];
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ name: 'Test Actor' })
          .mockImplementationOnce(() => {
            throw new Error('Component load failed');
          });
        mockScopeEngine.resolve.mockReturnValue(new Set(['entity1']));
        mockEntityManager.getComponentData.mockReturnValue({
          name: 'Test Actor',
        });

        const result = resolver.resolve('test-scope', context);

        expect(result.success).toBe(true); // Should continue with partial data
        expect(mockLogger.error).not.toHaveBeenCalled(); // Uses trace instead
      });

      it('should warn through trace when actor has no components defined', () => {
        const trace = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        };
        const context = {
          actor: { id: 'actor123' },
          actorLocation: 'location1',
          trace,
        };
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        mockScopeEngine.resolve.mockReturnValue(new Set(['entity1']));

        const result = resolver.resolve('test-scope', context);

        expect(result.success).toBe(true);
        expect(trace.warn).toHaveBeenCalledWith(
          'Actor entity actor123 has no components.',
          'UnifiedScopeResolver.#buildActorWithComponents'
        );
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
      });

      it('should log component loading errors to trace when available', () => {
        const trace = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        };
        const context = {
          ...createValidContext(),
          trace,
        };
        context.actor.componentTypeIds = ['core:actor', 'core:inventory'];
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        mockEntityManager.getComponentData
          .mockReturnValueOnce({ name: 'Test Actor' })
          .mockImplementationOnce(() => {
            throw new Error('Component load failed');
          });
        mockScopeEngine.resolve.mockReturnValue(new Set(['entity1']));

        const result = resolver.resolve('test-scope', context);

        expect(result.success).toBe(true);
        expect(trace.error).toHaveBeenCalledWith(
          'Failed to load component core:inventory: Component load failed',
          'UnifiedScopeResolver.#buildActorWithComponents'
        );
      });

      it('should fail if no components could be loaded', () => {
        const context = createValidContext();
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        mockEntityManager.getComponentData.mockImplementation(() => {
          throw new Error('Component load failed');
        });

        const result = resolver.resolve('test-scope', context);

        expect(result.success).toBe(false);
        expect(result.errors[0].message).toBe(
          'Failed to load any components for actor'
        );
      });

      it('should handle unexpected component iteration errors gracefully', () => {
        const context = createValidContext();
        context.actor.componentTypeIds = { length: 1 };
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });

        const result = resolver.resolve('test-scope', context);

        expect(result.success).toBe(false);
        expect(result.errors[0].message).toMatch(/is not iterable/);
      });
    });

    describe('tracing', () => {
      it('should log trace information when available', () => {
        const trace = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        };
        const context = {
          ...createValidContext(),
          trace,
        };
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        mockScopeEngine.resolve.mockReturnValue(new Set(['entity1']));
        mockEntityManager.getComponentData.mockReturnValue({
          name: 'Test Actor',
        });

        const result = resolver.resolve('test-scope', context);

        expect(result.success).toBe(true);
        expect(trace.info).toHaveBeenCalledWith(
          "Resolving scope 'test-scope'.",
          'UnifiedScopeResolver.resolve'
        );
        expect(trace.info).toHaveBeenCalledWith(
          "Using pre-parsed AST for scope 'test-scope'.",
          'UnifiedScopeResolver.#parseAst'
        );
      });

      it('should wrap resolution in trace span when available', () => {
        const trace = {
          withSpan: jest.fn((name, callback, metadata) => {
            expect(name).toBe('scope.resolve');
            expect(metadata).toEqual({
              scopeName: 'test-scope',
              actorId: 'actor123',
              actionId: 'action-42',
            });
            return callback();
          }),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
        };
        const context = {
          ...createValidContext(),
          trace,
          actionId: 'action-42',
          actor: { id: 'actor123', components: {} },
        };
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        mockScopeEngine.resolve.mockReturnValue(new Set(['entity1']));

        const result = resolver.resolve('test-scope', context);

        expect(result.success).toBe(true);
        expect(trace.withSpan).toHaveBeenCalledTimes(1);
      });
    });

    describe('runtime context composition', () => {
      it('should include top-level target and targets when provided', () => {
        const context = {
          actor: { id: 'actor123', components: {} },
          actorLocation: 'location1',
          target: { id: 'direct-target' },
          targets: ['t1', 't2'],
          actionContext: {
            target: { id: 'ignored-target' },
            targets: ['ignored'],
          },
        };
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        mockScopeEngine.resolve.mockReturnValue(new Set());

        const result = resolver.resolve('test-scope', context);

        expect(result.success).toBe(true);
        const runtimeCtx = mockScopeEngine.resolve.mock.calls[0][2];
        expect(runtimeCtx.target).toBe(context.target);
        expect(runtimeCtx.targets).toBe(context.targets);
      });

      it('should derive target data from action context when missing on root context', () => {
        const context = {
          actor: { id: 'actor123', components: {} },
          actorLocation: 'location1',
          actionContext: {
            target: { id: 'fallback-target' },
            targets: ['fallback-1'],
          },
        };
        mockScopeRegistry.getScope.mockReturnValue({
          expr: 'all',
          ast: { type: 'all' },
        });
        mockScopeEngine.resolve.mockReturnValue(new Set());

        const result = resolver.resolve('test-scope', context);

        expect(result.success).toBe(true);
        const runtimeCtx = mockScopeEngine.resolve.mock.calls[0][2];
        expect(runtimeCtx.target).toBe(context.actionContext.target);
        expect(runtimeCtx.targets).toBe(context.actionContext.targets);
      });
    });
  });

  describe('resolveSync', () => {
    const scopeName = 'legacy-scope';
    const context = {
      actor: { id: 'actor123' },
      actorLocation: 'location-42',
    };

    it('should return the resolved value when resolve succeeds', () => {
      const resolvedIds = new Set(['entity-1', 'entity-2']);
      const resolveSpy = jest
        .spyOn(resolver, 'resolve')
        .mockReturnValue(ActionResult.success(resolvedIds));

      const result = resolver.resolveSync(scopeName, context);

      expect(result).toBe(resolvedIds);
      expect(resolveSpy).toHaveBeenCalledWith(scopeName, context, {});
    });

    it('should throw an error using the first ActionResult error message', () => {
      const failureError = new Error('Resolution exploded');
      jest
        .spyOn(resolver, 'resolve')
        .mockReturnValue(ActionResult.failure([failureError]));

      expect(() => resolver.resolveSync(scopeName, context)).toThrow(
        'Resolution exploded'
      );
    });

    it('should throw a default error message when the failure has no errors', () => {
      jest
        .spyOn(resolver, 'resolve')
        .mockReturnValue(ActionResult.failure([]));

      expect(() => resolver.resolveSync(scopeName, context)).toThrow(
        'Scope resolution failed'
      );
    });
  });

  describe('resolveBatch', () => {
    it('should resolve multiple scopes successfully', () => {
      const context1 = {
        actor: { id: 'actor1' },
        actorLocation: 'location1',
      };
      const context2 = {
        actor: { id: 'actor2' },
        actorLocation: 'location2',
      };

      mockScopeRegistry.getScope.mockReturnValue({
        expr: 'all',
        ast: { type: 'all' },
      });
      mockScopeEngine.resolve
        .mockReturnValueOnce(new Set(['entity1']))
        .mockReturnValueOnce(new Set(['entity2', 'entity3']));
      mockEntityManager.getComponentData.mockReturnValue({
        name: 'Test Actor',
      });

      const requests = [
        { scopeName: 'scope1', context: context1 },
        { scopeName: 'scope2', context: context2 },
      ];

      const result = resolver.resolveBatch(requests);

      expect(result.success).toBe(true);
      expect(result.value.get('scope1')).toEqual(new Set(['entity1']));
      expect(result.value.get('scope2')).toEqual(
        new Set(['entity2', 'entity3'])
      );
    });

    it('should handle partial failures in batch', () => {
      const context1 = {
        actor: { id: 'actor1' },
        actorLocation: 'location1',
      };
      const context2 = {
        actor: { id: 'actor2' },
        actorLocation: 'location2',
      };

      mockScopeRegistry.getScope
        .mockReturnValueOnce(null) // First scope fails
        .mockReturnValueOnce({
          expr: 'all',
          ast: { type: 'all' },
        });
      mockScopeEngine.resolve.mockReturnValueOnce(new Set(['entity2']));
      mockEntityManager.getComponentData.mockReturnValue({
        name: 'Test Actor',
      });

      const requests = [
        { scopeName: 'missing-scope', context: context1 },
        { scopeName: 'valid-scope', context: context2 },
      ];

      const result = resolver.resolveBatch(requests);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].scopeName).toBe('missing-scope');
    });

    it('should share cache across batch requests', () => {
      const context = {
        actor: { id: 'actor1' },
        actorLocation: 'location1',
      };

      const cachedResult = ActionResult.success(new Set(['cached-entity']));
      mockCacheStrategy.getSync
        .mockReturnValueOnce(null) // First call misses cache
        .mockReturnValueOnce(cachedResult); // Second call hits cache

      mockScopeRegistry.getScope.mockReturnValue({
        expr: 'all',
        ast: { type: 'all' },
      });
      mockScopeEngine.resolve.mockReturnValue(new Set(['entity1']));

      const requests = [
        { scopeName: 'scope1', context },
        { scopeName: 'scope1', context }, // Same scope and context
      ];

      const result = resolver.resolveBatch(requests, { useCache: true });

      expect(result.success).toBe(true);
      expect(mockScopeEngine.resolve).toHaveBeenCalledTimes(1); // Only resolved once
      expect(mockCacheStrategy.setSync).toHaveBeenCalledTimes(1); // Cached once
    });
  });

  describe('error context building', () => {
    it('should generate appropriate suggestions for ScopeNotFoundError', () => {
      const context = {
        actor: { id: 'actor123' },
        actorLocation: 'location1',
      };
      mockScopeRegistry.getScope.mockReturnValue(null);

      const result = resolver.resolve('missing-scope', context);

      expect(result.success).toBe(false);
      const errorContext =
        mockActionErrorContextBuilder.buildErrorContext.mock.calls[0][0];
      expect(errorContext.additionalContext.suggestions).toContain(
        "Verify scope 'missing-scope' is defined in a loaded mod"
      );
    });

    it('should generate appropriate suggestions for ScopeParseError', () => {
      const context = {
        actor: { id: 'actor123' },
        actorLocation: 'location1',
      };
      mockScopeRegistry.getScope.mockReturnValue({ expr: 'invalid)(' });
      const parseError = new Error('Unexpected token');
      parseError.name = 'ScopeParseError';
      mockDslParser.parse.mockImplementation(() => {
        throw parseError;
      });

      const result = resolver.resolve('bad-scope', context);

      expect(result.success).toBe(false);
      const errorContext =
        mockActionErrorContextBuilder.buildErrorContext.mock.calls[0][0];
      expect(errorContext.additionalContext.suggestions).toContain(
        'Check the scope expression syntax'
      );
    });
  });
});
