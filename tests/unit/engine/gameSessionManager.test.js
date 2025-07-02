import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GameSessionManager from '../../../src/engine/gameSessionManager.js';
import EngineState from '../../../src/engine/engineState.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
  createMockTurnManager,
  createMockPlaytimeTracker,
} from '../../common/mockFactories';
import {
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_READY_UI,
} from '../../../src/constants/eventIds.js';

/**
 * Helper to build a GameSessionManager with fresh mocks.
 *
 * @param {EngineState} state
 */
function buildManager(state) {
  const logger = createMockLogger();
  const dispatcher = createMockSafeEventDispatcher();
  const turnManager = createMockTurnManager();
  const playtimeTracker = createMockPlaytimeTracker();
  const stopFn = jest.fn().mockResolvedValue();
  const resetCoreGameStateFn = jest.fn();
  const startEngineFn = jest.fn((world) => state.setStarted(world));

  const manager = new GameSessionManager({
    logger,
    turnManager,
    playtimeTracker,
    safeEventDispatcher: dispatcher,
    engineState: state,
    stopFn,
    resetCoreGameStateFn,
    startEngineFn,
  });

  return {
    manager,
    state,
    logger,
    dispatcher,
    turnManager,
    playtimeTracker,
    stopFn,
    resetCoreGameStateFn,
    startEngineFn,
  };
}

describe('GameSessionManager', () => {
  describe('prepareForNewGameSession', () => {
    /** @type {ReturnType<typeof buildManager>} */
    let env;

    beforeEach(() => {
      const state = new EngineState();
      state.setStarted('OldWorld');
      env = buildManager(state);
    });

    it('stops the existing session and warns when engine already initialized', async () => {
      await env.manager.prepareForNewGameSession('NewWorld');

      expect(env.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Engine already initialized')
      );
      expect(env.stopFn).toHaveBeenCalledTimes(1);
      expect(env.resetCoreGameStateFn).toHaveBeenCalledTimes(1);
      expect(env.dispatcher.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('_prepareEngineForOperation via prepareForLoadGameSession', () => {
    /** @type {ReturnType<typeof buildManager>} */
    let env;

    beforeEach(() => {
      env = buildManager(new EngineState());
    });

    it('dispatches loading UI event and resets state', async () => {
      await env.manager.prepareForLoadGameSession('path/to/MySave.sav');

      expect(env.stopFn).not.toHaveBeenCalled();
      expect(env.resetCoreGameStateFn).toHaveBeenCalledTimes(1);
      expect(env.dispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_IN_PROGRESS_UI,
        {
          titleMessage: 'Loading MySave.sav...',
          inputDisabledMessage: 'Loading game from MySave.sav...',
        }
      );
    });
  });

  describe('finalizeNewGameSuccess and finalizeLoadSuccess', () => {
    /** @type {ReturnType<typeof buildManager>} */
    let env;

    beforeEach(() => {
      env = buildManager(new EngineState());
    });

    it('finalizeNewGameSuccess starts services and dispatches ready event', async () => {
      await env.manager.finalizeNewGameSuccess('WorldA');

      expect(env.startEngineFn).toHaveBeenCalledWith('WorldA');
      expect(env.playtimeTracker.startSession).toHaveBeenCalled();
      expect(env.dispatcher.dispatch).toHaveBeenCalledWith(ENGINE_READY_UI, {
        activeWorld: 'WorldA',
        message: 'Enter command...',
      });
      expect(env.turnManager.start).toHaveBeenCalled();
      expect(env.state.activeWorld).toBe('WorldA');
    });

    it('finalizeLoadSuccess sets world from save and returns data', async () => {
      const saveData = { metadata: { gameTitle: 'LoadedWorld' } };

      const result = await env.manager.finalizeLoadSuccess(saveData, 'save1');

      expect(env.startEngineFn).toHaveBeenCalledWith('LoadedWorld');
      expect(env.dispatcher.dispatch).toHaveBeenCalledWith(ENGINE_READY_UI, {
        activeWorld: 'LoadedWorld',
        message: 'Enter command...',
      });
      expect(env.turnManager.start).toHaveBeenCalled();
      expect(env.state.activeWorld).toBe('LoadedWorld');
      expect(result).toEqual({ success: true, data: saveData });
    });
  });
});
