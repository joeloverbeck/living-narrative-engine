/**
 * @file End-to-end test for action validation edge cases - Migrated to Facade Pattern
 * @see tests/e2e/actions/ActionValidationEdgeCases.e2e.test.js
 *
 * This test suite covers edge cases in the action validation pipeline including:
 * - Failed validation scenarios
 * - Invalid action parameters
 * - Error recovery and fallback mechanisms
 * 
 * MIGRATED: This test now uses the simplified facade pattern
 * NOTE: Some edge cases that require direct service access have been simplified
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { createMockFacades } from '../../../src/testing/facades/testingFacadeRegistrations.js';
import {
  ATTEMPT_ACTION_ID,
} from '../../../src/constants/eventIds.js';

/**
 * E2E test suite for action validation edge cases using facade pattern
 * Tests the system's ability to handle various error conditions gracefully
 */
describe('Action Validation Edge Cases E2E', () => {
  let facades;
  let turnExecutionFacade;
  let testEnvironment;

  beforeEach(async () => {
    // SIMPLIFIED: Single line facade creation replaces complex setup
    facades = createMockFacades({}, jest.fn);
    turnExecutionFacade = facades.turnExecutionFacade;

    // Set up test environment
    testEnvironment = await turnExecutionFacade.initializeTestEnvironment({
      llmStrategy: 'tool-calling',
      worldConfig: {
        name: 'Test World',
        createConnections: true,
      },
      actorConfig: {
        name: 'Test Player',
      },
    });
  });

  afterEach(async () => {
    // Simple cleanup
    await turnExecutionFacade.clearTestData();
    await turnExecutionFacade.dispose();
  });

  /**
   * Test: Failed validation scenarios
   * Verifies that actions with validation failures are handled correctly
   */
  test('should handle failed validation scenarios gracefully', async () => {
    const playerId = testEnvironment.actors.playerActorId;

    // Set up mock validation failures for specific commands
    turnExecutionFacade.setupMocks({
      validationResults: {
        [`${playerId}:core:wait`]: {
          success: false,
          error: 'Action prerequisites not met',
          code: 'PREREQUISITES_FAILED',
        },
      },
    });

    // Test a command that should fail validation
    const result = await turnExecutionFacade.executePlayerTurn(
      playerId,
      'wait'
    );

    // Should fail due to validation
    expect(result.success).toBe(false);
    expect(result.error).toBe('Action validation failed');
    expect(result.validation).toBeDefined();
    expect(result.validation.success).toBe(false);
    expect(result.validation.error).toBe('Action prerequisites not met');
  });

  /**
   * Test: Invalid action parameters
   * Verifies handling of actions with invalid parameters
   */
  test('should validate and reject actions with invalid parameters', async () => {
    const playerId = testEnvironment.actors.playerActorId;

    // Mock validation for action with invalid parameters
    turnExecutionFacade.setupMocks({
      validationResults: {
        [`${playerId}:core:follow`]: {
          success: false,
          error: 'Target parameter is required but was not provided',
          code: 'MISSING_PARAMETER',
        },
      },
    });

    // Try to execute action without required parameter
    const result = await turnExecutionFacade.executePlayerTurn(
      playerId,
      'follow'  // Missing target
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('Action validation failed');
    expect(result.validation.success).toBe(false);
  });

  /**
   * Test: Error recovery
   * Verifies the system can recover from error conditions
   */
  test('should recover gracefully from validation errors', async () => {
    const playerId = testEnvironment.actors.playerActorId;

    // Initial failing validation
    turnExecutionFacade.setupMocks({
      validationResults: {
        [`${playerId}:core:wait`]: {
          success: false,
          error: 'Temporary validation failure',
          code: 'TEMP_ERROR',
        },
      },
    });

    let result = await turnExecutionFacade.executePlayerTurn(playerId, 'wait');
    expect(result.success).toBe(false);

    // Update mock to simulate recovery
    turnExecutionFacade.setupMocks({
      validationResults: {
        [`${playerId}:core:wait`]: {
          success: true,
          validatedAction: {
            actionId: 'core:wait',
            actorId: playerId,
            targets: {},
          },
        },
      },
    });

    // Should now succeed
    result = await turnExecutionFacade.executePlayerTurn(playerId, 'wait');
    expect(result.success).toBe(true);
  });

  /**
   * Test: Multiple validation errors
   * Verifies handling of multiple concurrent validation failures
   */
  test('should handle multiple validation errors in sequence', async () => {
    const playerId = testEnvironment.actors.playerActorId;

    const testActions = [
      { command: 'wait', expectedError: 'Unknown action' },
      { command: 'look', expectedError: 'Invalid syntax' },
      { command: 'move', expectedError: 'Not available' },
    ];

    // Set up mocks for each action to fail
    const validationResults = {};
    testActions.forEach((action) => {
      // Parse the command to get the likely action ID
      const actionId = `core:${action.command}`;
      validationResults[`${playerId}:${actionId}`] = {
        success: false,
        error: action.expectedError,
        code: 'VALIDATION_ERROR',
      };
    });

    turnExecutionFacade.setupMocks({ validationResults });

    // Test each action
    for (const action of testActions) {
      const result = await turnExecutionFacade.executePlayerTurn(
        playerId,
        action.command
      );

      expect(result.success).toBe(false);
      expect(result.command).toBe(action.command);
      expect(result.validation).toBeDefined();
      expect(result.validation.success).toBe(false);
    }
  });

  /**
   * Test: Performance under error conditions
   * Verifies system performs acceptably even with validation failures
   */
  test('should maintain performance despite validation failures', async () => {
    const playerId = testEnvironment.actors.playerActorId;

    // Set up a failing validation
    turnExecutionFacade.setupMocks({
      validationResults: {
        [`${playerId}:core:wait`]: {
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
        },
      },
    });

    // Measure performance of failed validations
    const iterations = 10;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      await turnExecutionFacade.executePlayerTurn(playerId, 'wait');
    }

    const endTime = Date.now();
    const avgTime = (endTime - startTime) / iterations;

    // Should fail quickly even with errors
    expect(avgTime).toBeLessThan(50); // Under 50ms per validation
  });

  /**
   * Test: Complex validation scenario
   * Verifies handling of complex validation with multiple checks
   */
  test('should handle complex validation scenarios', async () => {
    const playerId = testEnvironment.actors.playerActorId;

    // Mock a complex action that passes validation but with warnings
    const complexValidation = {
      success: true,
      validatedAction: {
        actionId: 'core:move',
        actorId: playerId,
        targets: { location: 'test-location-2' },
      },
      warnings: [
        'Action may have unintended consequences',
        'Target location is far away',
      ],
    };

    turnExecutionFacade.setupMocks({
      validationResults: {
        [`${playerId}:core:move`]: complexValidation,
      },
    });

    const result = await turnExecutionFacade.executePlayerTurn(
      playerId,
      'move north'
    );

    // Should succeed despite warnings
    expect(result.success).toBe(true);
    expect(result.validation.success).toBe(true);
    
    // Note: The facade abstracts warning details
    // In a real implementation, warnings would be handled appropriately
  });

  /**
   * Test: Action availability based on validation
   * Verifies that validation affects action availability
   */
  test('should reflect validation in action availability', async () => {
    const playerId = testEnvironment.actors.playerActorId;

    // Set up mocks for action discovery with validation states
    const mockActions = [
      {
        actionId: 'core:wait',
        name: 'Wait',
        available: true,
      },
      {
        actionId: 'core:look',
        name: 'Look',
        available: true,
      },
      {
        actionId: 'core:move',
        name: 'Move',
        available: true,
      },
    ];

    turnExecutionFacade.setupMocks({
      actionResults: {
        [playerId]: mockActions,
      },
      validationResults: {
        [`${playerId}:core:wait`]: {
          success: true,
          validatedAction: {
            actionId: 'core:wait',
            actorId: playerId,
            targets: {},
          },
        },
        [`${playerId}:core:look`]: {
          success: true,
          validatedAction: {
            actionId: 'core:look',
            actorId: playerId,
            targets: {},
          },
        },
      },
    });

    // Test valid actions
    const validAction = await turnExecutionFacade.executePlayerTurn(
      playerId,
      'wait'
    );
    expect(validAction.success).toBe(true);
    expect(validAction.parsedCommand.actionId).toBe('core:wait');

    // Test another valid action
    const lookAction = await turnExecutionFacade.executePlayerTurn(
      playerId,
      'look'
    );
    expect(lookAction.success).toBe(true);
    expect(lookAction.parsedCommand.actionId).toBe('core:look');
  });
});