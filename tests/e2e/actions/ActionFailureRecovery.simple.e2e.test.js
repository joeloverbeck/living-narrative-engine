/**
 * @file ActionFailureRecovery.simple.e2e.test.js
 * @description Simplified version of failure recovery tests that work with mock facades
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

describe('Action Failure Recovery E2E - Simplified', () => {
  let facades;
  let turnExecutionFacade;
  let testEnvironment;

  beforeEach(async () => {
    // Create facades with mocking support
    facades = createMockFacades({}, jest.fn);
    turnExecutionFacade = facades.turnExecutionFacade;

    // Initialize test environment
    testEnvironment = await turnExecutionFacade.initializeTestEnvironment({
      llmStrategy: 'tool-calling',
      worldConfig: {
        name: 'Test World',
        createConnections: true,
      },
      actorConfig: {
        name: 'Test Player',
        additionalActors: [{ id: 'test-npc', name: 'Test NPC' }],
      },
    });
  });

  afterEach(async () => {
    // Clean up test environment
    await turnExecutionFacade.clearTestData();
    await turnExecutionFacade.dispose();
  });

  test('should handle action execution failures gracefully', async () => {
    // Arrange - Setup failing action
    const mockValidation = {
      success: false,
      error: 'Action execution failed',
      validatedAction: {
        actionId: 'core:attack',
        actorId: testEnvironment.actors.playerActorId,
        targets: { target: 'test-npc' },
      },
    };

    turnExecutionFacade.setupMocks({
      validationResults: {
        [`${testEnvironment.actors.playerActorId}:core:attack`]: mockValidation,
      },
    });

    // Act - Attempt to execute action
    const result = await turnExecutionFacade.executePlayerTurn(
      testEnvironment.actors.playerActorId,
      'attack test-npc'
    );

    // Assert - Should handle failure gracefully
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.validation.error).toContain('failed');
  });

  test('should recover from service unavailability', async () => {
    // Arrange - Mock service failure
    const originalExecute = turnExecutionFacade.executePlayerTurn;
    let callCount = 0;

    turnExecutionFacade.executePlayerTurn = jest
      .fn()
      .mockImplementation(async (...args) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Service temporarily unavailable');
        }
        return originalExecute.call(turnExecutionFacade, ...args);
      });

    // Act - First call should fail
    let firstError = null;
    try {
      await turnExecutionFacade.executePlayerTurn(
        testEnvironment.actors.playerActorId,
        'wait'
      );
    } catch (error) {
      firstError = error;
    }

    // Second call should succeed (recovery)
    const mockValidation = {
      success: true,
      validatedAction: {
        actionId: 'core:wait',
        actorId: testEnvironment.actors.playerActorId,
        targets: {},
      },
    };

    turnExecutionFacade.setupMocks({
      validationResults: {
        [`${testEnvironment.actors.playerActorId}:core:wait`]: mockValidation,
      },
    });

    const recoveryResult = await turnExecutionFacade.executePlayerTurn(
      testEnvironment.actors.playerActorId,
      'wait'
    );

    // Assert
    expect(firstError).toBeTruthy();
    expect(firstError.message).toContain('unavailable');
    expect(recoveryResult.success).toBe(true);

    // Restore original method
    turnExecutionFacade.executePlayerTurn = originalExecute;
  });

  test('should maintain turn consistency when actions fail', async () => {
    // Arrange - Multiple actors with one failing
    const actors = [testEnvironment.actors.playerActorId, 'test-npc'];

    // First actor succeeds
    turnExecutionFacade.setupMocks({
      validationResults: {
        [`${actors[0]}:core:wait`]: {
          success: true,
          validatedAction: {
            actionId: 'core:wait',
            actorId: actors[0],
            targets: {},
          },
        },
      },
    });

    const firstResult = await turnExecutionFacade.executePlayerTurn(
      actors[0],
      'wait'
    );

    // Second actor fails
    turnExecutionFacade.setupMocks({
      validationResults: {
        [`${actors[1]}:core:move`]: {
          success: false,
          error: 'Invalid move',
          validatedAction: {
            actionId: 'core:move',
            actorId: actors[1],
            targets: { direction: 'invalid' },
          },
        },
      },
    });

    const secondResult = await turnExecutionFacade.executePlayerTurn(
      actors[1],
      'move invalid'
    );

    // Assert - First succeeded, second failed
    expect(firstResult.success).toBe(true);
    expect(secondResult.success).toBe(false);

    // Both actors were able to take their turns
    expect(firstResult.command).toBe('wait');
    expect(secondResult.command).toBe('move invalid');
  });

  test('should provide clear error messages on failure', async () => {
    // Test various error scenarios
    const errorScenarios = [
      {
        actionId: 'core:invalid_action',
        error: 'This action requires a valid target',
        expectedMessage: 'valid target',
      },
      {
        actionId: 'core:locked_action',
        error: 'Entity is locked by another process',
        expectedMessage: 'locked',
      },
      {
        actionId: 'core:timeout_action',
        error: 'Action discovery timeout',
        expectedMessage: 'timeout',
      },
    ];

    for (const scenario of errorScenarios) {
      turnExecutionFacade.setupMocks({
        validationResults: {
          [`${testEnvironment.actors.playerActorId}:${scenario.actionId}`]: {
            success: false,
            error: scenario.error,
            validatedAction: {
              actionId: scenario.actionId,
              actorId: testEnvironment.actors.playerActorId,
              targets: {},
            },
          },
        },
      });

      const result = await turnExecutionFacade.executePlayerTurn(
        testEnvironment.actors.playerActorId,
        scenario.actionId.replace('core:', '')
      );

      expect(result.success).toBe(false);
      expect(result.validation.error.toLowerCase()).toContain(
        scenario.expectedMessage
      );
    }
  });

  test('should handle cascading failures properly', async () => {
    // Arrange - Setup cascading failure scenario
    turnExecutionFacade.setupMocks({
      validationResults: {
        [`${testEnvironment.actors.playerActorId}:core:area_effect`]: {
          success: false,
          error: 'Cascading failure - multiple effects failed',
          validatedAction: {
            actionId: 'core:area_effect',
            actorId: testEnvironment.actors.playerActorId,
            targets: { area: 'all' },
          },
        },
      },
    });

    // Act - Execute action that fails
    const result = await turnExecutionFacade.executePlayerTurn(
      testEnvironment.actors.playerActorId,
      'area_effect all'
    );

    // Assert - Failure was contained
    expect(result.success).toBe(false);
    expect(result.validation.error).toContain('Cascading failure');

    // System should still be operational

    turnExecutionFacade.setupMocks({
      validationResults: {
        [`${testEnvironment.actors.playerActorId}:core:wait`]: {
          success: true,
          validatedAction: {
            actionId: 'core:wait',
            actorId: testEnvironment.actors.playerActorId,
            targets: {},
          },
        },
      },
    });

    const recoveryTest = await turnExecutionFacade.executePlayerTurn(
      testEnvironment.actors.playerActorId,
      'wait'
    );

    expect(recoveryTest.success).toBe(true);
  });
});
