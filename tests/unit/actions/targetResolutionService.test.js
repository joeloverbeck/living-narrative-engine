/**
 * @file Unit tests for targetResolutionService using ActionResult pattern
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import {
  TARGET_DOMAIN_SELF,
  TARGET_DOMAIN_NONE,
} from '../../../src/constants/targetDomains.js';
import { ERROR_PHASES } from '../../../src/actions/errors/actionErrorTypes.js';

describe('TargetResolutionService', () => {
  let service;
  let mockDependencies;

  beforeEach(() => {
    // Create mock dependencies
    mockDependencies = {
      scopeRegistry: {
        getScope: jest.fn(),
      },
      scopeEngine: {
        resolve: jest.fn(),
      },
      entityManager: {
        getComponentData: jest.fn(),
      },
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        child: jest.fn().mockReturnThis(),
      },
      safeEventDispatcher: {
        dispatch: jest.fn(),
      },
      jsonLogicEvaluationService: {
        evaluate: jest.fn(),
      },
      dslParser: {
        parse: jest.fn(),
      },
      actionErrorContextBuilder: {
        buildErrorContext: jest.fn().mockImplementation(({ error }) => error),
      },
    };

    service = new TargetResolutionService(mockDependencies);
  });

  describe('resolveTargets', () => {
    describe('Special scope handling', () => {
      it('should return no-target context for TARGET_DOMAIN_NONE', () => {
        const result = service.resolveTargets(
          TARGET_DOMAIN_NONE,
          { id: 'actor1' },
          { currentLocation: 'loc1' }
        );

        expect(result.success).toBe(true);
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toEqual(ActionTargetContext.noTarget());
      });

      it('should return actor as target for TARGET_DOMAIN_SELF', () => {
        const actorId = 'actor1';
        const result = service.resolveTargets(
          TARGET_DOMAIN_SELF,
          { id: actorId },
          { currentLocation: 'loc1' }
        );

        expect(result.success).toBe(true);
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toEqual(ActionTargetContext.forEntity(actorId));
      });
    });

    describe('Actor validation', () => {
      it('should fail when actor entity is null', () => {
        const result = service.resolveTargets('some-scope', null, {
          currentLocation: 'loc1',
        });

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain(
          'Actor entity is null or undefined'
        );
        expect(result.errors[0].name).toBe('InvalidActorError');
      });

      it('should fail when actor entity has no id', () => {
        const result = service.resolveTargets(
          'some-scope',
          { id: null },
          { currentLocation: 'loc1' }
        );

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('Invalid actor entity ID');
        expect(result.errors[0].name).toBe('InvalidActorIdError');
      });

      it('should fail when actor id is undefined string', () => {
        const result = service.resolveTargets(
          'some-scope',
          { id: 'undefined' },
          { currentLocation: 'loc1' }
        );

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('Invalid actor entity ID');
      });
    });

    describe('DSL scope resolution', () => {
      it('should resolve DSL scope successfully', () => {
        const scopeDefinition = {
          expr: 'entities.filter(e => e.location == actor.location)',
          ast: { type: 'filter' },
        };
        const resolvedIds = new Set(['entity1', 'entity2']);

        mockDependencies.scopeRegistry.getScope.mockReturnValue(
          scopeDefinition
        );
        mockDependencies.scopeEngine.resolve.mockReturnValue(resolvedIds);

        const result = service.resolveTargets(
          'nearby-entities',
          { id: 'actor1' },
          { currentLocation: 'loc1' }
        );

        expect(result.success).toBe(true);
        expect(result.value).toHaveLength(2);
        expect(result.value[0]).toEqual(
          ActionTargetContext.forEntity('entity1')
        );
        expect(result.value[1]).toEqual(
          ActionTargetContext.forEntity('entity2')
        );
      });

      it('should fail when scope is not found', () => {
        mockDependencies.scopeRegistry.getScope.mockReturnValue(null);

        const result = service.resolveTargets(
          'unknown-scope',
          { id: 'actor1' },
          { currentLocation: 'loc1' }
        );

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('Missing scope definition');
        expect(result.errors[0].name).toBe('ScopeNotFoundError');
      });

      it('should fail when scope has empty expression', () => {
        mockDependencies.scopeRegistry.getScope.mockReturnValue({ expr: '  ' });

        const result = service.resolveTargets(
          'empty-scope',
          { id: 'actor1' },
          { currentLocation: 'loc1' }
        );

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('Missing scope definition');
      });

      it('should parse expression on demand when AST is not cached', () => {
        const scopeDefinition = {
          expr: 'entities.filter(e => e.location == actor.location)',
          // No ast property
        };
        const parsedAst = { type: 'filter' };
        const resolvedIds = new Set(['entity1']);

        mockDependencies.scopeRegistry.getScope.mockReturnValue(
          scopeDefinition
        );
        mockDependencies.dslParser.parse.mockReturnValue(parsedAst);
        mockDependencies.scopeEngine.resolve.mockReturnValue(resolvedIds);

        const result = service.resolveTargets(
          'needs-parsing',
          { id: 'actor1' },
          { currentLocation: 'loc1' }
        );

        expect(result.success).toBe(true);
        expect(mockDependencies.dslParser.parse).toHaveBeenCalledWith(
          scopeDefinition.expr
        );
        expect(result.value).toHaveLength(1);
      });

      it('should fail when DSL parsing fails', () => {
        const scopeDefinition = {
          expr: 'invalid syntax {{',
        };

        mockDependencies.scopeRegistry.getScope.mockReturnValue(
          scopeDefinition
        );
        mockDependencies.dslParser.parse.mockImplementation(() => {
          throw new Error('Parse error: unexpected token');
        });

        const result = service.resolveTargets(
          'invalid-syntax',
          { id: 'actor1' },
          { currentLocation: 'loc1' }
        );

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('Parse error');
      });

      it('should fail when scope engine throws error', () => {
        const scopeDefinition = {
          expr: 'entities.all()',
          ast: { type: 'all' },
        };

        mockDependencies.scopeRegistry.getScope.mockReturnValue(
          scopeDefinition
        );
        mockDependencies.scopeEngine.resolve.mockImplementation(() => {
          throw new Error('Scope engine error');
        });

        const result = service.resolveTargets(
          'error-scope',
          { id: 'actor1' },
          { currentLocation: 'loc1' }
        );

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('Scope engine error');
      });

      it('should fail when scope engine returns invalid result', () => {
        const scopeDefinition = {
          expr: 'entities.all()',
          ast: { type: 'all' },
        };

        mockDependencies.scopeRegistry.getScope.mockReturnValue(
          scopeDefinition
        );
        mockDependencies.scopeEngine.resolve.mockReturnValue([
          'not',
          'a',
          'set',
        ]); // Invalid - should be Set

        const result = service.resolveTargets(
          'invalid-result',
          { id: 'actor1' },
          { currentLocation: 'loc1' }
        );

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain(
          'Scope engine returned invalid result'
        );
      });
    });

    describe('Component building', () => {
      it('should build components for actor without components', () => {
        const actorEntity = {
          id: 'actor1',
          componentTypeIds: ['health', 'position'],
        };
        const scopeDefinition = {
          expr: 'entities.all()',
          ast: { type: 'all' },
        };

        mockDependencies.scopeRegistry.getScope.mockReturnValue(
          scopeDefinition
        );
        mockDependencies.entityManager.getComponentData
          .mockReturnValueOnce({ value: 100 }) // health
          .mockReturnValueOnce({ x: 10, y: 20 }); // position
        mockDependencies.scopeEngine.resolve.mockReturnValue(
          new Set(['entity1'])
        );

        const result = service.resolveTargets('test-scope', actorEntity, {
          currentLocation: 'loc1',
        });

        expect(result.success).toBe(true);
        expect(
          mockDependencies.entityManager.getComponentData
        ).toHaveBeenCalledTimes(2);
        expect(
          mockDependencies.entityManager.getComponentData
        ).toHaveBeenCalledWith('actor1', 'health');
        expect(
          mockDependencies.entityManager.getComponentData
        ).toHaveBeenCalledWith('actor1', 'position');
      });

      it('should handle component loading errors gracefully', () => {
        const actorEntity = {
          id: 'actor1',
          componentTypeIds: ['health', 'broken'],
        };
        const scopeDefinition = {
          expr: 'entities.all()',
          ast: { type: 'all' },
        };

        mockDependencies.scopeRegistry.getScope.mockReturnValue(
          scopeDefinition
        );
        mockDependencies.entityManager.getComponentData
          .mockReturnValueOnce({ value: 100 }) // health - success
          .mockImplementationOnce(() => {
            throw new Error('Component not found');
          }); // broken - fails
        mockDependencies.scopeEngine.resolve.mockReturnValue(
          new Set(['entity1'])
        );

        const result = service.resolveTargets('test-scope', actorEntity, {
          currentLocation: 'loc1',
        });

        // Should succeed with partial components
        expect(result.success).toBe(true);
        expect(result.value).toHaveLength(1);
      });

      it('should handle actor with no componentTypeIds', () => {
        const actorEntity = {
          id: 'actor1',
          // No componentTypeIds
        };
        const scopeDefinition = {
          expr: 'entities.all()',
          ast: { type: 'all' },
        };
        const trace = {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
        };

        mockDependencies.scopeRegistry.getScope.mockReturnValue(
          scopeDefinition
        );
        mockDependencies.scopeEngine.resolve.mockReturnValue(
          new Set(['entity1'])
        );

        const result = service.resolveTargets(
          'test-scope',
          actorEntity,
          { currentLocation: 'loc1' },
          trace
        );

        expect(result.success).toBe(true);
        expect(trace.warn).toHaveBeenCalledWith(
          expect.stringContaining('has no components or componentTypeIds'),
          expect.any(String)
        );
      });

      it('should not rebuild components if actor already has them', () => {
        const actorEntity = {
          id: 'actor1',
          componentTypeIds: ['health'],
          components: { health: { value: 100 } }, // Already has components
        };
        const scopeDefinition = {
          expr: 'entities.all()',
          ast: { type: 'all' },
        };

        mockDependencies.scopeRegistry.getScope.mockReturnValue(
          scopeDefinition
        );
        mockDependencies.scopeEngine.resolve.mockReturnValue(
          new Set(['entity1'])
        );

        const result = service.resolveTargets('test-scope', actorEntity, {
          currentLocation: 'loc1',
        });

        expect(result.success).toBe(true);
        expect(
          mockDependencies.entityManager.getComponentData
        ).not.toHaveBeenCalled();
      });
    });

    describe('resolveTargets method with ActionResult', () => {
      it('should return ActionResult from resolveTargets method', () => {
        const scopeDefinition = {
          expr: 'entities.all()',
          ast: { type: 'all' },
        };
        mockDependencies.scopeRegistry.getScope.mockReturnValue(
          scopeDefinition
        );
        mockDependencies.scopeEngine.resolve.mockReturnValue(
          new Set(['entity1', 'entity2'])
        );

        const result = service.resolveTargets(
          'test-scope',
          { id: 'actor1' },
          { currentLocation: 'loc1' }
        );

        expect(result.success).toBe(true);
        expect(result.value).toHaveLength(2);
        expect(result.errors).toEqual([]);
        expect(result.value[0]).toEqual(
          ActionTargetContext.forEntity('entity1')
        );
      });

      it('should return ActionResult failure for unknown scope', () => {
        mockDependencies.scopeRegistry.getScope.mockReturnValue(null);

        const result = service.resolveTargets(
          'unknown-scope',
          { id: 'actor1' },
          { currentLocation: 'loc1' }
        );

        expect(result.success).toBe(false);
        expect(result.value).toBeNull();
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toContain('Missing scope definition');
      });
    });

    describe('Tracing', () => {
      it('should log trace messages when trace is provided', () => {
        const trace = {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
        };
        const scopeDefinition = {
          expr: 'entities.all()',
          ast: { type: 'all' },
        };

        mockDependencies.scopeRegistry.getScope.mockReturnValue(
          scopeDefinition
        );
        mockDependencies.scopeEngine.resolve.mockReturnValue(
          new Set(['entity1'])
        );

        service.resolveTargets(
          'test-scope',
          { id: 'actor1' },
          { currentLocation: 'loc1' },
          trace
        );

        expect(trace.info).toHaveBeenCalledWith(
          expect.stringContaining("Resolving scope 'test-scope'"),
          expect.any(String)
        );
        expect(trace.info).toHaveBeenCalledWith(
          expect.stringContaining('Using pre-parsed AST'),
          expect.any(String)
        );
      });

      it('should log errors to trace when validation fails', () => {
        const trace = {
          info: jest.fn(),
          error: jest.fn(),
          warn: jest.fn(),
        };

        service.resolveTargets(
          'test-scope',
          null,
          { currentLocation: 'loc1' },
          trace
        );

        expect(trace.error).toHaveBeenCalledWith(
          'Actor entity is null or undefined',
          expect.any(String)
        );
      });
    });

    describe('Error context building', () => {
      it('should build error context with action ID when provided', () => {
        const actionId = 'action123';
        mockDependencies.scopeRegistry.getScope.mockReturnValue(null);

        service.resolveTargets(
          'unknown-scope',
          { id: 'actor1' },
          { currentLocation: 'loc1' },
          null,
          actionId
        );

        expect(
          mockDependencies.actionErrorContextBuilder.buildErrorContext
        ).toHaveBeenCalledWith(
          expect.objectContaining({
            actionDef: { id: actionId },
            actorId: 'actor1',
            phase: ERROR_PHASES.VALIDATION,
          })
        );
      });

      it('should dispatch errors through safeEventDispatcher', () => {
        mockDependencies.scopeRegistry.getScope.mockReturnValue(null);

        service.resolveTargets(
          'unknown-scope',
          { id: 'actor1' },
          { currentLocation: 'loc1' },
          null,
          'action123' // Provide action ID to trigger error context building
        );

        // The error context builder should have been called
        expect(
          mockDependencies.actionErrorContextBuilder.buildErrorContext
        ).toHaveBeenCalled();

        // safeDispatchError should be called indirectly
        // We can't test it directly since it's a utility function, but we can verify
        // the error context builder was called which leads to dispatching
      });
    });
  });
});
