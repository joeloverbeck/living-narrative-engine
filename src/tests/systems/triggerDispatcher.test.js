// src/tests/systems/triggerDispatcher.test.js

import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';

// ── System Under Test ─────────────────────────────────────────────────────────
import TriggerDispatcher from '../../systems/triggerDispatcher.js';

// ── Sample trigger definition reused across cases ────────────────────────────
const TRIGGER_DEF = {
  id: 'demo:trigger_unlock_treasure_door_on_goblin_death',
  listen_to: {
    event_type: 'event:entity_died',
    filters: {
      deceasedEntityId: 'demo:enemy_goblin',
    },
  },
  effects: [
    {
      type: 'trigger_event',
      parameters: {
        eventName: 'event:unlock_entity_attempt',
        payload: {
          userId: null,
          targetEntityId: 'demo:door_treasure_room',
          keyItemId: null,
        },
      },
    },
  ],
  one_shot: true,
  enabled: true,
};

// ── Minimal mock helpers ──────────────────────────────────────────────────────
const makeMockEventBus = () => {
  const bus = {
    subscribe: jest.fn(),
    dispatch: jest.fn().mockResolvedValue(undefined),
    unsubscribe: jest.fn(),
  };
  return bus;
};

// Renamed function for clarity
const makeMockGameDataRepository = (triggersArray) => ({
  getAllTriggers: jest.fn(() => triggersArray),
  // Add mocks for other GameDataRepository methods if TriggerDispatcher starts using them
});

// EntityManager is not touched in the current TriggerDispatcher code path but
// is required by its constructor – provide the lightest stub possible.
const MOCK_ENTITY_MANAGER = {};

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('TriggerDispatcher – filter matching & one‑shot logic', () => {
  /** @type {ReturnType<typeof makeMockEventBus>} */
  let mockEventBus;
  /** @type {ReturnType<typeof makeMockGameDataRepository>} */ // Updated type hint if using JSDoc
  let mockGameDataRepository; // Renamed variable
  /** @type {TriggerDispatcher} */
  let dispatcher;
  /** Captured handler for the subscribed event */
  let subscribedHandler;

  beforeEach(() => {
    mockEventBus = makeMockEventBus();
    // Use renamed function and variable
    mockGameDataRepository = makeMockGameDataRepository([TRIGGER_DEF]);

    dispatcher = new TriggerDispatcher({
      eventBus: mockEventBus,
      // *** THE FIX: Use the correct property name 'gameDataRepository' ***
      gameDataRepository: mockGameDataRepository,
      entityManager: MOCK_ENTITY_MANAGER,
    });

    dispatcher.initialize();

    // Grab the handler that TriggerDispatcher registered for entity_died
    expect(mockEventBus.subscribe).toHaveBeenCalledTimes(1);
    [, subscribedHandler] = mockEventBus.subscribe.mock.calls[0];
    expect(typeof subscribedHandler).toBe('function');
  });

  afterEach(() => {
    dispatcher.shutdown();
    jest.clearAllMocks();
  });

  const MATCHING_EVENT = {
    deceasedEntityId: 'demo:enemy_goblin',
    someOtherField: 123,
  };

  const MISMATCH_EVENT = {
    deceasedEntityId: 'demo:enemy_orc',
  };

  // H1 – happy path
  it('dispatches the unlock event exactly once when filters match', async () => {
    await subscribedHandler(MATCHING_EVENT);

    expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);
    expect(mockEventBus.dispatch).toHaveBeenCalledWith(
      'event:unlock_entity_attempt',
      expect.objectContaining({
        triggerId: TRIGGER_DEF.id,
        // Include other expected properties based on how #handleMatch merges data
        deceasedEntityId: 'demo:enemy_goblin', // from eventData
        targetEntityId: 'demo:door_treasure_room', // from effect payload
      }),
    );
  });

  // M1 – mismatch path
  it('does not dispatch when the filters do not match', async () => {
    await subscribedHandler(MISMATCH_EVENT);

    expect(mockEventBus.dispatch).not.toHaveBeenCalled();
  });

  // O1 – one‑shot behaviour
  it('fires only once even if the matching event is received multiple times', async () => {
    await subscribedHandler(MATCHING_EVENT);
    await subscribedHandler(MATCHING_EVENT); // second identical event

    expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1); // Still expect only one call
  });
});