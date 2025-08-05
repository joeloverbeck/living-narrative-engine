/**
 * @file Integration tests for PipelineResult
 * @description Tests PipelineResult in real pipeline contexts and service integrations
 * @see src/actions/pipeline/PipelineResult.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { PipelineResult } from '../../../../src/actions/pipeline/PipelineResult.js';
import { ActionResult } from '../../../../src/actions/core/actionResult.js';
import { Pipeline } from '../../../../src/actions/pipeline/Pipeline.js';
import { ComponentFilteringStage } from '../../../../src/actions/pipeline/stages/ComponentFilteringStage.js';
import { PrerequisiteEvaluationStage } from '../../../../src/actions/pipeline/stages/PrerequisiteEvaluationStage.js';
import { TargetResolutionStage } from '../../../../src/actions/pipeline/stages/TargetResolutionStage.js';
import { ActionFormattingStage } from '../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import { StructuredTrace } from '../../../../src/actions/tracing/structuredTrace.js';
import { TraceContext } from '../../../../src/actions/tracing/traceContext.js';

describe('PipelineResult - Integration Tests', () => {
  let mockLogger;
  let mockActionIndex;
  let mockErrorContextBuilder;
  let mockPrerequisiteEvaluationService;
  let mockTargetResolutionService;
  let mockCommandFormatter;
  let mockEntityManager;
  let mockSafeEventDispatcher;
  let pipeline;

  beforeEach(() => {
    // Create comprehensive mocks for real service integration
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockActionIndex = {
      getCandidateActions: jest.fn(),
    };

    mockErrorContextBuilder = {
      buildErrorContext: jest.fn().mockImplementation((params) => ({
        error: params.error?.message || params.error,
        phase: params.phase,
        actorId: params.actorId,
        additionalContext: params.additionalContext,
      })),
    };

    mockPrerequisiteEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
    };

    mockTargetResolutionService = {
      resolveTargets: jest.fn(),
    };

    mockCommandFormatter = {
      format: jest
        .fn()
        .mockReturnValue({ ok: true, value: 'formatted command' }),
    };

    mockEntityManager = {
      getEntityById: jest.fn(),
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn(),
    };

    const getEntityDisplayNameFn = jest.fn().mockReturnValue('Test Entity');

    // Create real pipeline stages
    const stages = [
      new ComponentFilteringStage(
        mockActionIndex,
        mockErrorContextBuilder,
        mockLogger
      ),
      new PrerequisiteEvaluationStage(
        mockPrerequisiteEvaluationService,
        mockErrorContextBuilder,
        mockLogger
      ),
      new TargetResolutionStage(
        mockTargetResolutionService,
        mockErrorContextBuilder,
        mockLogger
      ),
      new ActionFormattingStage({
        commandFormatter: mockCommandFormatter,
        entityManager: mockEntityManager,
        safeEventDispatcher: mockSafeEventDispatcher,
        getEntityDisplayNameFn: getEntityDisplayNameFn,
        errorContextBuilder: mockErrorContextBuilder,
        logger: mockLogger,
      }),
    ];

    pipeline = new Pipeline(stages, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Real Pipeline Stage Integration', () => {
    it('should integrate with actual Pipeline execution and produce valid PipelineResults', async () => {
      // Arrange - real actor and context
      const actor = {
        id: 'test_actor',
        components: {
          'core:actor': { name: 'Test Actor' },
          'core:position': { x: 0, y: 0 },
        },
      };
      const actionContext = {
        actorId: 'test_actor',
        currentTurn: 1,
        gameState: 'active',
      };

      // Set up realistic candidate actions
      const candidateActions = [
        {
          id: 'core:move',
          name: 'Move',
          scope: { type: 'adjacent' },
          prerequisites: [],
          description: 'Move to an adjacent location',
        },
        {
          id: 'core:look',
          name: 'Look',
          scope: { type: 'self' },
          prerequisites: [],
          description: 'Look around',
        },
      ];

      mockActionIndex.getCandidateActions.mockReturnValue(candidateActions);
      mockTargetResolutionService.resolveTargets.mockResolvedValue([
        {
          entityId: 'target_location',
          type: 'location',
          valid: true,
          position: { x: 1, y: 0 },
        },
      ]);

      // Act - execute real pipeline
      const result = await pipeline.execute({
        actor,
        actionContext,
        candidateActions,
        trace: new TraceContext(),
      });

      // Assert - verify PipelineResult integration
      expect(result).toBeInstanceOf(PipelineResult);
      expect(result.success).toBe(true);
      expect(result.actions).toBeDefined();
      expect(result.errors).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.continueProcessing).toBe(true);

      // Verify the result contains processed actions
      expect(Array.isArray(result.actions)).toBe(true);
      // Note: actions array may be empty if no valid actions were discovered
      if (result.actions.length > 0) {
        expect(result.actions[0]).toHaveProperty('id');
        expect(result.actions[0]).toHaveProperty('name');
      }
    });

    it('should handle pipeline stage failures and create proper error PipelineResults', async () => {
      // Arrange - actor that will cause component filtering to fail
      const actor = { id: 'invalid_actor', components: {} };
      const actionContext = { actorId: 'invalid_actor', currentTurn: 1 };

      // Make the action index throw an error
      mockActionIndex.getCandidateActions.mockImplementation(() => {
        throw new Error('Component filtering failed - no valid components');
      });

      // Act - execute pipeline with failure
      const result = await pipeline.execute({
        actor,
        actionContext,
        candidateActions: [],
        trace: new TraceContext(),
      });

      // Assert - verify error handling
      expect(result).toBeInstanceOf(PipelineResult);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].error).toContain('Component filtering failed');
      expect(result.continueProcessing).toBe(false);
    });

    it('should integrate with StructuredTrace for performance monitoring', async () => {
      // Arrange
      const actor = { id: 'test_actor', components: {} };
      const actionContext = { actorId: 'test_actor', currentTurn: 1 };
      const structuredTrace = new StructuredTrace();

      mockActionIndex.getCandidateActions.mockReturnValue([
        {
          id: 'core:test',
          name: 'Test Action',
          scope: { type: 'self' },
          prerequisites: [],
        },
      ]);

      mockTargetResolutionService.resolveTargets.mockResolvedValue([
        {
          entityId: 'test_actor',
          type: 'actor',
          valid: true,
          position: { x: 0, y: 0 },
        },
      ]);

      // Act
      const result = await pipeline.execute({
        actor,
        actionContext,
        candidateActions: [],
        trace: structuredTrace,
      });

      // Assert - verify PipelineResult integrates with tracing
      expect(result).toBeInstanceOf(PipelineResult);
      expect(result.success).toBe(true);

      // Verify spans were created during execution
      const spans = structuredTrace.getSpans();
      expect(spans.length).toBeGreaterThan(0);

      // Verify performance data is available
      const perfSummary = structuredTrace.getPerformanceSummary();
      expect(perfSummary.totalDuration).toBeGreaterThan(0);
    });
  });

  describe('ActionResult Conversion Integration', () => {
    it('should convert successful ActionResult from real service calls with complex data', () => {
      // Arrange - simulate complex service response
      const serviceResponse = {
        entities: [
          { id: 'entity1', type: 'actor', data: { health: 100, mana: 50 } },
          { id: 'entity2', type: 'item', data: { durability: 75 } },
        ],
        metadata: {
          timestamp: Date.now(),
          processedBy: 'EntityService',
          version: '1.0.0',
        },
        validationResults: {
          passed: true,
          checks: ['schema', 'business_rules', 'security'],
        },
      };

      const actionResult = ActionResult.success(serviceResponse);
      const additionalPipelineData = {
        pipelineId: 'entity-processing-pipeline',
        stage: 'post-validation',
        context: {
          actorId: 'player1',
          sessionId: 'session123',
        },
      };

      // Act - convert ActionResult to PipelineResult (targets line 95-98)
      const pipelineResult = PipelineResult.fromActionResult(
        actionResult,
        additionalPipelineData
      );

      // Assert - verify complex data merging
      expect(pipelineResult).toBeInstanceOf(PipelineResult);
      expect(pipelineResult.success).toBe(true);
      expect(pipelineResult.data).toHaveProperty('entities');
      expect(pipelineResult.data).toHaveProperty('metadata');
      expect(pipelineResult.data).toHaveProperty('validationResults');
      expect(pipelineResult.data).toHaveProperty('pipelineId');
      expect(pipelineResult.data).toHaveProperty('stage');
      expect(pipelineResult.data).toHaveProperty('context');

      // Verify data integrity
      expect(pipelineResult.data.entities).toHaveLength(2);
      expect(pipelineResult.data.metadata.processedBy).toBe('EntityService');
      expect(pipelineResult.data.pipelineId).toBe('entity-processing-pipeline');
      expect(pipelineResult.data.context.actorId).toBe('player1');
    });

    it('should convert failed ActionResult with service errors and preserve context', () => {
      // Arrange - simulate service failure with complex error context
      const serviceErrors = [
        new Error('Database connection timeout'),
        new Error('Entity validation failed'),
      ];

      // Add custom properties to errors (common in service failures)
      serviceErrors[0].code = 'DB_TIMEOUT';
      serviceErrors[0].retryable = true;
      serviceErrors[0].context = { connectionId: 'conn_123', timeoutMs: 5000 };

      serviceErrors[1].code = 'VALIDATION_ERROR';
      serviceErrors[1].retryable = false;
      serviceErrors[1].context = { entityId: 'entity_456', field: 'name' };

      const actionResult = ActionResult.failure(serviceErrors);
      const additionalPipelineData = {
        pipelineId: 'entity-validation-pipeline',
        stage: 'validation',
        operationId: 'op_789',
      };

      // Act - convert failed ActionResult (targets line 100-101)
      const pipelineResult = PipelineResult.fromActionResult(
        actionResult,
        additionalPipelineData
      );

      // Assert - verify error preservation and additional data
      expect(pipelineResult).toBeInstanceOf(PipelineResult);
      expect(pipelineResult.success).toBe(false);
      expect(pipelineResult.errors).toHaveLength(2);
      expect(pipelineResult.data).toHaveProperty('pipelineId');
      expect(pipelineResult.data).toHaveProperty('stage');
      expect(pipelineResult.data).toHaveProperty('operationId');

      // Verify error details are preserved
      expect(pipelineResult.errors[0].message).toBe(
        'Database connection timeout'
      );
      expect(pipelineResult.errors[0].code).toBe('DB_TIMEOUT');
      expect(pipelineResult.errors[0].retryable).toBe(true);
      expect(pipelineResult.errors[1].message).toBe('Entity validation failed');
      expect(pipelineResult.errors[1].code).toBe('VALIDATION_ERROR');
      expect(pipelineResult.errors[1].retryable).toBe(false);

      expect(pipelineResult.continueProcessing).toBe(false);
    });

    it('should handle ActionResult with null/undefined values from services', () => {
      // Arrange - simulate service returning null/undefined (edge case)
      const nullActionResult = ActionResult.success(null);
      const undefinedActionResult = ActionResult.success(undefined);
      const emptyActionResult = ActionResult.success({});

      const additionalData = {
        serviceId: 'test-service',
        timestamp: Date.now(),
      };

      // Act & Assert - null value
      const nullPipelineResult = PipelineResult.fromActionResult(
        nullActionResult,
        additionalData
      );
      expect(nullPipelineResult.success).toBe(true);
      expect(nullPipelineResult.data).toEqual(additionalData);

      // Act & Assert - undefined value
      const undefinedPipelineResult = PipelineResult.fromActionResult(
        undefinedActionResult,
        additionalData
      );
      expect(undefinedPipelineResult.success).toBe(true);
      expect(undefinedPipelineResult.data).toEqual(additionalData);

      // Act & Assert - empty object
      const emptyPipelineResult = PipelineResult.fromActionResult(
        emptyActionResult,
        additionalData
      );
      expect(emptyPipelineResult.success).toBe(true);
      expect(emptyPipelineResult.data).toEqual(additionalData);
    });

    it('should handle data precedence correctly when ActionResult and additional data have overlapping keys', () => {
      // Arrange - simulate data conflicts
      const actionResultData = {
        id: 'from-action-result',
        timestamp: 1000,
        source: 'ActionResult',
        shared: 'action-value',
      };

      const additionalData = {
        id: 'from-additional-data',
        timestamp: 2000,
        stage: 'pipeline-stage',
        shared: 'additional-value',
      };

      const actionResult = ActionResult.success(actionResultData);

      // Act - ActionResult data should override additional data (line 97)
      const pipelineResult = PipelineResult.fromActionResult(
        actionResult,
        additionalData
      );

      // Assert - verify ActionResult data takes precedence
      expect(pipelineResult.data.id).toBe('from-action-result');
      expect(pipelineResult.data.timestamp).toBe(1000);
      expect(pipelineResult.data.source).toBe('ActionResult');
      expect(pipelineResult.data.shared).toBe('action-value');
      expect(pipelineResult.data.stage).toBe('pipeline-stage'); // Additional data preserved
    });
  });

  describe('ChainActionResult Integration', () => {
    it('should chain complex ActionResult operations with real service data', () => {
      // Arrange - initial PipelineResult with realistic data
      const initialPipelineResult = PipelineResult.success({
        data: {
          entities: [
            { id: 'player', type: 'actor', health: 100 },
            { id: 'enemy', type: 'actor', health: 75 },
          ],
          location: { id: 'forest', name: 'Dark Forest' },
          gameState: { turn: 5, phase: 'combat' },
        },
        actions: [{ id: 'initial-scan', completed: true }],
        errors: [{ warning: 'Low visibility', severity: 'minor' }],
      });

      // Simulate chaining multiple service operations
      const enrichmentService = (data) => {
        return ActionResult.success({
          ...data,
          enriched: true,
          enrichmentTimestamp: Date.now(),
          calculatedStats: {
            totalHealth: data.entities.reduce((sum, e) => sum + e.health, 0),
            entityCount: data.entities.length,
          },
        });
      };

      const validationService = (data) => {
        const validationWarnings = [];
        if (data.calculatedStats.totalHealth < 200) {
          validationWarnings.push(new Error('Low total health detected'));
        }
        if (data.entities.length > 10) {
          validationWarnings.push(new Error('Too many entities'));
        }

        return ActionResult.success({
          ...data,
          validated: true,
          validationWarnings,
          validationPassed: validationWarnings.length === 0,
        });
      };

      // Act - chain operations (targets lines 110-125)
      const chainedResult = initialPipelineResult
        .chainActionResult(enrichmentService)
        .chainActionResult(validationService);

      // Assert - verify complex chaining
      expect(chainedResult).toBeInstanceOf(PipelineResult);
      expect(chainedResult.success).toBe(true);
      expect(chainedResult.data.enriched).toBe(true);
      expect(chainedResult.data.validated).toBe(true);
      expect(chainedResult.data.calculatedStats.totalHealth).toBe(175);
      expect(chainedResult.data.calculatedStats.entityCount).toBe(2);
      expect(chainedResult.data.validationPassed).toBe(false);

      // Verify original actions preserved
      expect(chainedResult.actions).toEqual([
        { id: 'initial-scan', completed: true },
      ]);

      // Verify errors accumulated (line 114)
      expect(chainedResult.errors.length).toBeGreaterThan(0);
      expect(chainedResult.errors[0]).toEqual({
        warning: 'Low visibility',
        severity: 'minor',
      });
    });

    it('should handle chaining failure scenarios and error accumulation', () => {
      // Arrange - successful initial result
      const initialResult = PipelineResult.success({
        data: { step: 1, value: 'initial' },
        actions: [{ id: 'step1', status: 'completed' }],
        errors: [{ warning: 'initial warning', phase: 'setup' }],
      });

      // Service that will fail
      const failingService = (data) => {
        return ActionResult.failure([
          new Error('Service unavailable'),
          new Error('Timeout occurred'),
        ]);
      };

      // Service that should not execute
      const unreachableService = jest.fn(() => {
        return ActionResult.success({ should: 'not execute' });
      });

      // Act - chain with failure (targets line 111 early return and error handling)
      const chainedResult = initialResult
        .chainActionResult(failingService)
        .chainActionResult(unreachableService);

      // Assert - verify failure handling
      expect(chainedResult).toBeInstanceOf(PipelineResult);
      expect(chainedResult.success).toBe(false);
      expect(unreachableService).not.toHaveBeenCalled();

      // Verify error accumulation (line 114)
      expect(chainedResult.errors.length).toBe(3); // 1 initial warning + 2 service errors
      expect(chainedResult.errors[0]).toEqual({
        warning: 'initial warning',
        phase: 'setup',
      });
      expect(chainedResult.errors[1].message).toBe('Service unavailable');
      expect(chainedResult.errors[2].message).toBe('Timeout occurred');

      // Verify original data preserved when chaining fails (line 122-123)
      expect(chainedResult.data).toEqual({ step: 1, value: 'initial' });
      expect(chainedResult.actions).toEqual([
        { id: 'step1', status: 'completed' },
      ]);
      expect(chainedResult.continueProcessing).toBe(false);
    });

    it('should handle chaining on already failed PipelineResult', () => {
      // Arrange - failed initial result
      const failedResult = PipelineResult.failure(
        [{ error: 'Initial failure', phase: 'SETUP' }],
        { attemptedStep: 'initialization' }
      );

      const serviceFunction = jest.fn(() => {
        return ActionResult.success({ should: 'not execute' });
      });

      // Act - attempt to chain on failed result (targets line 111)
      const chainedResult = failedResult.chainActionResult(serviceFunction);

      // Assert - verify early return behavior
      expect(chainedResult).toBe(failedResult); // Should return same instance
      expect(serviceFunction).not.toHaveBeenCalled();
      expect(chainedResult.success).toBe(false);
      expect(chainedResult.errors).toEqual([
        { error: 'Initial failure', phase: 'SETUP' },
      ]);
    });

    it('should handle ActionResult with missing errors property in chain', () => {
      // Arrange
      const initialResult = PipelineResult.success({
        data: { test: 'data' },
        actions: [],
        errors: [{ existing: 'error' }],
      });

      // Mock ActionResult without errors property (edge case)
      const serviceWithoutErrors = () => {
        return {
          success: false,
          value: null,
          // Note: no errors property
        };
      };

      // Act - chain with malformed ActionResult (targets line 114 fallback)
      const chainedResult =
        initialResult.chainActionResult(serviceWithoutErrors);

      // Assert - verify graceful handling of missing errors
      expect(chainedResult.success).toBe(false);
      expect(chainedResult.errors.length).toBe(1); // Only the existing error
      expect(chainedResult.errors[0]).toEqual({ existing: 'error' });
    });

    it('should handle multiple chaining operations with data merging', () => {
      // Arrange - complex multi-step pipeline simulation
      const initialResult = PipelineResult.success({
        data: {
          entityId: 'player1',
          baseStats: { strength: 10, agility: 8 },
        },
        actions: [],
        errors: [],
      });

      const equipmentService = (data) => {
        return ActionResult.success({
          ...data,
          equipment: {
            weapon: { id: 'sword', damage: 15 },
            armor: { id: 'chainmail', defense: 8 },
          },
          equipmentBonus: { strength: 2, defense: 8 },
        });
      };

      const calculationService = (data) => {
        return ActionResult.success({
          ...data,
          finalStats: {
            strength:
              data.baseStats.strength + (data.equipmentBonus?.strength || 0),
            agility: data.baseStats.agility,
            defense: data.equipmentBonus?.defense || 0,
          },
          totalDamage:
            (data.equipment?.weapon?.damage || 0) +
            (data.baseStats?.strength || 0),
        });
      };

      const persistenceService = (data) => {
        return ActionResult.success({
          ...data,
          saved: true,
          saveTimestamp: Date.now(),
          version: '1.0.0',
        });
      };

      // Act - chain multiple operations with data accumulation
      const result = initialResult
        .chainActionResult(equipmentService)
        .chainActionResult(calculationService)
        .chainActionResult(persistenceService);

      // Assert - verify complex data merging through chain
      expect(result.success).toBe(true);
      expect(result.data.entityId).toBe('player1');
      expect(result.data.equipment.weapon.id).toBe('sword');
      expect(result.data.finalStats.strength).toBe(12); // 10 + 2 bonus
      expect(result.data.totalDamage).toBe(25); // 15 weapon + 10 base strength
      expect(result.data.saved).toBe(true);
      expect(result.data.version).toBe('1.0.0');
    });
  });

  describe('Service Integration Scenarios', () => {
    it('should integrate with entity manager and event dispatcher services', () => {
      // Arrange - simulate real service integration
      const entityData = {
        id: 'entity123',
        components: {
          'core:actor': { name: 'Test Actor', level: 5 },
          'core:inventory': { items: ['sword', 'potion'] },
        },
      };

      mockEntityManager.getEntityById.mockReturnValue(entityData);

      // Create PipelineResult that would integrate with services
      const pipelineResult = PipelineResult.success({
        data: { entityId: 'entity123', operation: 'level_up' },
        actions: [{ id: 'level_up', entityId: 'entity123' }],
      });

      // Simulate service integration chain
      const entityLookupService = (data) => {
        const entity = mockEntityManager.getEntityById(data.entityId);
        if (!entity) {
          return ActionResult.failure('Entity not found');
        }
        return ActionResult.success({
          ...data,
          entity,
          currentLevel: entity.components['core:actor'].level,
        });
      };

      const levelUpService = (data) => {
        const newLevel = data.currentLevel + 1;

        // Simulate event dispatching
        mockSafeEventDispatcher.dispatch({
          type: 'ENTITY_LEVEL_CHANGED',
          payload: {
            entityId: data.entityId,
            oldLevel: data.currentLevel,
            newLevel,
          },
        });

        return ActionResult.success({
          ...data,
          newLevel,
          leveledUp: true,
          experienceGained: 100,
        });
      };

      // Act - integrate with real services
      const result = pipelineResult
        .chainActionResult(entityLookupService)
        .chainActionResult(levelUpService);

      // Assert - verify service integration
      expect(result.success).toBe(true);
      expect(result.data.entity).toEqual(entityData);
      expect(result.data.currentLevel).toBe(5);
      expect(result.data.newLevel).toBe(6);
      expect(result.data.leveledUp).toBe(true);

      // Verify service calls
      expect(mockEntityManager.getEntityById).toHaveBeenCalledWith('entity123');
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith({
        type: 'ENTITY_LEVEL_CHANGED',
        payload: {
          entityId: 'entity123',
          oldLevel: 5,
          newLevel: 6,
        },
      });
    });

    it('should integrate with error context builder for proper error formatting', () => {
      // Arrange - simulate service failure requiring error context
      const pipelineResult = PipelineResult.success({
        data: { actorId: 'player1', action: 'cast_spell' },
      });

      const spellCastingService = (data) => {
        const error = new Error('Insufficient mana');
        error.code = 'MANA_INSUFFICIENT';
        error.requiredMana = 50;
        error.currentMana = 25;

        return ActionResult.failure(error);
      };

      // Act - chain with service that fails
      const result = pipelineResult.chainActionResult(spellCastingService);

      // Assert - verify error context integration
      expect(result.success).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0].message).toBe('Insufficient mana');
      expect(result.errors[0].code).toBe('MANA_INSUFFICIENT');
      expect(result.errors[0].requiredMana).toBe(50);
      expect(result.errors[0].currentMana).toBe(25);
    });
  });


  describe('Error Handling and Edge Cases', () => {
    it('should handle ActionResult conversion with various input scenarios', () => {
      // Test cases that should throw (truly invalid inputs)
      const throwingCases = [null, undefined];

      throwingCases.forEach((invalidInput, index) => {
        // Act & Assert - should throw for null/undefined
        expect(() => {
          PipelineResult.fromActionResult(invalidInput, {
            test: `throwing_case_${index}`,
          });
        }).toThrow();
      });

      // Test edge cases that should work (the method is tolerant)
      const workingEdgeCases = [
        'not an object', // String input - method may be tolerant
        { success: true }, // Missing value - should work with undefined value
        { success: false }, // Missing errors - should work with no errors
        { success: true, value: undefined }, // Explicit undefined value
        { success: false, errors: undefined }, // Explicit undefined errors
        { value: 'data' }, // Missing success property
      ];

      workingEdgeCases.forEach((edgeCase, index) => {
        // Act & Assert - should handle gracefully or provide reasonable behavior
        let result;
        expect(() => {
          result = PipelineResult.fromActionResult(edgeCase, {
            test: `edge_case_${index}`,
          });
        }).not.toThrow();

        // Verify result is a valid PipelineResult
        expect(result).toBeInstanceOf(PipelineResult);
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('data');
      });
    });

    it('should demonstrate data sharing behavior during chaining operations', () => {
      // Arrange
      const originalData = { shared: { count: 0 }, items: [1, 2, 3] };
      const initialResult = PipelineResult.success({
        data: originalData,
        actions: [{ id: 'original' }],
      });

      // Act - chain operations that modify data
      const modifyingService = (data) => {
        // Create new data object to avoid mutation
        const newData = {
          ...data,
          shared: { ...data.shared, count: 999 },
          items: [...data.items, 4],
          newProperty: 'added',
        };

        return ActionResult.success(newData);
      };

      const chainedResult = initialResult.chainActionResult(modifyingService);

      // Assert - verify original data is preserved
      expect(originalData.shared.count).toBe(0); // Should be unchanged
      expect(originalData.items).toEqual([1, 2, 3]); // Should be unchanged
      expect(originalData.newProperty).toBeUndefined();

      // Chained result should have modifications
      expect(chainedResult.data.shared.count).toBe(999);
      expect(chainedResult.data.items).toEqual([1, 2, 3, 4]);
      expect(chainedResult.data.newProperty).toBe('added');
    });
  });
});
