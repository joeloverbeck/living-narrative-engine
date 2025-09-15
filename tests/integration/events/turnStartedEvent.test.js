import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { TurnManager } from '../../../src/turns/turnManager.js';
import {
  TURN_STARTED_ID,
  TURN_PROCESSING_STARTED,
  TURN_ENDED_ID,
} from '../../../src/constants/eventIds.js';
import { PLAYER_TYPE_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { createMockActor } from '../../common/mockFactories/entities.js';
import { TurnManagerTestBed } from '../../common/turns/turnManagerTestBed.js';

describe('core:turn_started Event Payload', () => {
  let testBed;
  let dispatchSpy;

  beforeEach(() => {
    testBed = new TurnManagerTestBed();
    dispatchSpy = testBed.mocks.dispatcher.dispatch;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Event payload structure', () => {
    it('should include correct entityType for human player with player_type component', async () => {
      // Create a human player actor with the new player_type component
      const humanPlayer = createMockActor('player1', {
        isPlayer: true,
        playerType: 'human',
        name: 'Test Player',
      });

      testBed.setActiveEntities(humanPlayer);
      testBed.mockNextActor(humanPlayer);

      await testBed.turnManager.start();
      await testBed.advanceAndFlush();

      // Verify turn_started event was dispatched with correct payload
      // Note: entity object is no longer included to prevent recursion issues
      expect(dispatchSpy).toHaveBeenCalledWith(TURN_STARTED_ID, {
        entityId: 'player1',
        entityType: 'player',
      });
    });

    it('should include correct entityType for AI player with llm type', async () => {
      // Create an AI actor with LLM player type
      const aiActor = createMockActor('ai1', {
        isPlayer: false,
        playerType: 'llm',
        name: 'AI Actor',
      });

      testBed.setActiveEntities(aiActor);
      testBed.mockNextActor(aiActor);

      await testBed.turnManager.start();
      await testBed.advanceAndFlush();

      // Note: entity object is no longer included to prevent recursion issues
      expect(dispatchSpy).toHaveBeenCalledWith(TURN_STARTED_ID, {
        entityId: 'ai1',
        entityType: 'ai',
      });
    });

    it('should include correct entityType for AI player with goap type', async () => {
      // Create an AI actor with GOAP player type
      const goapActor = createMockActor('goap1', {
        isPlayer: false,
        playerType: 'goap',
        name: 'GOAP Actor',
      });

      testBed.setActiveEntities(goapActor);
      testBed.mockNextActor(goapActor);

      await testBed.turnManager.start();
      await testBed.advanceAndFlush();

      // Note: entity object is no longer included to prevent recursion issues
      expect(dispatchSpy).toHaveBeenCalledWith(TURN_STARTED_ID, {
        entityId: 'goap1',
        entityType: 'ai',
      });
    });

    it('should handle legacy entities without player_type component', async () => {
      // Create a legacy player without player_type component
      const legacyPlayer = createMockActor('legacy1', {
        isPlayer: true,
        playerType: null, // Don't add player_type component
        name: 'Legacy Player',
      });

      // Remove the player_type component that createMockActor might have added
      delete legacyPlayer.components[PLAYER_TYPE_COMPONENT_ID];
      legacyPlayer.hasComponent = jest.fn((compId) => {
        return (
          compId !== PLAYER_TYPE_COMPONENT_ID &&
          legacyPlayer.components[compId] !== undefined
        );
      });

      testBed.setActiveEntities(legacyPlayer);
      testBed.mockNextActor(legacyPlayer);

      await testBed.turnManager.start();
      await testBed.advanceAndFlush();

      // Note: entity object is no longer included to prevent recursion issues
      expect(dispatchSpy).toHaveBeenCalledWith(TURN_STARTED_ID, {
        entityId: 'legacy1',
        entityType: 'player',
      });
    });
  });

  describe('Event dispatching behavior', () => {
    it('should dispatch turn_started before turn_processing_started', async () => {
      const actor = createMockActor('actor1', { playerType: 'llm' });

      testBed.setActiveEntities(actor);
      testBed.mockNextActor(actor);

      await testBed.turnManager.start();
      await testBed.advanceAndFlush();

      // Get the order of dispatch calls
      const turnStartedCallIndex = dispatchSpy.mock.calls.findIndex(
        (call) => call[0] === TURN_STARTED_ID
      );
      const processingStartedCallIndex = dispatchSpy.mock.calls.findIndex(
        (call) => call[0] === TURN_PROCESSING_STARTED
      );

      expect(turnStartedCallIndex).toBeGreaterThanOrEqual(0);
      expect(processingStartedCallIndex).toBeGreaterThanOrEqual(0);
      expect(turnStartedCallIndex).toBeLessThan(processingStartedCallIndex);
    });

    it('should not dispatch turn_started for non-actor entities', async () => {
      // Create an entity without actor component
      const nonActor = {
        id: 'non-actor1',
        hasComponent: jest.fn(() => false),
        getComponentData: jest.fn(() => null),
        components: {},
      };

      testBed.setActiveEntities(nonActor);
      testBed.mockNextActor(nonActor);

      await testBed.turnManager.start();
      await testBed.advanceAndFlush();

      // Should not dispatch turn_started for non-actors
      expect(dispatchSpy).not.toHaveBeenCalledWith(
        TURN_STARTED_ID,
        expect.any(Object)
      );
    });
  });

  describe('Entity ID handling', () => {
    it('should pass the correct entity ID from turnOrderService', async () => {
      const actor = createMockActor('actor1', { playerType: 'human' });

      testBed.setActiveEntities(actor);
      testBed.mockNextActor(actor);

      await testBed.turnManager.start();
      await testBed.advanceAndFlush();

      const turnStartedCall = dispatchSpy.mock.calls.find(
        (call) => call[0] === TURN_STARTED_ID
      );

      expect(turnStartedCall).toBeDefined();
      // Entity object is no longer passed to prevent recursion issues
      // Only entityId is passed
      expect(turnStartedCall[1].entityId).toBe('actor1');
      expect(turnStartedCall[1].entity).toBeUndefined();
    });

    it('should not include entity object to prevent recursion issues', async () => {
      const customComponents = {
        'custom:component': { data: 'test' },
        [PLAYER_TYPE_COMPONENT_ID]: { type: 'llm' },
      };

      const actor = createMockActor('actor1', {
        playerType: 'llm',
        components: Object.entries(customComponents).map(
          ([componentId, data]) => ({
            componentId,
            data,
          })
        ),
      });

      testBed.setActiveEntities(actor);
      testBed.mockNextActor(actor);

      await testBed.turnManager.start();
      await testBed.advanceAndFlush();

      const turnStartedCall = dispatchSpy.mock.calls.find(
        (call) => call[0] === TURN_STARTED_ID
      );

      // Entity object should not be included to prevent recursion
      expect(turnStartedCall[1].entity).toBeUndefined();
      expect(turnStartedCall[1].entityId).toBe('actor1');
    });
  });
});
