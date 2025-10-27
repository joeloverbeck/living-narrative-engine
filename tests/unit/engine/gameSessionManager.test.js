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
import {
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_READY_UI,
} from '../../../src/constants/eventIds.js';

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

  describe('prepareForLoadGameSession', () => {
    it('should dispatch loading UI event with short save name', async () => {
      const saveIdentifier = 'path/to/MySave.sav';

      await gameSessionManager.prepareForLoadGameSession(saveIdentifier);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Preparing to load game from identifier: path/to/MySave.sav'
        )
      );
      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_IN_PROGRESS_UI,
        {
          titleMessage: 'Loading MySave...',
          inputDisabledMessage: 'Loading game from MySave...',
        }
      );
      expect(resetCoreGameStateFn).toHaveBeenCalledTimes(1);
    });

    it('should handle Windows-style paths correctly', async () => {
      const saveIdentifier = 'C:\\Users\\Player\\Saves\\GameSave.sav';

      await gameSessionManager.prepareForLoadGameSession(saveIdentifier);

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_IN_PROGRESS_UI,
        {
          titleMessage: 'Loading GameSave...',
          inputDisabledMessage: 'Loading game from GameSave...',
        }
      );
    });

    it('should ignore trailing separators when deriving the save name', async () => {
      const saveIdentifier = 'C\\\\Users\\\\Player\\\\Saves\\\\';

      await gameSessionManager.prepareForLoadGameSession(saveIdentifier);

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_IN_PROGRESS_UI,
        {
          titleMessage: 'Loading Saves...',
          inputDisabledMessage: 'Loading game from Saves...',
        }
      );
    });

    it('should handle save identifier without path separators', async () => {
      const saveIdentifier = 'QuickSave';

      await gameSessionManager.prepareForLoadGameSession(saveIdentifier);

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_IN_PROGRESS_UI,
        {
          titleMessage: 'Loading QuickSave...',
          inputDisabledMessage: 'Loading game from QuickSave...',
        }
      );
    });

    it('should fall back to a default name when identifier is blank or missing', async () => {
      await gameSessionManager.prepareForLoadGameSession('   ');

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_IN_PROGRESS_UI,
        {
          titleMessage: 'Loading Saved Game...',
          inputDisabledMessage: 'Loading game from Saved Game...',
        }
      );
    });

    it('should stop engine if initialized before loading', async () => {
      engineState.setStarted('CurrentWorld');

      await gameSessionManager.prepareForLoadGameSession('save.sav');

      expect(stopFn).toHaveBeenCalledTimes(1);
      expect(resetCoreGameStateFn).toHaveBeenCalledTimes(1);
    });

    it('should handle empty string save identifier edge case', async () => {
      // This covers the edge case where split().pop() might return empty string
      const saveIdentifier = '';

      await gameSessionManager.prepareForLoadGameSession(saveIdentifier);

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_IN_PROGRESS_UI,
        {
          titleMessage: 'Loading Saved Game...',
          inputDisabledMessage: 'Loading game from Saved Game...',
        }
      );
    });

    it('should ignore dot-only path segments when deriving display names', async () => {
      safeEventDispatcher.dispatch.mockClear();

      await gameSessionManager.prepareForLoadGameSession('../..');

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_IN_PROGRESS_UI,
        {
          titleMessage: 'Loading Saved Game...',
          inputDisabledMessage: 'Loading game from Saved Game...',
        }
      );
    });

    it('should convert manual save filenames into readable titles', async () => {
      const manualIdentifier =
        'saves/manual_saves/manual_save_Galactic_Quest.sav';

      await gameSessionManager.prepareForLoadGameSession(manualIdentifier);

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_IN_PROGRESS_UI,
        {
          titleMessage: 'Loading Galactic Quest...',
          inputDisabledMessage: 'Loading game from Galactic Quest...',
        }
      );
    });

    it('should treat manual saves with empty filenames as generic saved games', async () => {
      const manualIdentifier = 'saves/manual_saves/manual_save_.sav';

      await gameSessionManager.prepareForLoadGameSession(manualIdentifier);

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_IN_PROGRESS_UI,
        {
          titleMessage: 'Loading Saved Game...',
          inputDisabledMessage: 'Loading game from Saved Game...',
        }
      );
    });

    it('should decode percent-encoded save identifiers for UI messaging', async () => {
      const encodedIdentifier =
        'saves/manual_saves/manual_save_My%20Adventure%20Slot%201.sav';

      await gameSessionManager.prepareForLoadGameSession(encodedIdentifier);

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_IN_PROGRESS_UI,
        {
          titleMessage: 'Loading My Adventure Slot 1...',
          inputDisabledMessage: 'Loading game from My Adventure Slot 1...',
        }
      );
    });

    it('should await core game reset before dispatching UI events', async () => {
      let resetCompleted = false;
      resetCoreGameStateFn.mockImplementation(async () => {
        await new Promise((resolve) =>
          setTimeout(() => {
            resetCompleted = true;
            resolve();
          }, 0)
        );
      });

      safeEventDispatcher.dispatch.mockImplementation(async () => {
        expect(resetCompleted).toBe(true);
      });

      await gameSessionManager.prepareForLoadGameSession('delayed.sav');

      expect(resetCoreGameStateFn).toHaveBeenCalledTimes(1);
      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_IN_PROGRESS_UI,
        expect.any(Object)
      );
    });

    it('should warn when dispatching the loading UI event fails', async () => {
      safeEventDispatcher.dispatch.mockResolvedValue(false);

      await gameSessionManager.prepareForLoadGameSession('slot-9');

      expect(logger.warn).toHaveBeenCalledWith(
        'GameSessionManager._prepareEngineForOperation: SafeEventDispatcher reported failure when dispatching core:ui_operation_in_progress.'
      );
    });

    it('should log and continue when the loading UI dispatch throws', async () => {
      const dispatchError = new Error('Dispatch failed');
      safeEventDispatcher.dispatch.mockRejectedValueOnce(dispatchError);

      await expect(
        gameSessionManager.prepareForLoadGameSession('slot-13')
      ).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith(
        'GameSessionManager._prepareEngineForOperation: SafeEventDispatcher threw when dispatching core:ui_operation_in_progress. Error: Dispatch failed',
        dispatchError
      );
      expect(resetCoreGameStateFn).toHaveBeenCalledTimes(1);
    });

    it('should derive a fallback name when manual save segments normalize to empty strings', async () => {
      await gameSessionManager.prepareForLoadGameSession(
        'manual_save_.sav/manual_save_.sav'
      );

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_IN_PROGRESS_UI,
        {
          titleMessage: 'Loading .savmanual save...',
          inputDisabledMessage: 'Loading game from .savmanual save...',
        }
      );
    });

    it('should preserve underscore-only identifiers after normalization', async () => {
      await gameSessionManager.prepareForLoadGameSession('__');

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_IN_PROGRESS_UI,
        {
          titleMessage: 'Loading __...',
          inputDisabledMessage: 'Loading game from __...',
        }
      );
    });

    it('should treat whitespace-only fallback identifiers as missing', async () => {
      await gameSessionManager.prepareForLoadGameSession(' /   / ');

      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_OPERATION_IN_PROGRESS_UI,
        {
          titleMessage: 'Loading Saved Game...',
          inputDisabledMessage: 'Loading game from Saved Game...',
        }
      );
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

  describe('finalizeLoadSuccess', () => {
    it('should restore game state from save data with metadata', async () => {
      const saveData = {
        metadata: { gameTitle: 'SavedWorld' },
        entities: [],
        gameState: {},
      };

      const result = await gameSessionManager.finalizeLoadSuccess(
        saveData,
        'save1.sav'
      );

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Game state restored successfully from save1.sav'
        )
      );
      expect(engineState.activeWorld).toBe('SavedWorld');
      expect(startEngineFn).toHaveBeenCalledWith('SavedWorld');
      expect(safeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENGINE_READY_UI,
        {
          activeWorld: 'SavedWorld',
          message: 'Enter command...',
        }
      );
      expect(turnManager.start).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        success: true,
        data: saveData,
      });
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'Game loaded from "save1.sav" (World: SavedWorld) and resumed.'
        )
      );
    });

    it('should trim whitespace from metadata gameTitle before use', async () => {
      const saveData = {
        metadata: { gameTitle: '  Trimmed World  ' },
        entities: [],
        gameState: {},
      };

      await gameSessionManager.finalizeLoadSuccess(saveData, 'trim.sav');

      expect(engineState.activeWorld).toBe('Trimmed World');
      expect(startEngineFn).toHaveBeenCalledWith('Trimmed World');
    });

    it('should fall back to the save identifier when metadata is missing', async () => {
      const saveData = {
        entities: [],
        gameState: {},
      };

      const result = await gameSessionManager.finalizeLoadSuccess(
        saveData,
        'quicksave'
      );

      expect(engineState.activeWorld).toBe('quicksave');
      expect(startEngineFn).toHaveBeenCalledWith('quicksave');
      expect(result).toEqual({
        success: true,
        data: saveData,
      });
    });

    it('should handle save data with empty gameTitle', async () => {
      const saveData = {
        metadata: { gameTitle: '' },
        entities: [],
      };

      const result = await gameSessionManager.finalizeLoadSuccess(
        saveData,
        'autosave'
      );

      expect(engineState.activeWorld).toBe('autosave');
      expect(startEngineFn).toHaveBeenCalledWith('autosave');
      expect(result.success).toBe(true);
    });

    it('should treat whitespace-only gameTitle as missing', async () => {
      const saveData = {
        metadata: { gameTitle: '   ' },
        entities: [],
      };

      const result = await gameSessionManager.finalizeLoadSuccess(
        saveData,
        'whitespace'
      );

      expect(engineState.activeWorld).toBe('whitespace');
      expect(startEngineFn).toHaveBeenCalledWith('whitespace');
      expect(result.success).toBe(true);
    });

    it('should fall back to a generic label when the identifier is unusable', async () => {
      const saveData = {
        metadata: {},
        entities: [],
      };

      const result = await gameSessionManager.finalizeLoadSuccess(
        saveData,
        '../..'
      );

      expect(engineState.activeWorld).toBe('Restored Game');
      expect(startEngineFn).toHaveBeenCalledWith('Restored Game');
      expect(result.success).toBe(true);
    });

    it('should use metadata worldName when gameTitle is missing', async () => {
      const saveData = {
        metadata: { gameTitle: '', worldName: 'Canonical World' },
        entities: [],
      };

      const result = await gameSessionManager.finalizeLoadSuccess(
        saveData,
        'slot-world'
      );

      expect(engineState.activeWorld).toBe('Canonical World');
      expect(startEngineFn).toHaveBeenCalledWith('Canonical World');
      expect(result.success).toBe(true);
    });

    it('should use metadata saveName when gameTitle is missing', async () => {
      const saveData = {
        metadata: { gameTitle: '', saveName: 'Slot 3' },
        entities: [],
        gameState: {},
      };

      const result = await gameSessionManager.finalizeLoadSuccess(
        saveData,
        'slot-3'
      );

      expect(engineState.activeWorld).toBe('Slot 3');
      expect(startEngineFn).toHaveBeenCalledWith('Slot 3');
      expect(result.success).toBe(true);
    });
  });

  describe('private method coverage via public methods', () => {
    it('should dispatch UI event when provided to _prepareEngineForOperation', async () => {
      // This tests the UI event dispatching branch (lines 94-97)
      await gameSessionManager.prepareForLoadGameSession('test.sav');

      expect(logger.debug).toHaveBeenCalledWith(
        'GameSessionManager._prepareEngineForOperation: Dispatching UI event.'
      );
      expect(safeEventDispatcher.dispatch).toHaveBeenCalledTimes(1);
    });

    it('should handle both isInitialized and isGameLoopRunning states', async () => {
      // Test when both conditions are true (line 88)
      engineState.setStarted('BothStatesWorld');

      await gameSessionManager.prepareForNewGameSession('TestWorld');

      expect(stopFn).toHaveBeenCalledTimes(1);
      expect(resetCoreGameStateFn).toHaveBeenCalledTimes(1);
    });
  });
});
