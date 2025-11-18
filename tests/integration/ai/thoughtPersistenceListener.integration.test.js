import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { ThoughtPersistenceListener } from '../../../src/ai/thoughtPersistenceListener.js';
import { EntityManagerTestBed } from '../../common/entities/entityManagerTestBed.js';
import { SHORT_TERM_MEMORY_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import * as thoughtPersistenceHook from '../../../src/ai/thoughtPersistenceHook.js';

const ACTOR_ID = 'actor-listener';

describe('ThoughtPersistenceListener integration with real services', () => {
  /** @type {EntityManagerTestBed} */
  let testBed;
  /** @type {{ debug: jest.Mock, warn: jest.Mock, error: jest.Mock, info: jest.Mock }} */
  let logger;
  /** @type {{ dispatch: jest.Mock }} */
  let dispatcher;
  /** @type {ThoughtPersistenceListener} */
  let listener;
  /** @type {Date} */
  let now;

  beforeEach(() => {
    testBed = new EntityManagerTestBed();
    logger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
    dispatcher = { dispatch: jest.fn() };
    now = new Date('2025-01-01T10:00:00.000Z');
    listener = new ThoughtPersistenceListener({
      logger,
      entityManager: testBed.entityManager,
      dispatcher,
      now: () => now,
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
    jest.restoreAllMocks();
  });

  /**
   *
   * @param overrides
   */
  async function createActor(overrides = {}) {
    return await testBed.createActorEntity({
      instanceId: ACTOR_ID,
      overrides: {
        [SHORT_TERM_MEMORY_COMPONENT_ID]: {
          thoughts: [],
          maxEntries: 3,
          ...overrides,
        },
      },
    });
  }

  it('persists trimmed thoughts into short-term memory using real services', async () => {
    const actor = await createActor({
      thoughts: [
        { text: 'existing thought', timestamp: '2024-12-31T23:50:00.000Z' },
      ],
    });

    listener.handleEvent({
      type: 'ACTION_DECIDED',
      payload: {
        actorId: actor.id,
        extractedData: { thoughts: '   Fresh perspective   ' },
      },
    });

    const memory = actor.getComponentData(SHORT_TERM_MEMORY_COMPONENT_ID);
    expect(memory.thoughts).toHaveLength(2);
    expect(memory.thoughts.at(-1)).toEqual({
      text: 'Fresh perspective',
      timestamp: now.toISOString(),
    });
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('event received')
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(`Persisting thoughts for ${actor.id}`)
    );
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Fresh perspective')
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('dispatches a system error when blank thoughts are produced', async () => {
    const actor = await createActor();

    listener.handleEvent({
      type: 'ACTION_DECIDED',
      payload: {
        actorId: actor.id,
        extractedData: { thoughts: '   ' },
      },
    });

    const memory = actor.getComponentData(SHORT_TERM_MEMORY_COMPONENT_ID);
    expect(memory.thoughts).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith('STM-001 Missing thoughts');
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('thoughts'),
        details: expect.objectContaining({ actorId: actor.id }),
      })
    );
  });

  it('logs a warning when the entity cannot be located', () => {
    const persistSpy = jest.spyOn(thoughtPersistenceHook, 'persistThoughts');

    listener.handleEvent({
      type: 'ACTION_DECIDED',
      payload: {
        actorId: 'missing-actor',
        extractedData: { thoughts: 'Should never persist' },
      },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'ThoughtPersistenceListener: entity not found for actor missing-actor'
    );
    expect(persistSpy).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it('ignores events without payload or without captured thoughts', async () => {
    listener.handleEvent(null);
    expect(logger.debug).not.toHaveBeenCalled();

    const actor = await createActor();
    const getEntitySpy = jest.spyOn(testBed.entityManager, 'getEntityInstance');

    listener.handleEvent({
      type: 'ACTION_DECIDED',
      payload: { actorId: actor.id, extractedData: {} },
    });

    expect(getEntitySpy).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledTimes(1);
  });
});
