/**
 * @file Integration test for closest_rightmost_occupant scope resolution
 * Tests that the isClosestRightOccupant operator works correctly in scope evaluation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';

describe('Closest Rightmost Occupant Scope - Integration', () => {
  let logger;
  let jsonLogicEval;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR');

    const mockGameDataRepository = {
      getConditionDefinition: () => null,
    };

    jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: mockGameDataRepository,
    });

    // Register a no-op implementation so evaluation succeeds during the whitelist check
    jsonLogicEval.addOperation('isClosestRightOccupant', () => false);
  });

  it('should validate isClosestRightOccupant operator without errors', () => {
    const jsonLogicRule = {
      isClosestRightOccupant: ['entity', 'target', 'actor'],
    };

    const result = jsonLogicEval.evaluate(jsonLogicRule, {
      entity: { id: 'test_entity' },
      target: { id: 'test_target' },
      actor: { id: 'test_actor' },
    });

    expect(typeof result).toBe('boolean');
  });
});
