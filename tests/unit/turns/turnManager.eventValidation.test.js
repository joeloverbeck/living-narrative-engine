// tests/unit/turns/turnManager.eventValidation.test.js
// --- FILE START ---

import { describeTurnManagerSuite } from '../../common/turns/turnManagerTestBed.js';
import { TURN_ENDED_ID } from '../../../src/constants/eventIds.js';
import { ACTOR_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { beforeEach, expect, test } from '@jest/globals';
import { createAiActor } from '../../common/turns/testActors.js';

describeTurnManagerSuite('TurnManager - Event Validation', (getBed) => {
  let testBed;
  let ai1;

  beforeEach(() => {
    testBed = getBed();
    ai1 = createAiActor('actor1', {
      components: [ACTOR_COMPONENT_ID],
    });
    testBed.setActiveEntities(ai1);

    // Ensure subscribe returns a function for proper event handling
    testBed.mocks.dispatcher.subscribe.mockReturnValue(jest.fn());

    // Make sure the turn order service doesn't claim to be empty initially
    testBed.mocks.turnOrderService.isEmpty.mockResolvedValue(false);
    testBed.mocks.turnOrderService.getNextEntity.mockResolvedValue(ai1);
  });

  describe('Basic State Validation', () => {
    test('should start with no current actor', () => {
      expect(testBed.turnManager.getCurrentActor()).toBeNull();
    });

    test('should start with no active handler', () => {
      expect(testBed.turnManager.getActiveTurnHandler()).toBeNull();
    });

    test('should handle empty entity list gracefully', () => {
      testBed.setActiveEntities(); // No entities
      expect(testBed.turnManager.getCurrentActor()).toBeNull();
    });
  });

  describe('Turn Manager State Management', () => {
    test('should maintain state after starting and stopping', async () => {
      await testBed.turnManager.start();
      expect(testBed.mocks.dispatcher.subscribe).toHaveBeenCalled();

      await testBed.turnManager.stop();
      expect(
        testBed.mocks.turnOrderService.clearCurrentRound
      ).toHaveBeenCalled();
      expect(testBed.turnManager.getCurrentActor()).toBeNull();
    });

    test('should handle multiple start calls gracefully', async () => {
      testBed.mocks.logger.warn.mockClear();

      await testBed.turnManager.start();

      await testBed.turnManager.start();
      expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
        'TurnManager.start() called but manager is already running.'
      );
    });

    test('should handle stop when not running', async () => {
      testBed.mocks.logger.debug.mockClear();
      await testBed.turnManager.stop();
      expect(testBed.mocks.logger.debug).toHaveBeenCalledWith(
        'TurnManager.stop() called but manager is already stopped.'
      );
    });
  });

  describe('Event Subscription Management', () => {
    test('should subscribe to TURN_ENDED_ID on start', async () => {
      await testBed.turnManager.start();
      expect(testBed.mocks.dispatcher.subscribe).toHaveBeenCalledWith(
        TURN_ENDED_ID,
        expect.any(Function)
      );
    });

    test('should unsubscribe on stop', async () => {
      const mockUnsubscribe = jest.fn();
      testBed.mocks.dispatcher.subscribe.mockReturnValue(mockUnsubscribe);

      await testBed.turnManager.start();
      expect(testBed.mocks.dispatcher.subscribe).toHaveBeenCalled();

      await testBed.turnManager.stop();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});

// --- FILE END ---
