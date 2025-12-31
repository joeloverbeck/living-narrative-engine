import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import RoundManager from '../../../src/turns/roundManager.js';
import { TurnOrderService } from '../../../src/turns/order/turnOrderService.js';
import { TurnOrderShuffleService } from '../../../src/turns/services/turnOrderShuffleService.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { ACTOR_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { ROUND_STARTED_ID } from '../../../src/constants/eventIds.js';

class CapturingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, ...args) {
    this.debugLogs.push({ message, args });
  }

  info(message, ...args) {
    this.infoLogs.push({ message, args });
  }

  warn(message, ...args) {
    this.warnLogs.push({ message, args });
  }

  error(message, ...args) {
    this.errorLogs.push({ message, args });
  }
}

/**
 * Creates a basic actor entity without player_type
 *
 * @param {string} id - Entity ID
 * @returns {object} Actor entity
 */
function createActor(id) {
  return {
    id,
    components: {
      [ACTOR_COMPONENT_ID]: {},
    },
  };
}

/**
 * Creates an actor entity with player_type component for shuffle testing
 *
 * @param {string} id - Entity ID
 * @param {string} [type] - Player type ('human' or 'llm'). Defaults to 'llm' if not provided.
 * @returns {object} Actor entity with player_type component
 */
function createActorWithPlayerType(id, type = 'llm') {
  return {
    id,
    name: `Entity ${id}`,
    components: {
      [ACTOR_COMPONENT_ID]: {},
      'core:player_type': { type },
    },
    hasComponent: function (componentId) {
      return componentId in this.components;
    },
    getComponentData: function (componentId) {
      return this.components[componentId];
    },
  };
}

describe('RoundManager integration with real turn order service', () => {
  /** @type {CapturingLogger} */
  let logger;
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {TurnOrderService} */
  let turnOrderService;
  /** @type {RoundManager} */
  let roundManager;
  let mockDispatcher;

  beforeEach(() => {
    logger = new CapturingLogger();
    entityManager = new SimpleEntityManager();
    turnOrderService = new TurnOrderService({ logger });
    mockDispatcher = {
      dispatch: jest.fn(),
    };
    roundManager = new RoundManager(
      turnOrderService,
      entityManager,
      logger,
      mockDispatcher
    );
  });

  it('starts a round-robin round with actors', async () => {
    entityManager.setEntities([
      createActor('actor1'),
      createActor('actor2'),
      createActor('actor3'),
    ]);

    await roundManager.startRound();

    expect(roundManager.inProgress).toBe(true);
    expect(roundManager.hadSuccess).toBe(false);

    const first = turnOrderService.getNextEntity();
    const second = turnOrderService.getNextEntity();
    const third = turnOrderService.getNextEntity();

    expect(first?.id).toBe('actor1');
    expect(second?.id).toBe('actor2');
    expect(third?.id).toBe('actor3');
  });

  it('rejects rounds when there are no active actor entities', async () => {
    entityManager.setEntities([{ id: 'noActor', components: {} }]);

    await expect(roundManager.startRound()).rejects.toThrow(
      'Cannot start a new round: No active entities with an Actor component found.'
    );

    expect(
      logger.errorLogs.some((entry) =>
        entry.message.includes(
          'Cannot start a new round: No active entities with an Actor component found.'
        )
      )
    ).toBe(true);
  });

  it('exposes lifecycle flags that reflect round progress', async () => {
    entityManager.setEntities([createActor('actor1'), createActor('actor2')]);

    await roundManager.startRound();

    expect(roundManager.inProgress).toBe(true);
    expect(roundManager.hadSuccess).toBe(false);

    roundManager.endTurn(true);
    expect(roundManager.hadSuccess).toBe(true);

    roundManager.resetFlags();
    expect(roundManager.inProgress).toBe(false);
    expect(roundManager.hadSuccess).toBe(false);
  });
});

describe('RoundManager ROUND_STARTED event with shuffle integration', () => {
  /** @type {CapturingLogger} */
  let logger;
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {TurnOrderShuffleService} */
  let shuffleService;
  /** @type {TurnOrderService} */
  let turnOrderService;
  /** @type {RoundManager} */
  let roundManager;
  let mockDispatcher;

  beforeEach(() => {
    logger = new CapturingLogger();
    entityManager = new SimpleEntityManager();
    shuffleService = new TurnOrderShuffleService({ logger });
    turnOrderService = new TurnOrderService({
      logger,
      shuffleService,
    });
    mockDispatcher = {
      dispatch: jest.fn(),
    };
    roundManager = new RoundManager(
      turnOrderService,
      entityManager,
      logger,
      mockDispatcher
    );
  });

  it('dispatches ROUND_STARTED event with shuffled actor IDs (not original order)', async () => {
    // Setup: 1 human at position 0, 4 LLM actors
    // Original order: jorren (human), kestrel, saffi, pitch, hobb
    const actors = [
      createActorWithPlayerType('jorren_weir', 'human'),
      createActorWithPlayerType('kestrel_brune', 'llm'),
      createActorWithPlayerType('saffi_two_tides', 'llm'),
      createActorWithPlayerType('pitch', 'llm'),
      createActorWithPlayerType('hobb_rusk', 'llm'),
    ];
    entityManager.setEntities(actors);

    const originalNpcOrder = ['kestrel_brune', 'saffi_two_tides', 'pitch', 'hobb_rusk'];

    // Start the round (uses round-robin by default)
    await roundManager.startRound();

    // Verify event was dispatched
    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      ROUND_STARTED_ID,
      expect.objectContaining({
        roundNumber: 1,
        strategy: 'round-robin',
        actors: expect.any(Array),
      })
    );

    // Get the actor IDs from the event payload
    const eventPayload = mockDispatcher.dispatch.mock.calls[0][1];
    const eventActorIds = eventPayload.actors;

    // Human should remain at position 0
    expect(eventActorIds[0]).toBe('jorren_weir');

    // NPCs should contain the same elements (possibly shuffled)
    const eventNpcIds = eventActorIds.slice(1);
    expect(eventNpcIds.sort()).toEqual(originalNpcOrder.sort());

    // The event payload should match the actual turn order in the service
    const turnOrderFromService = turnOrderService.getCurrentOrder().map((e) => e.id);
    expect(eventActorIds).toEqual(turnOrderFromService);
  });

  it('preserves multiple human positions in event payload while shuffling NPCs', async () => {
    // Setup: humans at positions 0 and 3
    const actors = [
      createActorWithPlayerType('human1', 'human'),
      createActorWithPlayerType('npc1', 'llm'),
      createActorWithPlayerType('npc2', 'llm'),
      createActorWithPlayerType('human2', 'human'),
      createActorWithPlayerType('npc3', 'llm'),
    ];
    entityManager.setEntities(actors);

    await roundManager.startRound();

    const eventPayload = mockDispatcher.dispatch.mock.calls[0][1];
    const eventActorIds = eventPayload.actors;

    // Humans should remain at their original positions
    expect(eventActorIds[0]).toBe('human1');
    expect(eventActorIds[3]).toBe('human2');

    // NPCs should be in positions 1, 2, 4
    const npcIds = [eventActorIds[1], eventActorIds[2], eventActorIds[4]];
    expect(npcIds.sort()).toEqual(['npc1', 'npc2', 'npc3']);
  });

  it('event payload matches actual turn queue after shuffle', async () => {
    const actors = [
      createActorWithPlayerType('human1', 'human'),
      createActorWithPlayerType('npc1', 'llm'),
      createActorWithPlayerType('npc2', 'llm'),
      createActorWithPlayerType('npc3', 'llm'),
    ];
    entityManager.setEntities(actors);

    await roundManager.startRound();

    const eventPayload = mockDispatcher.dispatch.mock.calls[0][1];
    const eventActorIds = eventPayload.actors;

    // Get first few entities from the turn order service
    const firstFromQueue = turnOrderService.getNextEntity();
    const secondFromQueue = turnOrderService.getNextEntity();

    // The event payload should reflect the actual turn order
    expect(eventActorIds[0]).toBe(firstFromQueue.id);
    expect(eventActorIds[1]).toBe(secondFromQueue.id);
  });

  it('dispatches original order when no shuffle service is present (backward compatibility)', async () => {
    // Create RoundManager without shuffle service
    const turnOrderServiceNoShuffle = new TurnOrderService({ logger });
    const roundManagerNoShuffle = new RoundManager(
      turnOrderServiceNoShuffle,
      entityManager,
      logger,
      mockDispatcher
    );

    const actors = [
      createActorWithPlayerType('actor1', 'llm'),
      createActorWithPlayerType('actor2', 'llm'),
      createActorWithPlayerType('actor3', 'llm'),
    ];
    entityManager.setEntities(actors);

    await roundManagerNoShuffle.startRound();

    const eventPayload = mockDispatcher.dispatch.mock.calls[0][1];
    const eventActorIds = eventPayload.actors;

    // Without shuffle service, order should be preserved
    expect(eventActorIds).toEqual(['actor1', 'actor2', 'actor3']);
  });

  it('event payload contains shuffled order even on first round', async () => {
    // This test specifically verifies the fix: shuffle happens on first round
    // and the event contains the shuffled order, not the original order
    const actors = [
      createActorWithPlayerType('human1', 'human'),
      createActorWithPlayerType('npc1', 'llm'),
      createActorWithPlayerType('npc2', 'llm'),
      createActorWithPlayerType('npc3', 'llm'),
      createActorWithPlayerType('npc4', 'llm'),
      createActorWithPlayerType('npc5', 'llm'),
    ];
    entityManager.setEntities(actors);

    // Start round and verify it gets shuffled order
    await roundManager.startRound();

    expect(mockDispatcher.dispatch).toHaveBeenCalledTimes(1);

    const eventPayload = mockDispatcher.dispatch.mock.calls[0][1];
    expect(eventPayload.roundNumber).toBe(1);

    // Human at position 0 preserved
    expect(eventPayload.actors[0]).toBe('human1');

    // Verify event matches actual turn order
    const turnOrder = turnOrderService.getCurrentOrder().map((e) => e.id);
    expect(eventPayload.actors).toEqual(turnOrder);
  });
});
