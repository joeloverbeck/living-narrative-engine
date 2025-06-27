import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { TurnManager } from '../../../src/turns/turnManager.js';
import { 
  TURN_STARTED_ID,
  TURN_PROCESSING_STARTED,
  TURN_ENDED_ID 
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
    it('should include entity object for human player with player_type component', async () => {
      // Create a human player actor with the new player_type component
      const humanPlayer = createMockActor('player1', { 
        isPlayer: true,
        playerType: 'human',
        name: 'Test Player'
      });

      testBed.setActiveEntities(humanPlayer);
      testBed.mockNextActor(humanPlayer);

      await testBed.turnManager.start();
      await testBed.advanceAndFlush();

      // Verify turn_started event was dispatched with correct payload
      expect(dispatchSpy).toHaveBeenCalledWith(
        TURN_STARTED_ID,
        {
          entityId: 'player1',
          entityType: 'player',
          entity: expect.objectContaining({
            id: 'player1',
            components: expect.objectContaining({
              [PLAYER_TYPE_COMPONENT_ID]: { type: 'human' }
            })
          })
        }
      );
    });

    it('should include entity object for AI player with llm type', async () => {
      // Create an AI actor with LLM player type
      const aiActor = createMockActor('ai1', { 
        isPlayer: false,
        playerType: 'llm',
        name: 'AI Actor'
      });

      testBed.setActiveEntities(aiActor);
      testBed.mockNextActor(aiActor);

      await testBed.turnManager.start();
      await testBed.advanceAndFlush();

      expect(dispatchSpy).toHaveBeenCalledWith(
        TURN_STARTED_ID,
        {
          entityId: 'ai1',
          entityType: 'ai',
          entity: expect.objectContaining({
            id: 'ai1',
            components: expect.objectContaining({
              [PLAYER_TYPE_COMPONENT_ID]: { type: 'llm' }
            })
          })
        }
      );
    });

    it('should include entity object for AI player with goap type', async () => {
      // Create an AI actor with GOAP player type
      const goapActor = createMockActor('goap1', { 
        isPlayer: false,
        playerType: 'goap',
        name: 'GOAP Actor'
      });

      testBed.setActiveEntities(goapActor);
      testBed.mockNextActor(goapActor);

      await testBed.turnManager.start();
      await testBed.advanceAndFlush();

      expect(dispatchSpy).toHaveBeenCalledWith(
        TURN_STARTED_ID,
        {
          entityId: 'goap1',
          entityType: 'ai',
          entity: expect.objectContaining({
            id: 'goap1',
            components: expect.objectContaining({
              [PLAYER_TYPE_COMPONENT_ID]: { type: 'goap' }
            })
          })
        }
      );
    });

    it('should handle legacy entities without player_type component', async () => {
      // Create a legacy player without player_type component
      const legacyPlayer = createMockActor('legacy1', { 
        isPlayer: true,
        playerType: null, // Don't add player_type component
        name: 'Legacy Player'
      });

      // Remove the player_type component that createMockActor might have added
      delete legacyPlayer.components[PLAYER_TYPE_COMPONENT_ID];
      legacyPlayer.hasComponent = jest.fn((compId) => {
        return compId !== PLAYER_TYPE_COMPONENT_ID && 
               legacyPlayer.components[compId] !== undefined;
      });

      testBed.setActiveEntities(legacyPlayer);
      testBed.mockNextActor(legacyPlayer);

      await testBed.turnManager.start();
      await testBed.advanceAndFlush();

      expect(dispatchSpy).toHaveBeenCalledWith(
        TURN_STARTED_ID,
        {
          entityId: 'legacy1',
          entityType: 'player',
          entity: expect.objectContaining({
            id: 'legacy1',
            components: expect.not.objectContaining({
              [PLAYER_TYPE_COMPONENT_ID]: expect.anything()
            })
          })
        }
      );
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
        call => call[0] === TURN_STARTED_ID
      );
      const processingStartedCallIndex = dispatchSpy.mock.calls.findIndex(
        call => call[0] === TURN_PROCESSING_STARTED
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
        components: {}
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

  describe('Entity reference integrity', () => {
    it('should pass the same entity reference received from turnOrderService', async () => {
      const actor = createMockActor('actor1', { playerType: 'human' });
      
      testBed.setActiveEntities(actor);
      testBed.mockNextActor(actor);

      await testBed.turnManager.start();
      await testBed.advanceAndFlush();

      const turnStartedCall = dispatchSpy.mock.calls.find(
        call => call[0] === TURN_STARTED_ID
      );

      expect(turnStartedCall).toBeDefined();
      expect(turnStartedCall[1].entity).toBe(actor); // Same reference
    });

    it('should maintain entity properties through the event dispatch', async () => {
      const customComponents = {
        'custom:component': { data: 'test' },
        [PLAYER_TYPE_COMPONENT_ID]: { type: 'llm' }
      };

      const actor = createMockActor('actor1', { 
        playerType: 'llm',
        components: Object.entries(customComponents).map(([componentId, data]) => ({
          componentId,
          data
        }))
      });

      testBed.setActiveEntities(actor);
      testBed.mockNextActor(actor);

      await testBed.turnManager.start();
      await testBed.advanceAndFlush();

      const turnStartedCall = dispatchSpy.mock.calls.find(
        call => call[0] === TURN_STARTED_ID
      );

      expect(turnStartedCall[1].entity.components).toMatchObject(customComponents);
    });
  });
});