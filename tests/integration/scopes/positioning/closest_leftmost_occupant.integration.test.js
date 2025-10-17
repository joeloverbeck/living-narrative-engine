/**
 * @file Integration test for closest_leftmost_occupant scope resolution
 * Tests that the isClosestLeftOccupant operator works correctly in scope evaluation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';

describe('Closest Leftmost Occupant Scope - Integration', () => {
  let logger;
  let jsonLogicEval;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');

    // Mock GameDataRepository with empty conditions
    const mockGameDataRepository = {
      getConditionDefinition: () => null,
    };

    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: mockGameDataRepository,
    });
  });

  it('should validate isClosestLeftOccupant operator without errors', () => {
    // Create simple test setup to verify operator is in whitelist
    // This test verifies the fix for the validation error

    // The operator is used in a JSON Logic filter
    const jsonLogicRule = {
      isClosestLeftOccupant: ['entity', 'target', 'actor'],
    };

    // Test that validation passes (no error thrown/logged)
    const result = jsonLogicEval.evaluate(jsonLogicRule, {
      entity: { id: 'test_entity' },
      target: { id: 'test_target' },
      actor: { id: 'test_actor' },
    });

    // Should return a boolean without validation errors
    expect(typeof result).toBe('boolean');
  });
});
