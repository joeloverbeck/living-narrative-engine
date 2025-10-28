import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import RoundManager from '../../../src/turns/roundManager.js';
import { createTurnManagerTestBed } from '../../common/turns/turnManagerTestBed.js';
import { triggerTurnEndedAndFlush } from '../../common/turns/turnManagerTestUtils.js';
import { createAiActor } from '../../common/turns/testActors.js';

// --- FILE START ---

const microtaskScheduler = (() => {
  let nextId = 1;
  const tasks = new Map();
  return {
    setTimeout(callback) {
      const id = nextId++;
      tasks.set(id, callback);
      Promise.resolve().then(() => {
        const task = tasks.get(id);
        if (task) {
          tasks.delete(id);
          task();
        }
      });
      return id;
    },
    clearTimeout(id) {
      tasks.delete(id);
    },
  };
})();

describe('TurnManager - legacy success flag interpretation', () => {
  /** @type {import('../../common/turns/turnManagerTestBed.js').TurnManagerTestBed} */
  let testBed;
  /** @type {jest.SpiedFunction<RoundManager['endTurn']>} */
  let endTurnSpy;

  beforeEach(() => {
    jest.useRealTimers();
    testBed = createTurnManagerTestBed({
      turnManagerOptions: { scheduler: microtaskScheduler },
    });
    testBed.initializeDefaultMocks();
    endTurnSpy = jest.spyOn(RoundManager.prototype, 'endTurn');
  });

  afterEach(async () => {
    endTurnSpy.mockRestore();
    await testBed.cleanup();
  });

  const startManagerFor = async (actorId) => {
    const actor = createAiActor(actorId);
    testBed.setActiveEntities(actor);
    testBed.mockNextActor(actor);
    const handler = testBed.setupHandlerForActor(actor);
    handler.startTurn.mockResolvedValue();

    await testBed.turnManager.start();
    endTurnSpy.mockClear();
    testBed.mocks.logger.warn.mockClear();

    return actor;
  };

  test('treats string "true" success flag as successful', async () => {
    const actor = await startManagerFor('actor-string-true');

    await triggerTurnEndedAndFlush(testBed, actor.id, 'true');

    expect(endTurnSpy).toHaveBeenCalledTimes(1);
    expect(endTurnSpy).toHaveBeenCalledWith(true);
    expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('string success flag ("true")'),
      expect.objectContaining({ receivedType: 'string' })
    );
  });

  test('treats string "false" success flag as failure', async () => {
    const actor = await startManagerFor('actor-string-false');

    await triggerTurnEndedAndFlush(testBed, actor.id, 'false');

    expect(endTurnSpy).not.toHaveBeenCalled();
    expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('string success flag ("false")'),
      expect.objectContaining({ receivedType: 'string' })
    );
  });

  test('treats unrecognised string success flag as failure', async () => {
    const actor = await startManagerFor('actor-string-unknown');

    await triggerTurnEndedAndFlush(testBed, actor.id, 'nope');

    expect(endTurnSpy).not.toHaveBeenCalled();
    expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('unrecognised string success flag ("nope")'),
      expect.objectContaining({ receivedType: 'string' })
    );
  });

  test('treats numeric success flags of 1/0 as boolean equivalents', async () => {
    const actor = await startManagerFor('actor-number-flags');

    await triggerTurnEndedAndFlush(testBed, actor.id, 1);

    expect(endTurnSpy).toHaveBeenCalledTimes(1);
    expect(endTurnSpy).toHaveBeenCalledWith(true);
    expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('numeric success flag (1)'),
      expect.objectContaining({ receivedType: 'number' })
    );

    endTurnSpy.mockClear();
    testBed.mocks.logger.warn.mockClear();

    await triggerTurnEndedAndFlush(testBed, actor.id, 0);

    expect(endTurnSpy).not.toHaveBeenCalled();
    expect(testBed.mocks.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('numeric success flag (0)'),
      expect.objectContaining({ receivedType: 'number' })
    );
  });
});

// --- FILE END ---
