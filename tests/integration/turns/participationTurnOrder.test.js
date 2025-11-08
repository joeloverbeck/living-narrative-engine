import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TurnOrderService } from '../../../src/turns/order/turnOrderService.js';
import TurnCycle from '../../../src/turns/turnCycle.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { createMockLogger } from '../../common/mockFactories/index.js';
import {
  ACTOR_COMPONENT_ID,
  NAME_COMPONENT_ID,
  PARTICIPATION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('Turn Order - Participation Integration', () => {
  let turnOrderService;
  let turnCycle;
  let entityManager;
  let mockLogger;

  beforeEach(() => {
    // Create real service instances for integration testing
    mockLogger = createMockLogger();
    turnOrderService = new TurnOrderService({ logger: mockLogger });
    entityManager = new SimpleEntityManager();
    turnCycle = new TurnCycle(turnOrderService, entityManager, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper to create a test actor with components
   *
   * @param {string} id - Entity ID
   * @param {string} name - Actor name
   * @param {boolean|null} participating - Participation state (null = no component)
   * @returns {Promise<object>} Entity object with id
   */
  async function createTestActor(id, name, participating) {
    // Add actor component
    await entityManager.addComponent(id, ACTOR_COMPONENT_ID, {});
    await entityManager.addComponent(id, NAME_COMPONENT_ID, { text: name });

    // Add participation component if specified
    if (participating !== null && participating !== undefined) {
      await entityManager.addComponent(id, PARTICIPATION_COMPONENT_ID, {
        participating,
      });
    }

    // Return entity object (SimpleEntityManager returns { id })
    return { id };
  }

  describe('Turn Skip Behavior', () => {
    it('should skip actors with participating: false', async () => {
      const actor1 = await createTestActor('actor1', 'Hero', true);
      const actor2 = await createTestActor('actor2', 'Villain', false);
      const actor3 = await createTestActor('actor3', 'Sidekick', true);

      // Start round with all actors
      const entities = [actor1, actor2, actor3];
      turnOrderService.startNewRound(entities, 'round-robin');

      // Get next actors via TurnCycle (handles participation filtering)
      const first = await turnCycle.nextActor();
      expect(first?.id).toBe('actor1');

      const second = await turnCycle.nextActor();
      expect(second?.id).toBe('actor3'); // actor2 skipped

      const third = await turnCycle.nextActor();
      expect(third).toBeNull(); // Queue exhausted (no wrapping in TurnOrderService)
    });

    it('should process actors with participating: true normally', async () => {
      const actor1 = await createTestActor('actor1', 'Hero', true);
      const actor2 = await createTestActor('actor2', 'Ally', true);

      turnOrderService.startNewRound([actor1, actor2], 'round-robin');

      const first = await turnCycle.nextActor();
      expect(first?.id).toBe('actor1');

      const second = await turnCycle.nextActor();
      expect(second?.id).toBe('actor2');
    });

    it('should default to participating: true when component missing', async () => {
      const actor1 = await createTestActor('actor1', 'Hero', null); // No component

      turnOrderService.startNewRound([actor1], 'round-robin');

      const next = await turnCycle.nextActor();
      expect(next?.id).toBe('actor1'); // Not skipped (defaults to true)
    });

    it('should handle multiple actors with mixed participation states', async () => {
      const actor1 = await createTestActor('actor1', 'Active', true);
      const actor2 = await createTestActor('actor2', 'Inactive', false);
      const actor3 = await createTestActor('actor3', 'NoComponent', null);
      const actor4 = await createTestActor('actor4', 'Active2', true);
      const actor5 = await createTestActor('actor5', 'Inactive2', false);

      turnOrderService.startNewRound(
        [actor1, actor2, actor3, actor4, actor5],
        'round-robin'
      );

      const first = await turnCycle.nextActor();
      expect(first?.id).toBe('actor1');

      const second = await turnCycle.nextActor();
      expect(second?.id).toBe('actor3'); // actor2 skipped

      const third = await turnCycle.nextActor();
      expect(third?.id).toBe('actor4');

      const fourth = await turnCycle.nextActor();
      expect(fourth).toBeNull(); // actor5 skipped, queue exhausted
    });

    it('should continue turn progression correctly after skipping non-participating actors', async () => {
      const actor1 = await createTestActor('actor1', 'First', true);
      const actor2 = await createTestActor('actor2', 'Skip1', false);
      const actor3 = await createTestActor('actor3', 'Skip2', false);
      const actor4 = await createTestActor('actor4', 'Second', true);
      const actor5 = await createTestActor('actor5', 'Skip3', false);
      const actor6 = await createTestActor('actor6', 'Third', true);

      turnOrderService.startNewRound(
        [actor1, actor2, actor3, actor4, actor5, actor6],
        'round-robin'
      );

      // Should only get participating actors in order
      expect((await turnCycle.nextActor())?.id).toBe('actor1');
      expect((await turnCycle.nextActor())?.id).toBe('actor4');
      expect((await turnCycle.nextActor())?.id).toBe('actor6');
      expect(await turnCycle.nextActor()).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should return null when all actors are non-participating', async () => {
      const actor1 = await createTestActor('actor1', 'Disabled1', false);
      const actor2 = await createTestActor('actor2', 'Disabled2', false);

      turnOrderService.startNewRound([actor1, actor2], 'round-robin');

      const next = await turnCycle.nextActor();
      expect(next).toBeNull();

      // Verify warning was logged about no participating actors
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No participating actors found')
      );
    });

    it('should handle empty turn queue gracefully', async () => {
      const next = await turnCycle.nextActor();
      expect(next).toBeNull();
    });

    it('should maintain turn order with mixed participation states', async () => {
      const actor1 = await createTestActor('actor1', 'Active', true);
      const actor2 = await createTestActor('actor2', 'Inactive', false);
      const actor3 = await createTestActor('actor3', 'NoComponent', null);
      const actor4 = await createTestActor('actor4', 'Active2', true);

      turnOrderService.startNewRound(
        [actor1, actor2, actor3, actor4],
        'round-robin'
      );

      const first = await turnCycle.nextActor();
      expect(first?.id).toBe('actor1');

      const second = await turnCycle.nextActor();
      expect(second?.id).toBe('actor3'); // actor2 skipped

      const third = await turnCycle.nextActor();
      expect(third?.id).toBe('actor4');
    });

    it('should handle single participating actor among many disabled', async () => {
      const actor1 = await createTestActor('actor1', 'Disabled1', false);
      const actor2 = await createTestActor('actor2', 'OnlyActive', true);
      const actor3 = await createTestActor('actor3', 'Disabled2', false);
      const actor4 = await createTestActor('actor4', 'Disabled3', false);

      turnOrderService.startNewRound(
        [actor1, actor2, actor3, actor4],
        'round-robin'
      );

      const next = await turnCycle.nextActor();
      expect(next?.id).toBe('actor2');

      const afterThat = await turnCycle.nextActor();
      expect(afterThat).toBeNull(); // Queue exhausted
    });
  });

  describe('Turn Progression Tests', () => {
    it('should complete full turn cycle with participation filtering', async () => {
      const actor1 = await createTestActor('actor1', 'Fighter', true);
      const actor2 = await createTestActor('actor2', 'Disabled', false);
      const actor3 = await createTestActor('actor3', 'Mage', true);
      const actor4 = await createTestActor('actor4', 'Rogue', true);

      turnOrderService.startNewRound(
        [actor1, actor2, actor3, actor4],
        'round-robin'
      );

      // Get all actors in the turn cycle
      const turns = [];
      let actor = await turnCycle.nextActor();
      while (actor) {
        turns.push(actor.id);
        actor = await turnCycle.nextActor();
      }

      expect(turns).toEqual(['actor1', 'actor3', 'actor4']);
      expect(turns).not.toContain('actor2');
    });

    it('should maintain turn order after skipping non-participating actors', async () => {
      const actor1 = await createTestActor('actor1', 'First', true);
      const actor2 = await createTestActor('actor2', 'Skip', false);
      const actor3 = await createTestActor('actor3', 'Second', true);
      const actor4 = await createTestActor('actor4', 'Third', true);

      turnOrderService.startNewRound(
        [actor1, actor2, actor3, actor4],
        'round-robin'
      );

      // Verify actors are returned in correct order (FIFO round-robin)
      expect((await turnCycle.nextActor())?.id).toBe('actor1');
      expect((await turnCycle.nextActor())?.id).toBe('actor3');
      expect((await turnCycle.nextActor())?.id).toBe('actor4');
    });

    it('should verify actors are returned in correct FIFO order', async () => {
      const actor1 = await createTestActor('actor1', 'Alpha', true);
      const actor2 = await createTestActor('actor2', 'Beta', true);
      const actor3 = await createTestActor('actor3', 'Gamma', true);

      turnOrderService.startNewRound(
        [actor1, actor2, actor3],
        'round-robin'
      );

      // Verify FIFO order maintained
      const first = await turnCycle.nextActor();
      expect(first?.id).toBe('actor1');

      const second = await turnCycle.nextActor();
      expect(second?.id).toBe('actor2');

      const third = await turnCycle.nextActor();
      expect(third?.id).toBe('actor3');
    });

    it('should return null when queue is exhausted (no automatic wrapping)', async () => {
      const actor1 = await createTestActor('actor1', 'Solo', true);

      turnOrderService.startNewRound([actor1], 'round-robin');

      const first = await turnCycle.nextActor();
      expect(first?.id).toBe('actor1');

      const second = await turnCycle.nextActor();
      expect(second).toBeNull(); // Queue exhausted, no wrapping
    });
  });

  describe('LLM API Call Prevention', () => {
    it('should verify turn cycle skips non-participating actors', async () => {
      const actor1 = await createTestActor('actor1', 'Hero', true);
      const actor2 = await createTestActor('actor2', 'Villain', false);
      const actor3 = await createTestActor('actor3', 'Sidekick', true);

      turnOrderService.startNewRound([actor1, actor2, actor3], 'round-robin');

      // Verify only participating actors are returned
      const turns = [];
      let actor = await turnCycle.nextActor();
      while (actor) {
        turns.push(actor.id);
        actor = await turnCycle.nextActor();
      }

      expect(turns).toEqual(['actor1', 'actor3']); // actor2 excluded
      expect(turns).not.toContain('actor2');
    });

    it('should verify participation component data structure', async () => {
      const actorId = 'actor1';
      await createTestActor(actorId, 'Hero', false);

      // Verify component data is stored correctly
      const participation = entityManager.getComponentData(
        actorId,
        PARTICIPATION_COMPONENT_ID
      );

      expect(participation).toEqual({ participating: false });
      expect(typeof participation.participating).toBe('boolean');
    });

    it('should verify only participating actors are returned from turn cycle', async () => {
      const actor1 = await createTestActor('actor1', 'Active1', true);
      const actor2 = await createTestActor('actor2', 'Inactive1', false);
      const actor3 = await createTestActor('actor3', 'Active2', true);
      const actor4 = await createTestActor('actor4', 'Inactive2', false);
      const actor5 = await createTestActor('actor5', 'Active3', true);

      turnOrderService.startNewRound(
        [actor1, actor2, actor3, actor4, actor5],
        'round-robin'
      );

      // Collect all returned actors
      const returnedActors = [];
      let actor = await turnCycle.nextActor();
      while (actor) {
        returnedActors.push(actor.id);
        actor = await turnCycle.nextActor();
      }

      // Verify non-participating actors excluded
      expect(returnedActors).toEqual(['actor1', 'actor3', 'actor5']);
      expect(returnedActors).not.toContain('actor2');
      expect(returnedActors).not.toContain('actor4');
    });
  });

  describe('Infinite Loop Prevention', () => {
    it('should have max attempts limit when all actors disabled', async () => {
      const actor1 = await createTestActor('actor1', 'Disabled1', false);
      const actor2 = await createTestActor('actor2', 'Disabled2', false);
      const actor3 = await createTestActor('actor3', 'Disabled3', false);

      turnOrderService.startNewRound([actor1, actor2, actor3], 'round-robin');

      const next = await turnCycle.nextActor();
      expect(next).toBeNull();

      // Verify warning was logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No participating actors found')
      );
    });

    it('should log warning when no participating actors found', async () => {
      const actor1 = await createTestActor('actor1', 'Inactive1', false);
      const actor2 = await createTestActor('actor2', 'Inactive2', false);

      turnOrderService.startNewRound([actor1, actor2], 'round-robin');

      await turnCycle.nextActor();

      // Verify warning was logged via mockLogger.warn
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/No participating actors found/)
      );
    });

    it('should return null (not infinite loop) when all actors non-participating', async () => {
      const actor1 = await createTestActor('actor1', 'Disabled1', false);
      const actor2 = await createTestActor('actor2', 'Disabled2', false);
      const actor3 = await createTestActor('actor3', 'Disabled3', false);
      const actor4 = await createTestActor('actor4', 'Disabled4', false);

      turnOrderService.startNewRound(
        [actor1, actor2, actor3, actor4],
        'round-robin'
      );

      // Should return null immediately, not loop
      const result = await turnCycle.nextActor();
      expect(result).toBeNull();

      // Should have logged warning about no participating actors
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should verify max attempts limit prevents infinite loop', async () => {
      // Create many disabled actors
      const actors = [];
      for (let i = 1; i <= 60; i++) {
        actors.push(await createTestActor(`actor${i}`, `Disabled${i}`, false));
      }

      turnOrderService.startNewRound(actors, 'round-robin');

      // Should not hang, should return null
      const result = await turnCycle.nextActor();
      expect(result).toBeNull();

      // Verify warning logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No participating actors found')
      );
    });
  });
});
