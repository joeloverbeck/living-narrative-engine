/**
 * @file Unit tests for gameSessionManager.js
 * @see src/engine/gameSessionManager.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import GameSessionManager from '../../../src/engine/gameSessionManager.js';
import EngineState from '../../../src/engine/engineState.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
  createMockTurnManager,
  createMockPlaytimeTracker,
} from '../../common/mockFactories/index.js';
import { ENGINE_READY_UI } from '../../../src/constants/eventIds.js';

describe('GameSessionManager', () => {
  let engineState;
  let logger;
  let turnManager;
  let playtimeTracker;
  let safeEventDispatcher;
  let stopFn;
  let resetCoreGameStateFn;
  let startEngineFn;
  let anatomyInitializationService;
  let gameSessionManager;

  beforeEach(() => {
    // Create fresh mocks for each test
    engineState = new EngineState();
    logger = createMockLogger();
    turnManager = createMockTurnManager();
    playtimeTracker = createMockPlaytimeTracker();
    safeEventDispatcher = createMockSafeEventDispatcher();
    stopFn = jest.fn().mockResolvedValue();
    resetCoreGameStateFn = jest.fn();
    startEngineFn = jest.fn((worldName) => {
      engineState.setStarted(worldName);
    });
    anatomyInitializationService = {
      getPendingGenerationCount: jest.fn().mockReturnValue(0),
      waitForAllGenerationsToComplete: jest.fn().mockResolvedValue(),
    };

    gameSessionManager = new GameSessionManager({
      logger,
      turnManager,
      playtimeTracker,
      safeEventDispatcher,
      engineState,
      stopFn,
      resetCoreGameStateFn,
      startEngineFn,
      anatomyInitializationService,
    });
  });

  describe('constructor', () => {
    it('should properly initialize with all dependencies', () => {
      // Constructor test - verify dependencies are assigned
      expect(gameSessionManager).toBeDefined();
      expect(gameSessionManager).toBeInstanceOf(GameSessionManager);
    });

    it('should function without optional anatomyInitializationService', () => {
      const managerWithoutAnatomy = new GameSessionManager({
        logger,
        turnManager,
        playtimeTracker,
        safeEventDispatcher,
        engineState,
        stopFn,
        resetCoreGameStateFn,
        startEngineFn,
        anatomyInitializationService: null,
      });

      expect(managerWithoutAnatomy).toBeDefined();
    });
  });

  describe('prepareForNewGameSession', () => {
    it('should reset state without stopping when engine is not initialized', async () => {
      // Engine not initialized (default state)
      // engineState starts as not initialized by default

      await gameSessionManager.prepareForNewGameSession('TestWorld');

      expect(logger.warn).not.toHaveBeenCalled();
      expect(stopFn).not.toHaveBeenCalled();
      expect(resetCoreGameStateFn).toHaveBeenCalledTimes(1);
      expect(engineState.activeWorld).toBe('TestWorld');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Preparing new game session for world "TestWorld"'
        )
      );
    });

    it('should warn and stop existing game when engine is already initialized', async () => {
      // Set engine as initialized (covers line 109)
      engineState.setStarted('OldWorld');

      await gameSessionManager.prepareForNewGameSession('NewWorld');

      expect(logger.warn).toHaveBeenCalledWith(
        'GameSessionManager.prepareForNewGameSession: Engine already initialized. Stopping existing game before starting new.'
      );
      expect(stopFn).toHaveBeenCalledTimes(1);
      expect(resetCoreGameStateFn).toHaveBeenCalledTimes(1);
      expect(engineState.activeWorld).toBe('NewWorld');
    });

    it('should stop game when game loop is running', async () => {
      // Set game loop as running by starting engine
      engineState.setStarted('RunningWorld');

      await gameSessionManager.prepareForNewGameSession('TestWorld');

      expect(stopFn).toHaveBeenCalledTimes(1);
      expect(resetCoreGameStateFn).toHaveBeenCalledTimes(1);
    });

    it('should reset core state and propagate errors when stopFn rejects', async () => {
      engineState.setStarted('ErrorWorld');
      const stopError = new Error('Stop failure');
      stopFn.mockRejectedValue(stopError);

      await expect(
        gameSessionManager.prepareForNewGameSession('RecoveryWorld')
      ).rejects.toThrow('Stop failure');

      expect(resetCoreGameStateFn).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        'GameSessionManager._prepareEngineForOperation: stopFn threw while stopping current session.',
        stopError
      );
    });

    it('should attach reset failures to stop errors when both operations fail', async () => {
      engineState.setStarted('ChainedWorld');
      const stopError = new Error('Stop failure');
      const resetError = new Error('Reset failure');
      stopFn.mockRejectedValue(stopError);
      resetCoreGameStateFn.mockImplementation(() => {
        throw resetError;
      });

      await expect(
        gameSessionManager.prepareForNewGameSession('ChainedWorld')
      ).rejects.toBe(stopError);

      expect(logger.error).toHaveBeenCalledWith(
        'GameSessionManager._prepareEngineForOperation: stopFn threw while stopping current session.',
        stopError
      );
      expect(logger.error).toHaveBeenCalledWith(
        'GameSessionManager._prepareEngineForOperation: resetCoreGameStateFn threw while clearing core state.',
        resetError
      );
      expect(stopError.cause).toBe(resetError);
    });

    it('should append additional reset errors when the failure already tracks an array', async () => {
      engineState.setStarted('ArrayWorld');
      const stopError = new Error('Stop failure');
      stopError.cause = { existing: true };
      const existingResetError = new Error('Existing reset error');
      stopError.resetErrors = [existingResetError];
      const resetError = new Error('Reset failure');
      stopFn.mockRejectedValue(stopError);
      resetCoreGameStateFn.mockImplementation(() => {
        throw resetError;
      });

      await expect(
        gameSessionManager.prepareForNewGameSession('ArrayWorld')
      ).rejects.toBe(stopError);

      expect(stopError.resetErrors).toHaveLength(2);
      expect(stopError.resetErrors).toContain(resetError);
      expect(stopError.resetErrors).toContain(existingResetError);
    });

    it('should convert existing reset error metadata into an array when augmenting failure details', async () => {
      engineState.setStarted('ConversionWorld');
      const stopError = new Error('Stop failure');
      stopError.cause = { existing: true };
      stopError.resetErrors = 'previous reset';
      const resetError = new Error('Reset failure');
      stopFn.mockRejectedValue(stopError);
      resetCoreGameStateFn.mockImplementation(() => {
        throw resetError;
      });

      await expect(
        gameSessionManager.prepareForNewGameSession('ConversionWorld')
      ).rejects.toBe(stopError);

      expect(Array.isArray(stopError.resetErrors)).toBe(true);
      expect(stopError.resetErrors).toEqual(['previous reset', resetError]);
    });

    it('should recover when enriching failure metadata initially throws', async () => {
      engineState.setStarted('SetterWorld');
      const stopError = new Error('Stop failure');
      let causeSetterCalls = 0;
      Object.defineProperty(stopError, 'cause', {
        configurable: true,
        enumerable: true,
        get() {
          return this._cause;
        },
        set(value) {
          causeSetterCalls += 1;
          if (causeSetterCalls === 1) {
            throw new Error('Setter failure');
          }
          this._cause = value;
        },
      });
      const resetError = new Error('Reset failure');
      stopFn.mockRejectedValue(stopError);
      resetCoreGameStateFn.mockImplementation(() => {
        throw resetError;
      });

      await expect(
        gameSessionManager.prepareForNewGameSession('SetterWorld')
      ).rejects.toBe(stopError);

      expect(stopError.resetErrors).toEqual([resetError]);
    });

    it('should log and rethrow when resetCoreGameStateFn throws without prior failures', async () => {
      const resetErrorMessage = 'Reset failure';
      resetCoreGameStateFn.mockImplementation(() => {
        throw resetErrorMessage;
      });

      await expect(
        gameSessionManager.prepareForNewGameSession('UnluckyWorld')
      ).rejects.toThrow(resetErrorMessage);

      const errorLogCall = logger.error.mock.calls.find(([message]) =>
        message.includes(
          'GameSessionManager._prepareEngineForOperation: resetCoreGameStateFn threw while clearing core state.'
        )
      );
      expect(errorLogCall).toBeDefined();
      const [, capturedError] = errorLogCall;

      expect(capturedError).toBeInstanceOf(Error);
      expect(capturedError.message).toBe(resetErrorMessage);
    });
  });

  describe('finalizeNewGameSuccess', () => {
    it('should start all services and dispatch ready event', async () => {
      await gameSessionManager.finalizeNewGameSuccess('NewWorld');

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Initialization successful for world "NewWorld"'
        )
      );
      expect(startEngineFn).toHaveBeenCalledWith('NewWorld');
      expect(engineState.isInitialized).toBe(true);
      expect(engineState.activeWorld).toBe('NewWorld');
      expect(playtimeTracker.startSession).toHaveBeenCalledTimes(1);
      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_READY_UI,
        {
          activeWorld: 'NewWorld',
          message: 'Enter command...',
        }
      );
      expect(turnManager.start).toHaveBeenCalledTimes(1);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('New game started and ready (World: NewWorld)')
      );
    });

    it('should warn when ready UI dispatch fails', async () => {
      safeEventDispatcher.dispatch
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);

      await gameSessionManager.finalizeNewGameSuccess('NewWorld');

      expect(logger.warn).toHaveBeenCalledWith(
        'GameSessionManager._finalizeGameStart: SafeEventDispatcher reported failure when dispatching ENGINE_READY_UI.'
      );
    });

    it('should handle missing playtimeTracker gracefully', async () => {
      // Create manager without playtimeTracker
      const managerWithoutTracker = new GameSessionManager({
        logger,
        turnManager,
        playtimeTracker: null,
        safeEventDispatcher,
        engineState,
        stopFn,
        resetCoreGameStateFn,
        startEngineFn,
        anatomyInitializationService,
      });

      await managerWithoutTracker.finalizeNewGameSuccess('NewWorld');

      expect(logger.warn).toHaveBeenCalledWith(
        'GameSessionManager._finalizeGameStart: PlaytimeTracker not available, cannot start session.'
      );
      expect(turnManager.start).toHaveBeenCalledTimes(1);
    });

    it('should throw error when turnManager is not available', async () => {
      // Create manager without turnManager (covers lines 185-188)
      const managerWithoutTurnManager = new GameSessionManager({
        logger,
        turnManager: null,
        playtimeTracker,
        safeEventDispatcher,
        engineState,
        stopFn,
        resetCoreGameStateFn,
        startEngineFn,
        anatomyInitializationService,
      });

      await expect(
        managerWithoutTurnManager.finalizeNewGameSuccess('NewWorld')
      ).rejects.toThrow(
        'GameSessionManager critical error: TurnManager service is unavailable during game finalization.'
      );

      expect(logger.error).toHaveBeenCalledWith(
        'GameSessionManager._finalizeGameStart: TurnManager not available. Game cannot start turns.'
      );
    });

    it('should rollback engine state when turnManager.start fails', async () => {
      const turnFailure = new Error('Turn start failed');
      turnManager.start.mockRejectedValue(turnFailure);

      await expect(
        gameSessionManager.finalizeNewGameSuccess('NewWorld')
      ).rejects.toThrow(turnFailure);

      expect(playtimeTracker.endSessionAndAccumulate).toHaveBeenCalledTimes(1);
      expect(resetCoreGameStateFn).toHaveBeenCalledTimes(1);
      expect(engineState.isInitialized).toBe(false);
      expect(engineState.isGameLoopRunning).toBe(false);
      expect(engineState.activeWorld).toBeNull();
    });

    it('should wait for pending anatomy generations before starting turns', async () => {
      // Set up pending anatomy generations (covers lines 150-161)
      anatomyInitializationService.getPendingGenerationCount.mockReturnValue(3);

      await gameSessionManager.finalizeNewGameSuccess('NewWorld');

      expect(logger.info).toHaveBeenCalledWith(
        'GameSessionManager._finalizeGameStart: Waiting for 3 anatomy generations to complete before starting turns...'
      );
      expect(
        anatomyInitializationService.waitForAllGenerationsToComplete
      ).toHaveBeenCalledWith(15000);
      expect(logger.info).toHaveBeenCalledWith(
        'GameSessionManager._finalizeGameStart: Anatomy generation completed, starting turns.'
      );
      expect(turnManager.start).toHaveBeenCalledTimes(1);
    });

    it('should handle anatomy generation timeout gracefully', async () => {
      // Set up anatomy generation that times out (covers lines 162-167)
      anatomyInitializationService.getPendingGenerationCount.mockReturnValue(2);
      anatomyInitializationService.waitForAllGenerationsToComplete.mockRejectedValue(
        new Error('Timeout waiting for anatomy generation')
      );

      await gameSessionManager.finalizeNewGameSuccess('NewWorld');

      expect(logger.warn).toHaveBeenCalledWith(
        'GameSessionManager._finalizeGameStart: Anatomy generation did not complete in time, starting turns anyway.',
        {
          error: 'Timeout waiting for anatomy generation',
          pendingCount: 2,
        }
      );
      expect(turnManager.start).toHaveBeenCalledTimes(1);
    });

    it('should normalize non-Error anatomy generation failures when logging', async () => {
      anatomyInitializationService.getPendingGenerationCount.mockReturnValue(1);
      anatomyInitializationService.waitForAllGenerationsToComplete.mockRejectedValue(
        '  anatomy service stalled  '
      );

      await gameSessionManager.finalizeNewGameSuccess('NewWorld');

      expect(logger.warn).toHaveBeenCalledWith(
        'GameSessionManager._finalizeGameStart: Anatomy generation did not complete in time, starting turns anyway.',
        {
          error: 'anatomy service stalled',
          pendingCount: 1,
        }
      );
      expect(turnManager.start).toHaveBeenCalledTimes(1);
    });

    it('should normalize rollback errors when cleanup helpers fail during start failure recovery', async () => {
      playtimeTracker.endSessionAndAccumulate.mockImplementation(() => {
        throw 'tracker panic';
      });
      resetCoreGameStateFn.mockImplementation(() => {
        throw 'reset panic';
      });
      turnManager.start.mockRejectedValue(new Error('Turn start failed'));

      await expect(
        gameSessionManager.finalizeNewGameSuccess('NewWorld')
      ).rejects.toThrow('Turn start failed');

      const trackerLogCall = logger.error.mock.calls.find(([message]) =>
        message.includes(
          'GameSessionManager._finalizeGameStart: Failed to rollback playtime session after start failure.'
        )
      );
      expect(trackerLogCall).toBeDefined();
      expect(trackerLogCall[1]).toBeInstanceOf(Error);
      expect(trackerLogCall[1].message).toBe('tracker panic');

      const resetLogCall = logger.error.mock.calls.find(([message]) =>
        message.includes(
          'GameSessionManager._finalizeGameStart: Failed to reset core game state after start failure.'
        )
      );
      expect(resetLogCall).toBeDefined();
      expect(resetLogCall[1]).toBeInstanceOf(Error);
      expect(resetLogCall[1].message).toBe('reset panic');
    });

    it('should skip anatomy wait when no generations are pending', async () => {
      // No pending generations (covers lines 168-169)
      anatomyInitializationService.getPendingGenerationCount.mockReturnValue(0);

      await gameSessionManager.finalizeNewGameSuccess('NewWorld');

      expect(logger.debug).toHaveBeenCalledWith(
        'GameSessionManager._finalizeGameStart: No pending anatomy generations detected.'
      );
      expect(
        anatomyInitializationService.waitForAllGenerationsToComplete
      ).not.toHaveBeenCalled();
      expect(turnManager.start).toHaveBeenCalledTimes(1);
    });

    it('should handle missing anatomyInitializationService', async () => {
      // Create manager without anatomyInitializationService
      const managerWithoutAnatomy = new GameSessionManager({
        logger,
        turnManager,
        playtimeTracker,
        safeEventDispatcher,
        engineState,
        stopFn,
        resetCoreGameStateFn,
        startEngineFn,
        anatomyInitializationService: null,
      });

      await managerWithoutAnatomy.finalizeNewGameSuccess('NewWorld');

      expect(logger.warn).toHaveBeenCalledWith(
        'GameSessionManager._finalizeGameStart: AnatomyInitializationService not available, cannot wait for anatomy generation.'
      );
      expect(turnManager.start).toHaveBeenCalledTimes(1);
    });
  });

  describe('private method coverage via public methods', () => {
    it('should handle both isInitialized and isGameLoopRunning states', async () => {
      // Test when both conditions are true (line 88)
      engineState.setStarted('BothStatesWorld');

      await gameSessionManager.prepareForNewGameSession('TestWorld');

      expect(stopFn).toHaveBeenCalledTimes(1);
      expect(resetCoreGameStateFn).toHaveBeenCalledTimes(1);
    });
  });
});
