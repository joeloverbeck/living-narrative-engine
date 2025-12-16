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

  it('normalises complex initiative Maps supplied via options object and starts an initiative round', async () => {
    entityManager.setEntities([
      createActor('actor1'),
      createActor('actor2'),
      createActor('actor3'),
      createActor('actor4'),
      createActor('actor6'),
      createActor('actor7'),
    ]);

    const rawMap = new Map();
    rawMap.set('actor1', 5);
    rawMap.set(' actor1 ', '7');
    rawMap.set(42, 10);
    rawMap.set('   ', 3);
    rawMap.set('actor2', ' 9 ');
    rawMap.set('actor3', null);
    rawMap.set('actor4', 'foo');
    rawMap.set('actor5', {});
    rawMap.set('actor7', '');
    rawMap.set('actor6', true);

    await roundManager.startRound({ initiativeData: rawMap });

    expect(roundManager.inProgress).toBe(true);
    expect(roundManager.hadSuccess).toBe(false);

    const warnMessages = logger.warnLogs
      .map((entry) => entry.message)
      .filter((message) => message.startsWith('RoundManager.startRound()'));

    expect(warnMessages).toEqual(
      expect.arrayContaining([
        'RoundManager.startRound(): Duplicate initiative entry for entity id "actor1" after normalisation. Using latest value.',
        'RoundManager.startRound(): Ignoring initiative entry with non-string entity id from Map input.',
        'RoundManager.startRound(): Ignoring initiative entry with blank entity id from Map input after trimming whitespace.',
        'RoundManager.startRound(): Ignoring initiative entry with missing score.',
        'RoundManager.startRound(): Ignoring initiative entry with non-numeric score.',
        'RoundManager.startRound(): Ignoring initiative entry with empty string score.',
      ])
    );

    const first = turnOrderService.getNextEntity();
    const second = turnOrderService.getNextEntity();

    expect(first?.id).toBe('actor2');
    expect(second?.id).toBe('actor1');
  });

  it('falls back to the initiative strategy when unknown strategy and object initiative data are provided', async () => {
    entityManager.setEntities([createActor('alpha'), createActor('beta')]);

    const rawObject = {
      alpha: '5',
      ' beta ': '9',
      gamma: '',
    };

    await roundManager.startRound({
      strategy: ' Mystery ',
      initiativeData: rawObject,
    });

    const warnMessages = logger.warnLogs
      .map((entry) => entry.message)
      .filter((message) =>
        message.startsWith('RoundManager.startRound(): Unknown strategy')
      );

    expect(warnMessages).toContain(
      "RoundManager.startRound(): Unknown strategy 'mystery'. Falling back to 'initiative' because initiative data was provided."
    );

    expect(
      logger.debugLogs.some((entry) =>
        entry.message.includes(
          'RoundManager.startRound(): Normalised plain object initiative data into Map for initiative round.'
        )
      )
    ).toBe(true);

    const next = turnOrderService.peekNextEntity();
    expect(next?.id).toBe('beta');
  });

  it('falls back to round-robin when unknown strategy is provided without usable initiative data', async () => {
    entityManager.setEntities([createActor('actor1'), createActor('actor2')]);

    await roundManager.startRound('mystery', []);

    const warnMessages = logger.warnLogs
      .map((entry) => entry.message)
      .filter((message) =>
        message.startsWith('RoundManager.startRound(): Unknown strategy')
      );

    expect(warnMessages).toContain(
      "RoundManager.startRound(): Unknown strategy 'mystery'. Falling back to 'round-robin'."
    );

    const first = turnOrderService.getNextEntity();
    const second = turnOrderService.getNextEntity();

    expect(first?.id).toBe('actor1');
    expect(second?.id).toBe('actor2');
  });

  it('normalises initiative arrays and surfaces data issues before starting the round', async () => {
    entityManager.setEntities([
      createActor('actorA'),
      createActor('actorB'),
      createActor('actorC'),
      createActor('actorD'),
      createActor('actorE'),
      createActor('actorF'),
    ]);

    const rawArray = [
      ['actorA', '10'],
      'bad entry',
      ['actorB'],
      ['actorC', null],
      [{ id: 'actorD' }, 5],
      ['  ', 4],
      ['actorE', {}],
      ['actorF', ''],
      ['actorA', 15],
    ];

    await roundManager.startRound('initiative', rawArray);

    const warnMessages = logger.warnLogs
      .map((entry) => entry.message)
      .filter((message) => message.startsWith('RoundManager.startRound()'));

    expect(warnMessages).toEqual(
      expect.arrayContaining([
        'RoundManager.startRound(): Ignoring malformed initiative entry from array input.',
        'RoundManager.startRound(): Ignoring initiative entry with missing score.',
        'RoundManager.startRound(): Ignoring initiative entry with non-string entity id from array input.',
        'RoundManager.startRound(): Ignoring initiative entry with blank entity id from array input after trimming whitespace.',
        'RoundManager.startRound(): Ignoring initiative entry with non-numeric score.',
        'RoundManager.startRound(): Ignoring initiative entry with empty string score.',
        'RoundManager.startRound(): Duplicate initiative entry for entity id "actorA" after normalisation. Using latest value.',
      ])
    );

    const next = turnOrderService.getNextEntity();
    expect(next?.id).toBe('actorA');
  });

  it('rejects initiative rounds when normalisation produces no usable entries', async () => {
    entityManager.setEntities([createActor('actor1')]);

    await expect(
      roundManager.startRound('initiative', new Map())
    ).rejects.toThrow(
      'Cannot start an initiative round: initiativeData Map is required.'
    );

    expect(
      logger.errorLogs.some((entry) =>
        entry.message.includes(
          'Cannot start an initiative round: initiativeData Map is required.'
        )
      )
    ).toBe(true);
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

    await roundManager.startRound(42);

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

    // Start the round
    await roundManager.startRound('round-robin');

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

    await roundManager.startRound('round-robin');

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

    await roundManager.startRound('round-robin');

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

    await roundManagerNoShuffle.startRound('round-robin');

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

    // Start multiple rounds and verify each gets shuffled order
    await roundManager.startRound('round-robin');

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
