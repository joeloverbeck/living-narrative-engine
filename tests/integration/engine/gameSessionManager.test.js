import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GameSessionManager from '../../../src/engine/gameSessionManager.js';
import EngineState from '../../../src/engine/engineState.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
  createMockTurnManager,
  createMockPlaytimeTracker,
} from '../../common/mockFactories';
import { ENGINE_READY_UI } from '../../../src/constants/eventIds.js';

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
  const anatomyInitializationService = {
    getPendingGenerationCount: jest.fn().mockReturnValue(0),
    waitForAllGenerationsToComplete: jest.fn().mockResolvedValue(),
  };

  const manager = new GameSessionManager({
    logger,
    turnManager,
    playtimeTracker,
    safeEventDispatcher: dispatcher,
    engineState: state,
    stopFn,
    resetCoreGameStateFn,
    startEngineFn,
    anatomyInitializationService,
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

  describe('finalizeNewGameSuccess', () => {
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
  });
});
