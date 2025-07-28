/**
 * @file ActionFailureRecovery.e2e.test.js
 * @description Comprehensive testing of action system failure scenarios and recovery
 * mechanisms to ensure game state consistency and graceful degradation under failure conditions
 *
 * This test suite addresses critical gaps in failure recovery testing identified in the
 * Action Pipeline E2E Test Coverage Gap Analysis.
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';
import {
  createFailureInjector,
  ErrorScenarios,
} from './helpers/failureInjectionHelper.js';
import {
  captureGameState,
  compareStates,
  validateStateRestoration,
  createStatePerformanceMonitor,
} from './helpers/stateSnapshotHelper.js';
import {
  ACTION_EXECUTION_FAILED,
  ACTION_VALIDATION_FAILED,
  SYSTEM_ERROR_OCCURRED,
  TURN_PROCESSING_STARTED,
  TURN_PROCESSING_ENDED,
} from '../../../src/constants/eventIds.js';

describe('Action Failure Recovery E2E', () => {
  let facades;
  let actionService;
  let entityService;
  let turnExecutionFacade;
  let failureInjector;
  let performanceMonitor;
  let testEnvironment;

  beforeEach(async () => {
    // Create facades with mocking support
    facades = createMockFacades({}, jest.fn);
    actionService = facades.actionService;
    entityService = facades.entityService;
    turnExecutionFacade = facades.turnExecutionFacade;

    // Create failure injector and performance monitor
    failureInjector = createFailureInjector(facades, jest.fn);
    performanceMonitor = createStatePerformanceMonitor();

    // Initialize test environment
    testEnvironment = await turnExecutionFacade.initializeTestEnvironment({
      llmStrategy: 'tool-calling',
      worldConfig: {
        name: 'Test World',
        createConnections: true,
      },
      actorConfig: {
        name: 'Test Player',
        additionalActors: [
          { id: 'test-npc', name: 'Test NPC' },
          { id: 'test-enemy', name: 'Test Enemy' },
        ],
      },
    });
  });

  afterEach(async () => {
    // Use timeout to prevent hanging in cleanup
    const cleanupTimeout = setTimeout(() => {
      console.warn('AfterEach cleanup timed out, forcing cleanup');
    }, 5000);

    try {
      // Clear error events and reset performance monitor
      if (failureInjector) {
        failureInjector.clearErrorEvents();
        try {
          await failureInjector.cleanupAllResources();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
      
      if (performanceMonitor) {
        performanceMonitor.reset();
        performanceMonitor.destroy();
      }

      // Simplified facade cleanup
      if (turnExecutionFacade) {
        try {
          await turnExecutionFacade.clearTestData();
          await turnExecutionFacade.dispose();
        } catch (error) {
          // Ignore errors during cleanup
        }
      }

      // Clean up mock facades
      if (facades && facades.cleanupAll) {
        facades.cleanupAll();
      }

      if (entityService && entityService.cleanup) {
        entityService.cleanup();
      }
      
      // Clear any remaining timers
      jest.clearAllTimers();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    } finally {
      clearTimeout(cleanupTimeout);
      // Reset variables to prevent memory leaks
      facades = null;
      actionService = null;
      entityService = null;
      turnExecutionFacade = null;
      failureInjector = null;
      performanceMonitor = null;
      testEnvironment = null;
    }
  });

  describe('State Rollback Capability', () => {
    test('should rollback state when action execution fails mid-pipeline', async () => {
      // Arrange - Capture initial state
      performanceMonitor.startOperation('stateCapture');
      const initialState = captureGameState({
        entityService,
        turnExecutionFacade,
        actionService,
      });
      performanceMonitor.endOperation('stateCapture');

      // Setup action that will fail during execution
      const mockValidation = {
        success: true,
        validatedAction: {
          actionId: 'core:attack',
          actorId: testEnvironment.actors.playerActorId,
          targets: { target: 'test-enemy' },
        },
      };

      turnExecutionFacade.setupMocks({
        validationResults: {
          [`${testEnvironment.actors.playerActorId}:core:attack`]:
            mockValidation,
        },
      });

      // Inject failure during entity update
      failureInjector.injectEntityManagerFailure(
        'updateComponent',
        ErrorScenarios.INVALID_STATE
      );

      // Act - Attempt to execute action
      performanceMonitor.startOperation('failedExecution');
      let executionError = null;
      try {
        await turnExecutionFacade.executePlayerTurn(
          testEnvironment.actors.playerActorId,
          'attack test-enemy'
        );
      } catch (error) {
        executionError = error;
      }
      performanceMonitor.endOperation('failedExecution');

      // Capture state after failure
      performanceMonitor.startOperation('postFailureCapture');
      const postFailureState = captureGameState({
        entityService,
        turnExecutionFacade,
        actionService,
      });
      performanceMonitor.endOperation('postFailureCapture');

      // Assert - State should be rolled back
      expect(executionError).toBeTruthy();
      expect(executionError.message).toContain('Invalid game state');

      // Validate state restoration
      const validation = validateStateRestoration(
        initialState,
        postFailureState
      );
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Check error events were dispatched
      const errorEvents = failureInjector.getErrorEvents();
      expect(errorEvents).toContainEqual(
        expect.objectContaining({
          type: ACTION_EXECUTION_FAILED,
          payload: expect.objectContaining({
            error: expect.stringContaining('Invalid game state'),
          }),
        })
      );

      // Assert performance requirements
      performanceMonitor.assertPerformance('failedExecution', 500);
      performanceMonitor.assertPerformance('postFailureCapture', 100);
    });

    test('should preserve pre-action state integrity on failure', async () => {
      // Arrange - Create complex state with multiple entities
      const player = entityService.getEntity(
        testEnvironment.actors.playerActorId
      );
      const enemy = entityService.getEntity('test-enemy');

      // Add inventory items to player
      entityService.updateComponent(player.id, 'core:inventory', {
        items: ['weapon-1', 'potion-1', 'potion-2'],
      });

      // Set enemy health
      entityService.updateComponent(enemy.id, 'core:stats', {
        health: 100,
        maxHealth: 100,
      });

      const initialState = captureGameState({
        entityService,
        turnExecutionFacade,
        actionService,
      });

      // Inject failure after partial state changes
      let updateCount = 0;
      const originalUpdate = entityService.updateComponent;
      entityService.updateComponent = jest
        .fn()
        .mockImplementation(async (...args) => {
          updateCount++;
          if (updateCount === 2) {
            throw ErrorScenarios.CONCURRENT_MODIFICATION;
          }
          return originalUpdate.call(entityService, ...args);
        });

      // Act - Execute complex action
      try {
        await actionService.executeAction({
          actionId: 'core:complex_attack',
          actorId: player.id,
          targets: { enemy: enemy.id },
          parameters: { useItem: 'potion-1' },
        });
      } catch (error) {
        // Expected to fail
      }

      // Assert - All state should be preserved
      const currentState = captureGameState({
        entityService,
        turnExecutionFacade,
        actionService,
      });
      const comparison = compareStates(initialState, currentState);

      expect(comparison.summary.hasChanges).toBe(false);
      expect(comparison.summary.componentChanges).toBe(0);

      // Verify specific components unchanged
      const currentPlayer = entityService.getEntity(player.id);
      expect(currentPlayer.getComponent('core:inventory').items).toEqual([
        'weapon-1',
        'potion-1',
        'potion-2',
      ]);

      const currentEnemy = entityService.getEntity(enemy.id);
      expect(currentEnemy.getComponent('core:stats').health).toBe(100);
    });
  });

  describe('Pipeline Stage Failure Handling', () => {
    test('should recover gracefully from prerequisite evaluation failures', async () => {
      // Arrange
      const initialState = captureGameState({
        entityService,
        turnExecutionFacade,
        actionService,
      });

      // Create action with failing prerequisite
      actionService.registerAction({
        id: 'test:conditional_action',
        prerequisites: [
          {
            type: 'hasResource',
            resource: 'mana',
            amount: 50,
          },
        ],
        operation: 'test_operation',
      });

      // Player has insufficient mana
      const player = entityService.getEntity(
        testEnvironment.actors.playerActorId
      );
      entityService.updateComponent(player.id, 'core:resources', {
        mana: 10,
        maxMana: 100,
      });

      // Act
      const result = await actionService.validateAction({
        actionId: 'test:conditional_action',
        actorId: player.id,
        targets: {},
      });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('prerequisite');

      // No state changes should occur
      const currentState = captureGameState({
        entityService,
        turnExecutionFacade,
        actionService,
      });
      const validation = validateStateRestoration(initialState, currentState);
      expect(validation.isValid).toBe(true);

      // Action should remain available for retry
      const availableActions = actionService.getAvailableActions(player.id);
      expect(availableActions).toContainEqual(
        expect.objectContaining({
          id: 'test:conditional_action',
        })
      );
    });

    test('should handle failures at each pipeline stage correctly', async () => {
      const pipelineStages = [
        'ComponentFilteringStage',
        'PrerequisiteEvaluationStage',
        'TargetResolutionStage',
        'ActionFormattingStage',
      ];

      for (const stage of pipelineStages) {
        // Reset environment for each test
        const initialState = captureGameState({
          entityService,
          turnExecutionFacade,
          actionService,
        });

        // Inject stage-specific failure
        failureInjector.injectPipelineStageFailure(
          stage,
          ErrorScenarios.createContextualError(`${stage} failure`, { stage })
        );

        // Attempt action execution
        let stageError = null;
        try {
          await actionService.executeAction({
            actionId: 'core:move',
            actorId: testEnvironment.actors.playerActorId,
            targets: { location: 'test-location' },
          });
        } catch (error) {
          stageError = error;
        }

        // Verify error handling
        expect(stageError).toBeTruthy();
        expect(stageError.message).toContain(`${stage} failure`);

        // Verify state unchanged
        const currentState = captureGameState({
          entityService,
          turnExecutionFacade,
          actionService,
        });
        const validation = validateStateRestoration(initialState, currentState);
        expect(validation.isValid).toBe(true);

        // Verify error event dispatched
        const errorEvents = failureInjector.getErrorEvents();
        const stageErrorEvent = errorEvents.find(
          (e) =>
            e.type === ACTION_EXECUTION_FAILED &&
            e.payload.error.includes(stage)
        );
        expect(stageErrorEvent).toBeTruthy();

        // Clear for next iteration
        failureInjector.clearErrorEvents();
      }
    });
  });

  describe('Service Unavailability Handling', () => {
    test('should handle entity manager failures during action execution', async () => {
      // Arrange
      performanceMonitor.startOperation('recovery');
      const initialState = captureGameState({
        entityService,
        turnExecutionFacade,
        actionService,
      });

      // Mock entity manager to fail during update
      const restoreEntityManager = failureInjector.injectServiceFailure(
        'entityService',
        'updateComponent',
        ErrorScenarios.SERVICE_UNAVAILABLE
      );

      // Act
      let serviceError = null;
      try {
        await actionService.executeAction({
          actionId: 'core:heal',
          actorId: testEnvironment.actors.playerActorId,
          targets: { self: true },
        });
      } catch (error) {
        serviceError = error;
      }
      performanceMonitor.endOperation('recovery');

      // Assert
      expect(serviceError).toBeTruthy();
      expect(serviceError.message).toContain('Service temporarily unavailable');

      // Transaction rollback should occur
      const currentState = captureGameState({
        entityService,
        turnExecutionFacade,
        actionService,
      });
      const validation = validateStateRestoration(initialState, currentState);
      expect(validation.isValid).toBe(true);

      // System should remain operational
      restoreEntityManager();
      const testAction = await actionService.validateAction({
        actionId: 'core:wait',
        actorId: testEnvironment.actors.playerActorId,
        targets: {},
      });
      expect(testAction.success).toBe(true);

      // Assert recovery performance
      performanceMonitor.assertPerformance('recovery', 500);
    });

    test('should handle event bus failures without crashing', async () => {
      // Arrange
      const initialState = captureGameState({
        entityService,
        turnExecutionFacade,
        actionService,
      });

      // Inject event bus failure
      const restoreEventBus = failureInjector.injectEventBusFailure(
        ErrorScenarios.NETWORK_TIMEOUT
      );

      // Act - Should handle gracefully
      let eventBusError = null;
      try {
        await entityService.dispatchEvent({
          type: 'TEST_EVENT',
          payload: { data: 'test' },
        });
      } catch (error) {
        eventBusError = error;
      }

      // Assert
      expect(eventBusError).toBeTruthy();
      expect(eventBusError.message).toContain('Network timeout');

      // System should continue functioning
      restoreEventBus();
      const actions = actionService.getAvailableActions(
        testEnvironment.actors.playerActorId
      );
      expect(actions.length).toBeGreaterThan(0);

      // State should remain consistent
      const currentState = captureGameState({
        entityService,
        turnExecutionFacade,
        actionService,
      });
      const validation = validateStateRestoration(initialState, currentState);
      expect(validation.isValid).toBe(true);
    });

    test('should provide fallback behavior for missing services', async () => {
      // Arrange - Temporarily disable a service
      const originalGetEntity = entityService.getEntity;
      entityService.getEntity = jest.fn().mockImplementation((id) => {
        if (id === 'service-test-entity') {
          return null; // Simulate missing entity
        }
        return originalGetEntity.call(entityService, id);
      });

      // Act - Try to execute action on missing entity
      const result = await actionService.validateAction({
        actionId: 'core:interact',
        actorId: testEnvironment.actors.playerActorId,
        targets: { entity: 'service-test-entity' },
      });

      // Assert - Should fail gracefully
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Restore service
      entityService.getEntity = originalGetEntity;
    });
  });

  describe('Turn Consistency During Failures', () => {
    test('should maintain turn consistency when actions fail', async () => {
      // Arrange - Start a turn
      await turnExecutionFacade.startTurn();
      const initialTurnState = turnExecutionFacade.getCurrentTurnState();

      // Setup multiple actors
      const actors = [
        testEnvironment.actors.playerActorId,
        'test-npc',
        'test-enemy',
      ];

      // First actor succeeds
      await turnExecutionFacade.executePlayerTurn(actors[0], 'wait');

      // Second actor fails
      failureInjector.injectServiceFailure(
        'actionService',
        'executeAction',
        ErrorScenarios.INVALID_STATE
      );

      let secondActorError = null;
      try {
        await turnExecutionFacade.executePlayerTurn(actors[1], 'move north');
      } catch (error) {
        secondActorError = error;
      }

      // Assert - Turn state remains consistent
      expect(secondActorError).toBeTruthy();
      const currentTurnState = turnExecutionFacade.getCurrentTurnState();
      expect(currentTurnState.turnNumber).toBe(initialTurnState.turnNumber);
      expect(currentTurnState.phase).toBeDefined();

      // Other actors can still act
      const thirdActorResult = await turnExecutionFacade.executePlayerTurn(
        actors[2],
        'wait'
      );
      expect(thirdActorResult.success).toBe(true);

      // Failed actor can retry or skip
      const retryResult = await actionService.validateAction({
        actionId: 'core:skip',
        actorId: actors[1],
        targets: {},
      });
      expect(retryResult.success).toBe(true);
    });
  });

  describe('Cascading Failure Prevention', () => {
    test('should prevent cascading failures from corrupting game state', async () => {
      // Arrange - Create action that triggers multiple side effects
      const initialState = captureGameState({
        entityService,
        turnExecutionFacade,
        actionService,
      });

      // Setup cascading failure sequence
      const cascadeRestore = await failureInjector.injectCascadingFailures([
        {
          service: 'entityService',
          method: 'updateComponent',
          error: ErrorScenarios.DATA_CORRUPTION,
          delay: 10,
        },
        {
          service: 'entityService',
          method: 'dispatchEvent',
          error: ErrorScenarios.NETWORK_TIMEOUT,
          delay: 20,
        },
        {
          service: 'turnExecutionFacade',
          method: 'recordAction',
          error: ErrorScenarios.RESOURCE_EXHAUSTED,
          delay: 30,
        },
      ]);

      // Act - Execute action that would trigger cascade
      performanceMonitor.startOperation('cascadeRecovery');
      let cascadeError = null;
      try {
        await actionService.executeAction({
          actionId: 'core:area_effect',
          actorId: testEnvironment.actors.playerActorId,
          targets: {
            area: 'all_enemies',
            secondary: 'allies_buff',
          },
        });
      } catch (error) {
        cascadeError = error;
      }
      performanceMonitor.endOperation('cascadeRecovery');

      // Assert - All effects should be rolled back
      expect(cascadeError).toBeTruthy();

      const currentState = captureGameState({
        entityService,
        turnExecutionFacade,
        actionService,
      });
      const comparison = compareStates(initialState, currentState);

      expect(comparison.summary.hasChanges).toBe(false);
      expect(comparison.entities.modified).toEqual({});

      // No orphaned state changes
      const allEntities = entityService.getAllEntityIds();
      for (const entityId of allEntities) {
        const entity = entityService.getEntity(entityId);
        expect(entity).toBeDefined();
        expect(entity.getAllComponents()).toBeDefined();
      }

      // Event cascade properly terminated
      const errorEvents = failureInjector.getErrorEvents();
      expect(errorEvents.length).toBeGreaterThan(0);
      expect(errorEvents[errorEvents.length - 1].type).toBe(
        ACTION_EXECUTION_FAILED
      );

      // Performance requirement
      performanceMonitor.assertPerformance('cascadeRecovery', 500);

      // Cleanup - ensure all cascade operations complete
      if (cascadeRestore) {
        await cascadeRestore();
      }
      
      // Wait for any remaining async operations to complete
      await new Promise(resolve => setTimeout(resolve, 50));
    });
  });

  describe('Error Communication', () => {
    test('should provide clear, actionable error messages', async () => {
      // Test various error scenarios
      const errorScenarios = [
        {
          injection: () =>
            failureInjector.injectActionValidationFailure(
              'core:invalid_action',
              'This action requires a valid target'
            ),
          expectedMessage: 'valid target',
        },
        {
          injection: () =>
            failureInjector.injectEntityManagerFailure(
              'update',
              new Error('Entity is locked by another process')
            ),
          expectedMessage: 'locked',
        },
        {
          injection: () =>
            failureInjector.injectServiceFailure(
              'actionService',
              'discoverActions',
              new Error('Action discovery timeout')
            ),
          expectedMessage: 'timeout',
        },
      ];

      for (const scenario of errorScenarios) {
        const restore = scenario.injection();

        let caughtError = null;
        try {
          await actionService.executeAction({
            actionId: 'core:test_action',
            actorId: testEnvironment.actors.playerActorId,
            targets: {},
          });
        } catch (error) {
          caughtError = error;
        }

        expect(caughtError).toBeTruthy();
        expect(caughtError.message.toLowerCase()).toContain(
          scenario.expectedMessage
        );

        if (restore) restore();
        failureInjector.clearErrorEvents();
      }
    });

    test('should maintain error context through recovery process', async () => {
      // Arrange
      const contextualError = ErrorScenarios.createContextualError(
        'Action failed due to invalid state',
        {
          actionId: 'core:complex_action',
          actorId: testEnvironment.actors.playerActorId,
          stage: 'execution',
          timestamp: Date.now(),
        }
      );

      failureInjector.injectServiceFailure(
        'actionService',
        'executeAction',
        contextualError
      );

      // Act
      let errorWithContext = null;
      try {
        await actionService.executeAction({
          actionId: 'core:complex_action',
          actorId: testEnvironment.actors.playerActorId,
          targets: {},
        });
      } catch (error) {
        errorWithContext = error;
      }

      // Assert - Context should be preserved
      expect(errorWithContext).toBeTruthy();
      expect(errorWithContext.context).toBeDefined();
      expect(errorWithContext.context.actionId).toBe('core:complex_action');
      expect(errorWithContext.context.stage).toBe('execution');

      // Error events should include context
      const errorEvents = failureInjector.getErrorEvents();
      const contextEvent = errorEvents.find(
        (e) => e.type === ACTION_EXECUTION_FAILED
      );
      expect(contextEvent).toBeTruthy();
      expect(contextEvent.payload).toMatchObject({
        error: expect.stringContaining('invalid state'),
        context: expect.objectContaining({
          actionId: 'core:complex_action',
        }),
      });
    });
  });

  describe('Performance Under Failure', () => {
    test('should complete recovery within 500ms', async () => {
      // Run multiple recovery scenarios and measure performance
      const scenarios = [
        'entity_update_failure',
        'event_dispatch_failure',
        'validation_failure',
        'pipeline_stage_failure',
      ];

      for (const scenario of scenarios) {
        performanceMonitor.startOperation(scenario);

        // Inject appropriate failure
        switch (scenario) {
          case 'entity_update_failure':
            failureInjector.injectEntityManagerFailure('updateComponent');
            break;
          case 'event_dispatch_failure':
            failureInjector.injectEventBusFailure();
            break;
          case 'validation_failure':
            failureInjector.injectActionValidationFailure(
              'core:test',
              'Invalid'
            );
            break;
          case 'pipeline_stage_failure':
            failureInjector.injectPipelineStageFailure('TargetResolutionStage');
            break;
        }

        // Execute and recover
        try {
          await actionService.executeAction({
            actionId: 'core:test',
            actorId: testEnvironment.actors.playerActorId,
            targets: {},
          });
        } catch (error) {
          // Expected failure
        }

        performanceMonitor.endOperation(scenario);

        // Assert performance
        performanceMonitor.assertPerformance(scenario, 500);
      }

      // Generate performance report
      const report = performanceMonitor.getReport();
      console.log('Recovery Performance Report:', report);

      // All scenarios should complete within limits
      for (const scenario of scenarios) {
        expect(report[scenario].duration).toBeLessThan(500);
      }
    });

    test('should not leak memory during failure scenarios', async () => {
      // Track initial memory (if available in test environment)
      const initialMemory = process.memoryUsage();

      // Run many failure/recovery cycles
      for (let i = 0; i < 100; i++) {
        const randomFailure = Math.random();

        if (randomFailure < 0.33) {
          failureInjector.injectEntityManagerFailure('updateComponent');
        } else if (randomFailure < 0.66) {
          failureInjector.injectEventBusFailure();
        } else {
          failureInjector.injectServiceFailure(
            'actionService',
            'validateAction'
          );
        }

        try {
          await actionService.executeAction({
            actionId: 'core:test',
            actorId: testEnvironment.actors.playerActorId,
            targets: {},
          });
        } catch (error) {
          // Expected failures
        }

        // Clear events to prevent accumulation
        if (i % 10 === 0) {
          failureInjector.clearErrorEvents();
        }
      }

      // Check memory hasn't grown excessively
      const finalMemory = process.memoryUsage();
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      // Allow some growth but not excessive (e.g., < 50MB)
      expect(heapGrowth).toBeLessThan(50 * 1024 * 1024);
    });
  });
});
