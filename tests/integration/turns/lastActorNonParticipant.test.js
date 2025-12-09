import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TurnOrderService } from '../../../src/turns/order/turnOrderService.js';
import TurnCycle from '../../../src/turns/turnCycle.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { createMockLogger } from '../../common/mockFactories/index.js';
import {
  ACTOR_COMPONENT_ID,
  NAME_COMPONENT_ID,
  PARTICIPATION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

/**
 * Test suite for the specific scenario where the last actor in a round
 * is set to non-participant mid-round via Actor Participation Control.
 *
 * This is a legitimate gameplay scenario that should NOT trigger a warning.
 * The game should simply end the round and start a new one.
 *
 * @see https://github.com/user/repo/issues/XXX - Original bug report
 */
describe('Last Actor Non-Participant Mid-Round', () => {
  let turnOrderService;
  let turnCycle;
  let entityManager;
  let mockLogger;

  beforeEach(() => {
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
    await entityManager.addComponent(id, ACTOR_COMPONENT_ID, {});
    await entityManager.addComponent(id, NAME_COMPONENT_ID, { text: name });

    if (participating !== null && participating !== undefined) {
      await entityManager.addComponent(id, PARTICIPATION_COMPONENT_ID, {
        participating,
      });
    }

    return { id };
  }

  describe('Scenario: Last actor set to non-participant mid-round', () => {
    it('should NOT log warning when last actor in round is set to non-participant', async () => {
      // Setup: 2 actors, both participating initially
      const actor1 = await createTestActor('actor1', 'Hero', true);
      const actor2 = await createTestActor('actor2', 'Sidekick', true);

      turnOrderService.startNewRound([actor1, actor2], 'round-robin');

      // Actor 1 takes turn normally
      const first = await turnCycle.nextActor();
      expect(first?.id).toBe('actor1');

      // Mid-round: Set actor2 to non-participant (simulating UI toggle)
      await entityManager.addComponent('actor2', PARTICIPATION_COMPONENT_ID, {
        participating: false,
      });

      // Actor 2's turn is skipped, round ends
      const second = await turnCycle.nextActor();
      expect(second).toBeNull();

      // KEY ASSERTION: No warning should be logged
      // This is legitimate gameplay, not an error condition
      expect(mockLogger.warn).not.toHaveBeenCalled();

      // Debug log is acceptable and expected
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('non-participating')
      );
    });

    it('should return null gracefully when only remaining actors are non-participating', async () => {
      const actor1 = await createTestActor('actor1', 'Hero', true);
      const actor2 = await createTestActor('actor2', 'Sidekick', false);
      const actor3 = await createTestActor('actor3', 'Companion', false);

      turnOrderService.startNewRound([actor1, actor2, actor3], 'round-robin');

      // Actor 1 takes turn
      const first = await turnCycle.nextActor();
      expect(first?.id).toBe('actor1');

      // All remaining actors are non-participating
      const next = await turnCycle.nextActor();
      expect(next).toBeNull();

      // No warning should be logged - this is expected behavior
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should handle multiple actors set to non-participant mid-round', async () => {
      const actor1 = await createTestActor('actor1', 'First', true);
      const actor2 = await createTestActor('actor2', 'Second', true);
      const actor3 = await createTestActor('actor3', 'Third', true);

      turnOrderService.startNewRound([actor1, actor2, actor3], 'round-robin');

      // Actor 1 takes turn
      expect((await turnCycle.nextActor())?.id).toBe('actor1');

      // User disables both remaining actors mid-round
      await entityManager.addComponent('actor2', PARTICIPATION_COMPONENT_ID, {
        participating: false,
      });
      await entityManager.addComponent('actor3', PARTICIPATION_COMPONENT_ID, {
        participating: false,
      });

      // Round should end without warning
      const next = await turnCycle.nextActor();
      expect(next).toBeNull();
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should continue to next round after skipping non-participating actors', async () => {
      const actor1 = await createTestActor('actor1', 'Hero', true);
      const actor2 = await createTestActor('actor2', 'Disabled', false);

      turnOrderService.startNewRound([actor1, actor2], 'round-robin');

      // First round
      expect((await turnCycle.nextActor())?.id).toBe('actor1');
      expect(await turnCycle.nextActor()).toBeNull(); // actor2 skipped

      // Start new round
      turnOrderService.startNewRound([actor1, actor2], 'round-robin');

      // Re-enable actor2
      await entityManager.addComponent('actor2', PARTICIPATION_COMPONENT_ID, {
        participating: true,
      });

      // Both should now participate
      expect((await turnCycle.nextActor())?.id).toBe('actor1');
      expect((await turnCycle.nextActor())?.id).toBe('actor2');

      // No warnings throughout
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Scenario: All actors non-participating from start', () => {
    it('should NOT warn even when all actors are non-participating from the start', async () => {
      // This is a valid configuration - user might have all actors disabled
      const actor1 = await createTestActor('actor1', 'Disabled1', false);
      const actor2 = await createTestActor('actor2', 'Disabled2', false);

      turnOrderService.startNewRound([actor1, actor2], 'round-robin');

      const next = await turnCycle.nextActor();
      expect(next).toBeNull();

      // No warning - this is expected behavior, not an error
      // The game handles this gracefully by starting a new round
      expect(mockLogger.warn).not.toHaveBeenCalled();

      // Debug logging is acceptable
      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });
});
