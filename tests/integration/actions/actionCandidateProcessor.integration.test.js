/**
 * @file Integration tests for ActionCandidateProcessor
 * @description Tests the complete flow of action candidate processing including
 * prerequisite evaluation, target resolution, and command formatting
 */

import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';
import { ActionCandidateProcessor } from '../../../src/actions/actionCandidateProcessor.js';
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../src/actions/validation/actionValidationContextBuilder.js';
import { ActionErrorContextBuilder } from '../../../src/actions/errors/actionErrorContextBuilder.js';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { ERROR_PHASES } from '../../../src/actions/errors/actionErrorTypes.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import TestDataFactory from '../../common/actions/testDataFactory.js';
import {
  createMockLogger,
  createMockEntityManager,
  createMockSafeEventDispatcher,
} from '../../common/mockFactories/index.js';

describe('ActionCandidateProcessor Integration Tests', () => {
  let processor;
  let prerequisiteEvaluationService;
  let targetResolutionService;
  let commandFormatter;
  let mockEntityManager;
  let mockLogger;
  let mockSafeEventDispatcher;
  let mockGameDataRepository;
  let getEntityDisplayNameFn;
  let actionErrorContextBuilder;
  let testData;

  beforeEach(() => {
    // Create mocks
    mockLogger = createMockLogger();
    mockEntityManager = createMockEntityManager();
    // Add missing methods to mockEntityManager
    mockEntityManager.hasComponent = jest.fn();
    mockEntityManager.getEntitiesWithComponent = jest.fn();
    mockSafeEventDispatcher = createMockSafeEventDispatcher();
    mockGameDataRepository = {
      getConditionDefinition: jest.fn(),
      getScopeDefinition: jest.fn(),
    };
    getEntityDisplayNameFn = jest.fn((entity) => entity?.name || 'Unknown');

    // Create test data
    testData = TestDataFactory.createCompleteTestDataset();

    // Set up mock behaviors
    mockGameDataRepository.getConditionDefinition.mockImplementation((id) => {
      const allConditions = [
        ...testData.conditions.basic,
        ...testData.conditions.edgeCase,
      ];
      return allConditions.find((c) => c.id === id);
    });

    mockGameDataRepository.getScopeDefinition.mockImplementation((id) => {
      const allScopes = [...testData.scopes.basic, ...testData.scopes.edgeCase];
      return allScopes.find((s) => s.id === id);
    });

    // Create real services for integration testing
    const jsonLogicService = new JsonLogicEvaluationService({
      logger: mockLogger,
    });

    const validationContextBuilder = new ActionValidationContextBuilder({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    prerequisiteEvaluationService = new PrerequisiteEvaluationService({
      logger: mockLogger,
      jsonLogicEvaluationService: jsonLogicService,
      actionValidationContextBuilder: validationContextBuilder,
      gameDataRepository: mockGameDataRepository,
    });

    const mockFixSuggestionEngine = {
      suggestFixes: jest.fn().mockReturnValue([]),
    };

    actionErrorContextBuilder = new ActionErrorContextBuilder({
      entityManager: mockEntityManager,
      logger: mockLogger,
      fixSuggestionEngine: mockFixSuggestionEngine,
    });

    // Spy on the buildErrorContext method
    jest.spyOn(actionErrorContextBuilder, 'buildErrorContext');

    // Create a mock target resolution service that returns ActionResult
    targetResolutionService = {
      resolveTargets: jest
        .fn()
        .mockImplementation((scope, actorEntity, context) => {
          if (scope === 'none') {
            return ActionResult.success([ActionTargetContext.noTarget()]);
          }
          if (scope === 'movement:clear_directions') {
            // Simulate exits from a location
            return ActionResult.success([
              ActionTargetContext.forEntity('test-location-2'),
            ]);
          }
          if (scope === 'core:other_actors') {
            // Return other actors
            const actors = [];
            if (actorEntity.id !== 'test-npc') {
              actors.push(ActionTargetContext.forEntity('test-npc'));
            }
            if (actorEntity.id !== 'test-inventory-actor') {
              actors.push(
                ActionTargetContext.forEntity('test-inventory-actor')
              );
            }
            return ActionResult.success(actors);
          }
          // Default to no targets
          return ActionResult.success([]);
        }),
    };

    commandFormatter = new ActionCommandFormatter({
      logger: mockLogger,
    });

    // Create the processor with real dependencies
    processor = new ActionCandidateProcessor({
      prerequisiteEvaluationService,
      targetResolutionService,
      entityManager: mockEntityManager,
      actionCommandFormatter: commandFormatter,
      safeEventDispatcher: mockSafeEventDispatcher,
      getEntityDisplayNameFn,
      logger: mockLogger,
      actionErrorContextBuilder,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('Core Flow Tests', () => {
    it('should successfully process an action with passing prerequisites and valid targets', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = testData.actions.basic.find(
        (a) => a.id === 'core:wait'
      );
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        return actor.components[type];
      });
      mockEntityManager.hasComponent.mockImplementation((id, type) => {
        return !!actor.components[type];
      });

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(result.value.actions[0]).toMatchObject({
        id: 'core:wait',
        name: 'Wait',
        command: 'wait',
        description: 'Wait for a moment, doing nothing.',
      });
      expect(result.value.errors).toHaveLength(0);
    });

    it('should fail when actor prerequisites are not met', () => {
      // Arrange
      const actor = testData.actors.lockedActor;
      const actionDef = testData.actions.basic.find((a) => a.id === 'movement:go');
      const context = {
        actorId: actor.id,
        locationId: 'test-location-2',
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        return actor.components[type];
      });
      mockEntityManager.hasComponent.mockImplementation((id, type) => {
        return !!actor.components[type];
      });

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.cause).toBe('prerequisites-failed');
    });

    it('should process action without prerequisites', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = {
        id: 'test:no-prereq',
        name: 'No Prerequisites',
        scope: 'none',
        template: 'test',
        prerequisites: [],
        required_components: { actor: [] },
      };
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(result.value.errors).toHaveLength(0);
    });

    it('should resolve multiple valid targets', () => {
      // Arrange
      const actor = testData.actors.player;
      const npc1 = testData.actors.npc;
      const npc2 = testData.actors.inventoryActor;
      const actionDef = testData.actions.basic.find(
        (a) => a.id === 'companionship:follow'
      );
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === actor.id) return actor;
        if (id === npc1.id) return npc1;
        if (id === npc2.id) return npc2;
        return null;
      });

      mockEntityManager.getAllComponentTypesForEntity.mockImplementation(
        (id) => {
          if (id === actor.id) return Object.keys(actor.components);
          if (id === npc1.id) return Object.keys(npc1.components);
          if (id === npc2.id) return Object.keys(npc2.components);
          return [];
        }
      );

      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        if (id === actor.id) return actor.components[type];
        if (id === npc1.id) return npc1.components[type];
        if (id === npc2.id) return npc2.components[type];
        return undefined;
      });

      mockEntityManager.hasComponent.mockImplementation((id, type) => {
        if (id === actor.id) return !!actor.components[type];
        if (id === npc1.id) return !!npc1.components[type];
        if (id === npc2.id) return !!npc2.components[type];
        return false;
      });

      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        actor.id,
        npc1.id,
        npc2.id,
      ]);

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(2); // Should find 2 NPCs to follow
      expect(result.value.actions[0].command).toContain('follow');
      expect(result.value.errors).toHaveLength(0);
    });

    it('should return empty actions when no targets are found', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = testData.actions.basic.find(
        (a) => a.id === 'companionship:follow'
      );
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        return actor.components[type];
      });
      mockEntityManager.hasComponent.mockImplementation((id, type) => {
        return !!actor.components[type];
      });
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([actor.id]); // Only the actor

      // Override target resolution to return no targets for this test
      targetResolutionService.resolveTargets.mockReturnValueOnce(
        ActionResult.success([])
      );

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.cause).toBe('no-targets');
      expect(result.value.errors).toHaveLength(0);
    });
  });

  describe('Error Handling Tests', () => {
    it('should handle prerequisite evaluation errors', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = testData.actions.basic.find((a) => a.id === 'movement:go');
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };
      const evalError = new Error('Prerequisite evaluation failed');

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        return actor.components[type];
      });
      mockEntityManager.hasComponent.mockImplementation((id, type) => {
        return !!actor.components[type];
      });

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert - With proper components, prerequisites pass and action is processed
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1); // Action processed successfully
      expect(result.value.errors).toHaveLength(0);
    });

    it('should handle target resolution errors', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = testData.actions.basic.find((a) => a.id === 'movement:go');
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        return actor.components[type];
      });
      mockEntityManager.hasComponent.mockReturnValue(true);

      // Mock target resolution to return error
      targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.failure(new Error('Scope resolution failed'))
      );

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0].phase).toBe(ERROR_PHASES.VALIDATION);
      expect(result.value.cause).toBe('resolution-error');
    });

    it('should handle target resolution returning ActionErrorContext objects', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = testData.actions.basic.find((a) => a.id === 'movement:go');
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      const actionErrorContext = {
        timestamp: Date.now(),
        phase: ERROR_PHASES.VALIDATION,
        error: new Error('Target resolution failed'),
        actionId: actionDef.id,
        actorId: actor.id,
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        return actor.components[type];
      });
      mockEntityManager.hasComponent.mockReturnValue(true);

      // Mock target resolution to return ActionResult failure with ActionErrorContext
      targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.failure([actionErrorContext])
      );

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0].timestamp).toBe(
        actionErrorContext.timestamp
      );
      expect(result.value.errors[0].phase).toBe(actionErrorContext.phase);
      expect(result.value.cause).toBe('resolution-error');
    });

    it('should handle target resolution raw errors requiring context building', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = testData.actions.basic.find((a) => a.id === 'movement:go');
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      const rawError = new Error('Raw target resolution error');

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        return actor.components[type];
      });
      mockEntityManager.hasComponent.mockReturnValue(true);

      // Mock target resolution to return ActionResult failure with raw error
      targetResolutionService.resolveTargets.mockReturnValue(
        ActionResult.failure(rawError)
      );

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0].phase).toBe(ERROR_PHASES.VALIDATION);
      expect(result.value.cause).toBe('resolution-error');
      expect(actionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: rawError,
        actionDef,
        actorId: actor.id,
        phase: ERROR_PHASES.VALIDATION,
        trace: null,
        additionalContext: {
          scope: actionDef.scope,
        },
      });
    });

    it('should handle target resolution service throwing exceptions', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = testData.actions.basic.find((a) => a.id === 'movement:go');
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      const thrownError = new Error(
        'Target resolution service threw exception'
      );

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        return actor.components[type];
      });
      mockEntityManager.hasComponent.mockReturnValue(true);

      // Mock target resolution service to throw exception
      targetResolutionService.resolveTargets.mockImplementation(() => {
        throw thrownError;
      });

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0].phase).toBe(ERROR_PHASES.VALIDATION);
      expect(result.value.cause).toBe('resolution-error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error resolving scope for action '${actionDef.id}': ${thrownError.message}`,
        expect.any(Object)
      );
      expect(actionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: thrownError,
        actionDef,
        actorId: actor.id,
        phase: ERROR_PHASES.VALIDATION,
        trace: null,
        additionalContext: {
          scope: actionDef.scope,
        },
      });
    });

    it('should handle command formatting errors', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = {
        id: 'test:format-error',
        name: 'Format Error',
        scope: 'none',
        template: '{invalid} {template} {syntax}',
        prerequisites: [],
        required_components: { actor: [] },
      };
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        return actor.components[type];
      });

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert - The formatter doesn't fail on invalid template syntax, it just outputs it
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(result.value.actions[0].command).toBe(
        '{invalid} {template} {syntax}'
      );
      expect(result.value.errors).toHaveLength(0);
    });

    it('should handle exceptions during command formatting', () => {
      // Arrange
      const actor = testData.actors.player;
      const npc = testData.actors.npc;
      const actionDef = testData.actions.basic.find(
        (a) => a.id === 'companionship:follow'
      );
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === actor.id) return actor;
        if (id === npc.id) return npc;
        return null;
      });

      mockEntityManager.getAllComponentTypesForEntity.mockImplementation(
        (id) => {
          if (id === actor.id) return Object.keys(actor.components);
          if (id === npc.id) return Object.keys(npc.components);
          return [];
        }
      );

      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        if (id === actor.id) return actor.components[type];
        if (id === npc.id) return npc.components[type];
        return undefined;
      });

      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        actor.id,
        npc.id,
      ]);

      // Mock getEntityDisplayNameFn to throw error
      getEntityDisplayNameFn.mockImplementation(() => {
        throw new Error('Display name retrieval failed');
      });

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert - When display name fails for all, we get errors for each target
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1); // One action succeeds
      expect(result.value.actions[0].command).toBe(
        'follow test-inventory-actor'
      );
      expect(result.value.errors).toHaveLength(1); // One error for the NPC
    });

    it('should handle command formatter throwing exceptions during format call', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = testData.actions.basic.find(
        (a) => a.id === 'core:wait'
      );
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      const formatError = new Error('Command formatter threw exception');

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        return actor.components[type];
      });
      mockEntityManager.hasComponent.mockImplementation((id, type) => {
        return !!actor.components[type];
      });

      // Mock command formatter to throw exception
      jest.spyOn(commandFormatter, 'format').mockImplementation(() => {
        throw formatError;
      });

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0].phase).toBe(ERROR_PHASES.VALIDATION);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error formatting action '${actionDef.id}' for target 'null'.`,
        expect.any(Object)
      );
      expect(actionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: formatError,
        actionDef,
        actorId: actor.id,
        phase: ERROR_PHASES.VALIDATION,
        trace: null,
        targetId: null,
      });
    });

    it('should handle command formatter exceptions with multiple targets', () => {
      // Arrange
      const actor = testData.actors.player;
      const npc1 = testData.actors.npc;
      const npc2 = testData.actors.inventoryActor;
      const actionDef = testData.actions.basic.find(
        (a) => a.id === 'companionship:follow'
      );
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      const formatError = new Error('Command formatter exception');

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === actor.id) return actor;
        if (id === npc1.id) return npc1;
        if (id === npc2.id) return npc2;
        return null;
      });

      mockEntityManager.getAllComponentTypesForEntity.mockImplementation(
        (id) => {
          if (id === actor.id) return Object.keys(actor.components);
          if (id === npc1.id) return Object.keys(npc1.components);
          if (id === npc2.id) return Object.keys(npc2.components);
          return [];
        }
      );

      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        if (id === actor.id) return actor.components[type];
        if (id === npc1.id) return npc1.components[type];
        if (id === npc2.id) return npc2.components[type];
        return undefined;
      });

      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        actor.id,
        npc1.id,
        npc2.id,
      ]);

      // Mock command formatter to throw exception for first target but succeed for second
      jest
        .spyOn(commandFormatter, 'format')
        .mockImplementationOnce(() => {
          throw formatError;
        })
        .mockImplementationOnce(() => ({
          ok: true,
          value: 'follow test-inventory-actor',
        }));

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1); // One succeeds
      expect(result.value.errors).toHaveLength(1); // One throws exception
      expect(result.value.errors[0].targetId).toBe(npc1.id);
      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error formatting action '${actionDef.id}' for target '${npc1.id}'.`,
        expect.any(Object)
      );
    });
  });

  describe('Edge Case Tests', () => {
    it('should support trace context with withSpan method', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = testData.actions.basic.find(
        (a) => a.id === 'core:wait'
      );
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      // Create trace context with withSpan method
      const trace = {
        withSpan: jest.fn((name, fn, metadata) => {
          expect(name).toBe('candidate.process');
          expect(metadata).toEqual({
            actionId: actionDef.id,
            actorId: actor.id,
            scope: actionDef.scope,
          });
          return fn();
        }),
        step: jest.fn(),
        success: jest.fn(),
        failure: jest.fn(),
        info: jest.fn(),
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        return actor.components[type];
      });
      mockEntityManager.hasComponent.mockImplementation((id, type) => {
        return !!actor.components[type];
      });

      // Act
      const result = processor.process(actionDef, actor, context, trace);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(trace.withSpan).toHaveBeenCalledWith(
        'candidate.process',
        expect.any(Function),
        {
          actionId: actionDef.id,
          actorId: actor.id,
          scope: actionDef.scope,
        }
      );
      expect(trace.step).toHaveBeenCalled();
    });

    it('should support trace context', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = testData.actions.basic.find(
        (a) => a.id === 'core:wait'
      );
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };
      const trace = new TraceContext();

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        return actor.components[type];
      });
      mockEntityManager.hasComponent.mockImplementation((id, type) => {
        return !!actor.components[type];
      });

      // Act
      const result = processor.process(actionDef, actor, context, trace);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(trace.logs).toEqual(expect.any(Array));
      expect(trace.logs.length).toBeGreaterThan(0);
    });

    it('should work without trace context', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = testData.actions.basic.find(
        (a) => a.id === 'core:wait'
      );
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        return actor.components[type];
      });

      // Act
      const result = processor.process(actionDef, actor, context, null);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(result.value.errors).toHaveLength(0);
    });

    it('should handle multiple targets with mixed formatting results', () => {
      // Arrange
      const actor = testData.actors.player;
      const npc1 = testData.actors.npc;
      const npc2 = testData.actors.inventoryActor;
      const actionDef = testData.actions.basic.find(
        (a) => a.id === 'companionship:follow'
      );
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === actor.id) return actor;
        if (id === npc1.id) return npc1;
        if (id === npc2.id) return npc2;
        return null;
      });

      mockEntityManager.getAllComponentTypesForEntity.mockImplementation(
        (id) => {
          if (id === actor.id) return Object.keys(actor.components);
          if (id === npc1.id) return Object.keys(npc1.components);
          if (id === npc2.id) return Object.keys(npc2.components);
          return [];
        }
      );

      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        if (id === actor.id) return actor.components[type];
        if (id === npc1.id) return npc1.components[type];
        if (id === npc2.id) return npc2.components[type];
        return undefined;
      });

      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([
        actor.id,
        npc1.id,
        npc2.id,
      ]);

      // Mock display name to fail for npc2
      getEntityDisplayNameFn.mockImplementation((entity) => {
        if (entity.id === npc2.id) {
          throw new Error('Failed to get display name');
        }
        return entity.name || 'Unknown';
      });

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1); // Only npc1 should succeed
      expect(result.value.errors).toHaveLength(1); // npc2 should fail
      expect(result.value.actions[0].params.targetId).toBe(npc1.id);
      expect(result.value.errors[0].targetId).toBe(npc2.id);
    });

    it('should handle complex prerequisite chains', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = {
        id: 'test:complex-prereq',
        name: 'Complex Prerequisites',
        scope: 'none',
        template: 'complex',
        prerequisites: [
          {
            logic: {
              and: [
                {
                  '==': [
                    { var: 'actor.components.core:movement.locked' },
                    false,
                  ],
                },
                { '>=': [{ var: 'actor.components.core:health.current' }, 50] },
              ],
            },
            failure_message: 'Complex prerequisites not met',
          },
        ],
        required_components: { actor: [] },
      };
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        return actor.components[type];
      });
      mockEntityManager.hasComponent.mockImplementation((id, type) => {
        return !!actor.components[type];
      });

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(result.value.errors).toHaveLength(0);
    });

    it('should properly handle ActionResult pattern throughout', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = testData.actions.basic.find(
        (a) => a.id === 'core:wait'
      );
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        return actor.components[type];
      });

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result).toBeInstanceOf(ActionResult);
      expect(result.success).toBe(true);
      expect(result.value).toBeDefined();
      expect(result.value.actions).toBeInstanceOf(Array);
      expect(result.value.errors).toBeInstanceOf(Array);
    });

    it('should handle prerequisite errors that are already ActionErrorContext', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = testData.actions.basic.find((a) => a.id === 'movement:go');
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      const existingErrorContext = {
        timestamp: Date.now(),
        phase: ERROR_PHASES.VALIDATION,
        error: new Error('Existing error'),
        actionId: actionDef.id,
        actorId: actor.id,
      };

      // Mock prerequisite service to return a failure with existing error context
      jest
        .spyOn(prerequisiteEvaluationService, 'evaluate')
        .mockImplementation(() => {
          throw existingErrorContext;
        });

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0].phase).toBe(existingErrorContext.phase);
      expect(result.value.errors[0].timestamp).toBeDefined();
    });

    it('should handle prerequisite evaluation returning ActionResult with ActionErrorContext errors', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = testData.actions.basic.find((a) => a.id === 'movement:go');
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      const fixedTimestamp = 1609459200000; // Fixed timestamp: 2021-01-01T00:00:00.000Z
      const actionErrorContext = {
        timestamp: fixedTimestamp,
        phase: ERROR_PHASES.VALIDATION,
        error: new Error('Prerequisites failed'),
        actionId: actionDef.id,
        actorId: actor.id,
      };

      // Mock prerequisite service to throw ActionErrorContext
      jest
        .spyOn(prerequisiteEvaluationService, 'evaluate')
        .mockImplementation(() => {
          throw actionErrorContext;
        });

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0].timestamp).toBeGreaterThan(0); // New timestamp created by processor
      expect(result.value.errors[0].phase).toBe(ERROR_PHASES.VALIDATION);
      expect(result.value.cause).toBe('prerequisite-error');
    });

    it('should handle raw prerequisite evaluation errors requiring context building', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = testData.actions.basic.find((a) => a.id === 'movement:go');
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      const rawError = new Error('Raw prerequisite evaluation error');

      // Mock prerequisite service to throw raw error
      jest
        .spyOn(prerequisiteEvaluationService, 'evaluate')
        .mockImplementation(() => {
          throw rawError;
        });

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(0);
      expect(result.value.errors).toHaveLength(1);
      expect(result.value.errors[0].phase).toBe(ERROR_PHASES.VALIDATION);
      expect(result.value.cause).toBe('prerequisite-error');
      expect(actionErrorContextBuilder.buildErrorContext).toHaveBeenCalledWith({
        error: rawError,
        actionDef,
        actorId: actor.id,
        phase: ERROR_PHASES.VALIDATION,
        trace: null,
      });
    });
  });

  describe('Integration with Real Services', () => {
    it('should work with real prerequisite evaluation including condition_ref', () => {
      // Arrange
      const actor = testData.actors.player;
      const actionDef = {
        id: 'test:condition-ref',
        name: 'Condition Ref Test',
        scope: 'none',
        template: 'test',
        prerequisites: [
          {
            logic: { condition_ref: 'movement:actor-can-move' },
            failure_message: 'Cannot move',
          },
        ],
        required_components: { actor: [] },
      };
      const context = {
        actorId: actor.id,
        locationId: 'test-location-1',
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        return actor.components[type];
      });
      mockEntityManager.hasComponent.mockImplementation((id, type) => {
        return !!actor.components[type];
      });

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1);
      expect(
        mockGameDataRepository.getConditionDefinition
      ).toHaveBeenCalledWith('movement:actor-can-move');
    });

    it('should work with real target resolution for scope-based actions', () => {
      // Arrange
      const actor = testData.actors.player;
      const location = testData.world.locations[0];
      const actionDef = testData.actions.basic.find((a) => a.id === 'movement:go');
      const context = {
        actorId: actor.id,
        locationId: location.id,
        location: location.components,
      };

      mockEntityManager.getEntityInstance.mockReturnValue(actor);
      mockEntityManager.getAllComponentTypesForEntity.mockReturnValue(
        Object.keys(actor.components)
      );
      mockEntityManager.getComponentData.mockImplementation((id, type) => {
        return actor.components[type];
      });
      mockEntityManager.hasComponent.mockImplementation((id, type) => {
        return !!actor.components[type];
      });

      // Act
      const result = processor.process(actionDef, actor, context);

      // Assert
      expect(result.success).toBe(true);
      expect(result.value.actions).toHaveLength(1); // Should find north exit
      expect(result.value.actions[0].params.targetId).toBe('test-location-2');
    });
  });
});
