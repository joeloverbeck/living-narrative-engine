// tests/unit/engine/gameEngine.test.js

import { describe, expect, it, beforeEach } from '@jest/globals';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  ENGINE_INITIALIZING_UI,
  ENGINE_OPERATION_FAILED_UI,
  ENGINE_STOPPED_UI,
  ENGINE_READY_UI,
  REQUEST_SHOW_SAVE_GAME_UI,
  REQUEST_SHOW_LOAD_GAME_UI,
  CANNOT_SAVE_GAME_INFO,
} from '../../../src/constants/eventIds.js';
import { describeEngineSuite } from '../../common/engine/gameEngineTestBed.js';
import { generateServiceUnavailableTests } from '../../common/engine/gameEngineHelpers.js';
import {
  DEFAULT_TEST_WORLD,
  DEFAULT_SAVE_ID,
  ENGINE_STOPPED_MESSAGE,
} from '../../common/constants.js';
import GameEngine from '../../../src/engine/gameEngine.js';
import GameSessionManager from '../../../src/engine/gameSessionManager.js';
import PersistenceCoordinator from '../../../src/engine/persistenceCoordinator.js';

describeEngineSuite('GameEngine', (context) => {
  describe('Constructor', () => {
    it('should throw when logger is not provided', () => {
      expect(() => {
        new GameEngine({ container: context.bed.env.mockContainer });
      }).toThrow('GameEngine requires a logger.');
    });

    it('should throw and log when service resolution fails', () => {
      const testBed = context.bed;
      const resolutionError = new Error('Service resolution failed');
      testBed.withTokenOverride(tokens.IEntityManager, () => {
        throw resolutionError;
      });

      expect(() => testBed.env.createInstance()).toThrow(
        'GameEngine: Failed to resolve core services. Service resolution failed'
      );

      expect(testBed.getLogger().error).toHaveBeenCalledWith(
        'GameEngine: CRITICAL - Failed to resolve one or more core services. Error: Service resolution failed',
        resolutionError
      );
    });

    it('should use provided sessionManager when passed', () => {
      const mockSessionManager = new GameSessionManager({
        logger: context.bed.getLogger(),
        turnManager: context.bed.getTurnManager(),
        playtimeTracker: context.bed.getPlaytimeTracker(),
        safeEventDispatcher: context.bed.getSafeEventDispatcher(),
        engineState: expect.any(Object),
        stopFn: expect.any(Function),
        resetCoreGameStateFn: expect.any(Function),
        startEngineFn: expect.any(Function),
      });

      const engine = new GameEngine({
        container: context.bed.env.mockContainer,
        logger: context.bed.getLogger(),
        sessionManager: mockSessionManager,
      });

      // Verify the engine was created successfully
      expect(engine).toBeDefined();
    });

    it('should use provided persistenceCoordinator when passed', () => {
      const mockPersistenceCoordinator = new PersistenceCoordinator({
        logger: context.bed.getLogger(),
        gamePersistenceService: context.bed.getGamePersistenceService(),
        safeEventDispatcher: context.bed.getSafeEventDispatcher(),
        sessionManager: expect.any(Object),
        engineState: expect.any(Object),
        handleLoadFailure: expect.any(Function),
      });

      const engine = new GameEngine({
        container: context.bed.env.mockContainer,
        logger: context.bed.getLogger(),
        persistenceCoordinator: mockPersistenceCoordinator,
      });

      // Verify the engine was created successfully
      expect(engine).toBeDefined();
    });
  });

  describe('startNewGame', () => {
    it('should throw when worldName is null', async () => {
      await expect(context.engine.startNewGame(null)).rejects.toThrow();
      expect(context.bed.getLogger().error).toHaveBeenCalledWith(
        expect.stringContaining("Invalid worldName 'null'"),
        expect.any(Object)
      );
    });

    it('should throw when worldName is empty string', async () => {
      await expect(context.engine.startNewGame('')).rejects.toThrow();
      expect(context.bed.getLogger().error).toHaveBeenCalledWith(
        expect.stringContaining("Invalid worldName ''"),
        expect.any(Object)
      );
    });

    it('should handle initialization service failure', async () => {
      const initError = new Error('Initialization failed');
      context.bed
        .getInitializationService()
        .runInitializationSequence.mockResolvedValue({
          success: false,
          error: initError,
        });

      await expect(
        context.engine.startNewGame(DEFAULT_TEST_WORLD)
      ).rejects.toThrow(initError);

      expect(context.bed.getLogger().warn).toHaveBeenCalledWith(
        `GameEngine: InitializationService reported failure for "${DEFAULT_TEST_WORLD}".`
      );
    });

    it('should handle initialization service failure with no error object', async () => {
      context.bed
        .getInitializationService()
        .runInitializationSequence.mockResolvedValue({
          success: false,
          error: null,
        });

      await expect(
        context.engine.startNewGame(DEFAULT_TEST_WORLD)
      ).rejects.toThrow('Unknown failure from InitializationService.');
    });

    it('should handle exceptions during initialization', async () => {
      const unexpectedError = new Error('Unexpected failure');
      context.bed
        .getInitializationService()
        .runInitializationSequence.mockRejectedValue(unexpectedError);

      await expect(
        context.engine.startNewGame(DEFAULT_TEST_WORLD)
      ).rejects.toThrow(unexpectedError);

      expect(context.bed.getLogger().error).toHaveBeenCalledWith(
        expect.stringContaining('Overall catch in startNewGame'),
        unexpectedError
      );
    });

    it('should handle non-Error exceptions during initialization', async () => {
      const unexpectedError = 'String error';
      context.bed
        .getInitializationService()
        .runInitializationSequence.mockRejectedValue(unexpectedError);

      await expect(
        context.engine.startNewGame(DEFAULT_TEST_WORLD)
      ).rejects.toThrow('String error');

      expect(context.bed.getLogger().error).toHaveBeenCalledWith(
        expect.stringContaining('Overall catch in startNewGame'),
        expect.any(Error)
      );
    });

    it('should treat invalid initialization results as failures with a clear error', async () => {
      context.bed
        .getInitializationService()
        .runInitializationSequence.mockResolvedValue(null);

      await expect(
        context.engine.startNewGame(DEFAULT_TEST_WORLD)
      ).rejects.toThrow('InitializationService returned an invalid result.');

      const invalidResultLog = context.bed
        .getLogger()
        .error.mock.calls.find(([message]) =>
          message.includes('InitializationService returned invalid result')
        );

      expect(invalidResultLog).toBeDefined();
      expect(invalidResultLog[1]).toMatchObject({ receivedType: 'null' });

      const failureDispatch = context.bed
        .getSafeEventDispatcher()
        .dispatch.mock.calls.find(
          ([eventName]) => eventName === ENGINE_OPERATION_FAILED_UI
        );

      expect(failureDispatch).toBeDefined();
      expect(failureDispatch[1]).toMatchObject({
        errorMessage: expect.stringContaining(
          'InitializationService returned an invalid result.'
        ),
        errorTitle: 'Initialization Error',
      });
    });

    it('should trim surrounding whitespace from world names before initialization', async () => {
      const rawWorldName = '  Aurora Station  ';
      const normalizedWorldName = 'Aurora Station';
      context.bed
        .getInitializationService()
        .runInitializationSequence.mockResolvedValue({ success: true });

      await context.engine.startNewGame(rawWorldName);

      expect(
        context.bed.getInitializationService().runInitializationSequence
      ).toHaveBeenCalledWith(normalizedWorldName);

      const status = context.engine.getEngineStatus();
      expect(status.activeWorld).toBe(normalizedWorldName);

      const readyDispatch = context.bed
        .getSafeEventDispatcher()
        .dispatch.mock.calls.find(
          ([eventName]) => eventName === ENGINE_READY_UI
        );

      expect(readyDispatch).toBeDefined();
      expect(readyDispatch[1]).toMatchObject({
        activeWorld: normalizedWorldName,
      });
    });

    it('should not dispatch failure UI twice when initialization returns a string error', async () => {
      const initError = 'Initialization failed due to string error';
      context.bed
        .getInitializationService()
        .runInitializationSequence.mockResolvedValue({
          success: false,
          error: initError,
        });

      await expect(
        context.engine.startNewGame(DEFAULT_TEST_WORLD)
      ).rejects.toThrow(initError);

      const failureDispatches = context.bed
        .getSafeEventDispatcher()
        .dispatch.mock.calls.filter(
          ([eventName]) => eventName === ENGINE_OPERATION_FAILED_UI
        );

      expect(failureDispatches).toHaveLength(1);
    });
  });

  describe('stop', () => {
    beforeEach(async () => {
      // Start the engine first
      context.bed
        .getInitializationService()
        .runInitializationSequence.mockResolvedValue({
          success: true,
        });
      await context.engine.startNewGame(DEFAULT_TEST_WORLD);
    });

    it('should handle missing playtimeTracker service', async () => {
      // Create a new engine instance without playtimeTracker
      const testBed = context.bed;
      testBed.withTokenOverride(tokens.PlaytimeTracker, null);
      const engineWithoutTracker = testBed.env.createInstance();

      // Start the engine
      testBed
        .getInitializationService()
        .runInitializationSequence.mockResolvedValue({
          success: true,
        });
      await engineWithoutTracker.startNewGame(DEFAULT_TEST_WORLD);

      // Stop the engine
      await engineWithoutTracker.stop();

      expect(testBed.getLogger().warn).toHaveBeenCalledWith(
        'GameEngine.stop: PlaytimeTracker service not available, cannot end session.'
      );

      // Verify stop event was still dispatched
      expect(testBed.getSafeEventDispatcher().dispatch).toHaveBeenCalledWith(
        ENGINE_STOPPED_UI,
        { inputDisabledMessage: ENGINE_STOPPED_MESSAGE }
      );
    });

    it('should continue shutdown when playtime tracking fails', async () => {
      const playtimeTracker = context.bed.getPlaytimeTracker();
      const entityManager = context.bed.getEntityManager();
      const trackerError = new Error('Playtime tracker failed');

      playtimeTracker.endSessionAndAccumulate.mockImplementationOnce(() => {
        throw trackerError;
      });

      playtimeTracker.reset.mockClear();
      entityManager.clearAll.mockClear();
      context.bed.getSafeEventDispatcher().dispatch.mockClear();

      await expect(context.engine.stop()).rejects.toThrow(
        'Playtime tracker failed'
      );

      expect(context.bed.getLogger().error).toHaveBeenCalledWith(
        'GameEngine.stop: Failed to end playtime session cleanly.',
        trackerError
      );
      expect(context.bed.getSafeEventDispatcher().dispatch).toHaveBeenCalledWith(
        ENGINE_STOPPED_UI,
        { inputDisabledMessage: ENGINE_STOPPED_MESSAGE }
      );
      expect(entityManager.clearAll).toHaveBeenCalledTimes(1);
      expect(playtimeTracker.reset).toHaveBeenCalledTimes(1);
      expect(context.engine.getEngineStatus()).toEqual({
        isInitialized: false,
        isLoopRunning: false,
        activeWorld: null,
      });
    });

    it('should reset engine state even when turnManager.stop fails', async () => {
      const stopError = new Error('Turn manager stop failed');
      context.bed.getTurnManager().stop.mockImplementationOnce(() => {
        throw stopError;
      });

      await expect(context.engine.stop()).rejects.toThrow(
        'Turn manager stop failed'
      );

      expect(context.bed.getLogger().error).toHaveBeenCalledWith(
        'GameEngine.stop: Encountered error while stopping engine. Engine state will be reset.',
        stopError
      );

      const status = context.engine.getEngineStatus();
      expect(status).toEqual({
        isInitialized: false,
        isLoopRunning: false,
        activeWorld: null,
      });

      expect(context.bed.getLogger().debug).toHaveBeenCalledWith(
        'GameEngine.stop: Engine fully stopped and state reset.'
      );

      expect(context.bed.getEntityManager().clearAll).toHaveBeenCalled();
      expect(context.bed.getPlaytimeTracker().reset).toHaveBeenCalled();
    });

    it('should reset state if ENGINE_STOPPED_UI dispatch rejects', async () => {
      const dispatchError = new Error('Dispatch failed');
      context.bed
        .getSafeEventDispatcher()
        .dispatch.mockRejectedValueOnce(dispatchError);

      await expect(context.engine.stop()).rejects.toThrow('Dispatch failed');

      expect(context.bed.getLogger().error).toHaveBeenCalledWith(
        'GameEngine.stop: Encountered error while stopping engine. Engine state will be reset.',
        dispatchError
      );

      const status = context.engine.getEngineStatus();
      expect(status).toEqual({
        isInitialized: false,
        isLoopRunning: false,
        activeWorld: null,
      });

      expect(context.bed.getEntityManager().clearAll).toHaveBeenCalled();
      expect(context.bed.getPlaytimeTracker().reset).toHaveBeenCalled();
    });

    it('should warn if ENGINE_STOPPED_UI dispatch reports failure', async () => {
      context.bed
        .getSafeEventDispatcher()
        .dispatch.mockResolvedValueOnce(false);

      await context.engine.stop();

      expect(context.bed.getLogger().warn).toHaveBeenCalledWith(
        'GameEngine.stop: SafeEventDispatcher reported failure when dispatching ENGINE_STOPPED_UI event.'
      );

      expect(context.engine.getEngineStatus()).toEqual({
        isInitialized: false,
        isLoopRunning: false,
        activeWorld: null,
      });
    });

    it('should clear entity manager and reset playtime tracker when stopping', async () => {
      const entityManager = context.bed.getEntityManager();
      const playtimeTracker = context.bed.getPlaytimeTracker();

      entityManager.clearAll.mockClear();
      playtimeTracker.reset.mockClear();

      await context.engine.stop();

      expect(entityManager.clearAll).toHaveBeenCalledTimes(1);
      expect(playtimeTracker.reset).toHaveBeenCalledTimes(1);
    });

    it('should not take action when engine is already stopped', async () => {
      // Stop the engine first
      await context.engine.stop();

      // Clear previous calls
      context.bed.getLogger().debug.mockClear();
      context.bed.getSafeEventDispatcher().dispatch.mockClear();

      // Try to stop again
      await context.engine.stop();

      expect(context.bed.getLogger().debug).toHaveBeenCalledWith(
        'GameEngine.stop: Engine not running or already stopped. No action taken.'
      );

      // Verify no events were dispatched
      expect(
        context.bed.getSafeEventDispatcher().dispatch
      ).not.toHaveBeenCalled();
    });
  });

  describe('loadGame', () => {
    it('should throw when saveIdentifier is null', async () => {
      await expect(context.engine.loadGame(null)).rejects.toThrow();
      expect(context.bed.getLogger().error).toHaveBeenCalledWith(
        expect.stringContaining("Invalid saveIdentifier 'null'"),
        expect.any(Object)
      );
    });

    it('should throw when saveIdentifier is empty string', async () => {
      await expect(context.engine.loadGame('')).rejects.toThrow();
      expect(context.bed.getLogger().error).toHaveBeenCalledWith(
        expect.stringContaining("Invalid saveIdentifier ''"),
        expect.any(Object)
      );
    });

    it('should delegate to persistenceCoordinator', async () => {
      const mockResult = { success: true, data: {} };

      // Create a mock persistenceCoordinator
      const mockPersistenceCoordinator = {
        loadGame: jest.fn().mockResolvedValue(mockResult),
      };

      const engine = new GameEngine({
        container: context.bed.env.mockContainer,
        logger: context.bed.getLogger(),
        persistenceCoordinator: mockPersistenceCoordinator,
      });

      const result = await engine.loadGame(DEFAULT_SAVE_ID);

      expect(mockPersistenceCoordinator.loadGame).toHaveBeenCalledWith(
        DEFAULT_SAVE_ID
      );
      expect(result).toBe(mockResult);
    });

    it('should trim surrounding whitespace from save identifiers before loading', async () => {
      const mockResult = { success: true, data: {} };
      const rawIdentifier = '   slot-42   ';
      const trimmedIdentifier = 'slot-42';

      const mockPersistenceCoordinator = {
        loadGame: jest.fn().mockResolvedValue(mockResult),
      };

      const engine = new GameEngine({
        container: context.bed.env.mockContainer,
        logger: context.bed.getLogger(),
        persistenceCoordinator: mockPersistenceCoordinator,
      });

      const result = await engine.loadGame(rawIdentifier);

      expect(mockPersistenceCoordinator.loadGame).toHaveBeenCalledWith(
        trimmedIdentifier
      );
      expect(result).toBe(mockResult);
    });

    it('should enable batch mode on the SafeEventDispatcher while loading and restore it afterwards', async () => {
      const loadResult = { success: true, data: { restored: true } };
      const mockPersistenceCoordinator = {
        loadGame: jest.fn().mockResolvedValue(loadResult),
      };

      const engine = new GameEngine({
        container: context.bed.env.mockContainer,
        logger: context.bed.getLogger(),
        persistenceCoordinator: mockPersistenceCoordinator,
      });

      const dispatcher = context.bed.getSafeEventDispatcher();

      const result = await engine.loadGame(DEFAULT_SAVE_ID);

      expect(mockPersistenceCoordinator.loadGame).toHaveBeenCalledWith(
        DEFAULT_SAVE_ID
      );
      expect(dispatcher.setBatchMode).toHaveBeenCalledTimes(2);
      expect(dispatcher.setBatchMode).toHaveBeenNthCalledWith(
        1,
        true,
        expect.objectContaining({
          context: 'game-load',
          timeoutMs: 60000,
          maxRecursionDepth: 25,
          maxGlobalRecursion: 200,
        })
      );
      expect(dispatcher.setBatchMode).toHaveBeenLastCalledWith(false);
      expect(result).toEqual(loadResult);
    });

    it('should disable batch mode even when the load operation rejects', async () => {
      const loadError = new Error('load failed');
      const mockPersistenceCoordinator = {
        loadGame: jest.fn().mockRejectedValue(loadError),
      };

      const engine = new GameEngine({
        container: context.bed.env.mockContainer,
        logger: context.bed.getLogger(),
        persistenceCoordinator: mockPersistenceCoordinator,
      });

      const dispatcher = context.bed.getSafeEventDispatcher();

      await expect(engine.loadGame(DEFAULT_SAVE_ID)).rejects.toThrow(loadError);

      expect(dispatcher.setBatchMode).toHaveBeenCalledTimes(2);
      expect(dispatcher.setBatchMode).toHaveBeenNthCalledWith(
        1,
        true,
        expect.objectContaining({ context: 'game-load' })
      );
      expect(dispatcher.setBatchMode).toHaveBeenLastCalledWith(false);
    });
  });

  describe('triggerManualSave', () => {
    it('should delegate to persistenceCoordinator', async () => {
      const mockResult = { success: true };
      const saveName = 'test-save';

      // Create a mock persistenceCoordinator
      const mockPersistenceCoordinator = {
        triggerManualSave: jest.fn().mockResolvedValue(mockResult),
      };

      const engine = new GameEngine({
        container: context.bed.env.mockContainer,
        logger: context.bed.getLogger(),
        persistenceCoordinator: mockPersistenceCoordinator,
      });

      context.bed
        .getSafeEventDispatcher()
        .dispatch.mockResolvedValue(true);
      context.bed
        .getInitializationService()
        .runInitializationSequence.mockResolvedValue({ success: true });

      await engine.startNewGame(DEFAULT_TEST_WORLD);
      const result = await engine.triggerManualSave(saveName);

      expect(mockPersistenceCoordinator.triggerManualSave).toHaveBeenCalledWith(
        saveName
      );
      expect(result).toBe(mockResult);

      context.bed.getSafeEventDispatcher().dispatch.mockReset();
      context.bed
        .getInitializationService()
        .runInitializationSequence.mockReset();
    });

    it('should trim save names before delegating to persistenceCoordinator', async () => {
      const mockResult = { success: true };
      const rawSaveName = '   trimmed-save   ';
      const trimmedSaveName = 'trimmed-save';

      const mockPersistenceCoordinator = {
        triggerManualSave: jest.fn().mockResolvedValue(mockResult),
      };

      const engine = new GameEngine({
        container: context.bed.env.mockContainer,
        logger: context.bed.getLogger(),
        persistenceCoordinator: mockPersistenceCoordinator,
      });

      context.bed
        .getSafeEventDispatcher()
        .dispatch.mockResolvedValue(true);
      context.bed
        .getInitializationService()
        .runInitializationSequence.mockResolvedValue({ success: true });

      await engine.startNewGame(DEFAULT_TEST_WORLD);
      await engine.triggerManualSave(rawSaveName);

      expect(mockPersistenceCoordinator.triggerManualSave).toHaveBeenCalledWith(
        trimmedSaveName
      );

      context.bed.getSafeEventDispatcher().dispatch.mockReset();
      context.bed
        .getInitializationService()
        .runInitializationSequence.mockReset();
    });

    it('should throw when saveName is null', async () => {
      const mockPersistenceCoordinator = {
        triggerManualSave: jest.fn(),
      };

      const engine = new GameEngine({
        container: context.bed.env.mockContainer,
        logger: context.bed.getLogger(),
        persistenceCoordinator: mockPersistenceCoordinator,
      });

      await expect(engine.triggerManualSave(null)).rejects.toThrow();

      expect(
        mockPersistenceCoordinator.triggerManualSave
      ).not.toHaveBeenCalled();
      expect(context.bed.getLogger().error).toHaveBeenCalledWith(
        expect.stringContaining("Invalid saveName 'null'"),
        expect.any(Object)
      );
    });

    it('should throw when saveName is blank', async () => {
      const mockPersistenceCoordinator = {
        triggerManualSave: jest.fn(),
      };

      const engine = new GameEngine({
        container: context.bed.env.mockContainer,
        logger: context.bed.getLogger(),
        persistenceCoordinator: mockPersistenceCoordinator,
      });

      await expect(engine.triggerManualSave('   ')).rejects.toThrow();

      expect(
        mockPersistenceCoordinator.triggerManualSave
      ).not.toHaveBeenCalled();
      expect(context.bed.getLogger().error).toHaveBeenCalledWith(
        expect.stringContaining("Invalid saveName '   '"),
        expect.any(Object)
      );
    });
  });

  describe('showSaveGameUI', () => {
    it('should dispatch REQUEST_SHOW_SAVE_GAME_UI when saving is allowed', async () => {
      context.bed
        .getGamePersistenceService()
        .isSavingAllowed.mockReturnValue(true);
      context.bed.getSafeEventDispatcher().dispatch.mockResolvedValue(true);

      await context.engine.showSaveGameUI();

      expect(context.bed.getLogger().debug).toHaveBeenCalledWith(
        'GameEngine.showSaveGameUI: Dispatching request to show Save Game UI.'
      );
      expect(
        context.bed.getSafeEventDispatcher().dispatch
      ).toHaveBeenCalledWith(REQUEST_SHOW_SAVE_GAME_UI, {});
    });

    it('should log warning when dispatcher fails', async () => {
      context.bed
        .getGamePersistenceService()
        .isSavingAllowed.mockReturnValue(true);
      context.bed.getSafeEventDispatcher().dispatch.mockResolvedValue(false);

      await context.engine.showSaveGameUI();

      expect(context.bed.getLogger().warn).toHaveBeenCalledWith(
        'GameEngine.showSaveGameUI: SafeEventDispatcher reported failure when dispatching Save Game UI request.'
      );
    });

    it('should dispatch CANNOT_SAVE_GAME_INFO when saving is not allowed', async () => {
      context.bed
        .getGamePersistenceService()
        .isSavingAllowed.mockReturnValue(false);

      await context.engine.showSaveGameUI();

      expect(context.bed.getLogger().warn).toHaveBeenCalledWith(
        'GameEngine.showSaveGameUI: Saving is not currently allowed.'
      );
      expect(
        context.bed.getSafeEventDispatcher().dispatch
      ).toHaveBeenCalledWith(CANNOT_SAVE_GAME_INFO);
    });

    it('should treat non-boolean isSavingAllowed responses as a failure', async () => {
      context.bed
        .getGamePersistenceService()
        .isSavingAllowed.mockReturnValue('false');
      context.bed
        .getSafeEventDispatcher()
        .dispatch.mockResolvedValue(true);

      await context.engine.showSaveGameUI();

      expect(context.bed.getLogger().error).toHaveBeenCalledWith(
        'GameEngine.showSaveGameUI: GamePersistenceService.isSavingAllowed returned invalid result.',
        {
          receivedType: 'string',
          receivedValue: 'false',
        }
      );
      expect(context.bed.getLogger().warn).toHaveBeenCalledWith(
        'GameEngine.showSaveGameUI: Saving is not currently allowed.'
      );
      expect(
        context.bed.getSafeEventDispatcher().dispatch
      ).toHaveBeenCalledWith(CANNOT_SAVE_GAME_INFO);
      expect(
        context.bed.getSafeEventDispatcher().dispatch
      ).not.toHaveBeenCalledWith(REQUEST_SHOW_SAVE_GAME_UI, expect.anything());
    });

    it('should warn when CANNOT_SAVE_GAME_INFO dispatch fails', async () => {
      context.bed
        .getGamePersistenceService()
        .isSavingAllowed.mockReturnValue(false);
      context.bed
        .getSafeEventDispatcher()
        .dispatch.mockResolvedValueOnce(false);

      await context.engine.showSaveGameUI();

      expect(context.bed.getLogger().warn).toHaveBeenCalledWith(
        'GameEngine.showSaveGameUI: Saving is not currently allowed.'
      );
      expect(context.bed.getLogger().warn).toHaveBeenCalledWith(
        'GameEngine.showSaveGameUI: SafeEventDispatcher reported failure when dispatching CANNOT_SAVE_GAME_INFO.'
      );
    });

    it('should handle missing persistence service', async () => {
      // Create engine without persistence service
      const testBed = context.bed;
      testBed.withTokenOverride(tokens.GamePersistenceService, null);
      const engineWithoutPersistence = testBed.env.createInstance();

      await engineWithoutPersistence.showSaveGameUI();

      expect(testBed.getLogger().error).toHaveBeenCalledWith(
        'GameEngine.showSaveGameUI: GamePersistenceService is unavailable. Cannot show Save Game UI.'
      );
      // Should not dispatch any events
      expect(testBed.getSafeEventDispatcher().dispatch).not.toHaveBeenCalled();
    });
  });

  describe('showLoadGameUI', () => {
    it('should handle missing persistence service', async () => {
      // Create engine without persistence service
      const testBed = context.bed;
      testBed.withTokenOverride(tokens.GamePersistenceService, null);
      const engineWithoutPersistence = testBed.env.createInstance();

      await engineWithoutPersistence.showLoadGameUI();

      expect(testBed.getLogger().error).toHaveBeenCalledWith(
        'GameEngine.showLoadGameUI: GamePersistenceService is unavailable. Cannot show Load Game UI.'
      );
      // Should not dispatch any events
      expect(testBed.getSafeEventDispatcher().dispatch).not.toHaveBeenCalled();
    });

    it('should dispatch REQUEST_SHOW_LOAD_GAME_UI successfully', async () => {
      context.bed.getSafeEventDispatcher().dispatch.mockResolvedValue(true);

      await context.engine.showLoadGameUI();

      expect(context.bed.getLogger().debug).toHaveBeenCalledWith(
        'GameEngine.showLoadGameUI: Dispatching request to show Load Game UI.'
      );
      expect(
        context.bed.getSafeEventDispatcher().dispatch
      ).toHaveBeenCalledWith(REQUEST_SHOW_LOAD_GAME_UI, {});
    });

    it('should log warning when dispatcher fails for load game UI', async () => {
      context.bed.getSafeEventDispatcher().dispatch.mockResolvedValue(false);

      await context.engine.showLoadGameUI();

      expect(context.bed.getLogger().warn).toHaveBeenCalledWith(
        'GameEngine.showLoadGameUI: SafeEventDispatcher reported failure when dispatching Load Game UI request.'
      );
    });
  });

  describe('getEngineStatus', () => {
    it('should return correct engine status when stopped', () => {
      const status = context.engine.getEngineStatus();

      expect(status).toEqual({
        isInitialized: false,
        isLoopRunning: false,
        activeWorld: null,
      });
    });

    it('should return correct engine status when running', async () => {
      // Start the engine
      context.bed
        .getInitializationService()
        .runInitializationSequence.mockResolvedValue({
          success: true,
        });
      await context.engine.startNewGame(DEFAULT_TEST_WORLD);

      const status = context.engine.getEngineStatus();

      expect(status).toEqual({
        isInitialized: true,
        isLoopRunning: true,
        activeWorld: DEFAULT_TEST_WORLD,
      });
    });
  });

  describe('Private method coverage through error scenarios', () => {
    it('should handle missing entityManager in resetCoreGameState', async () => {
      // Create engine without entityManager
      const testBed = context.bed;
      testBed.withTokenOverride(tokens.IEntityManager, null);
      const engineWithoutEntityManager = testBed.env.createInstance();

      // Trigger resetCoreGameState through startNewGame
      testBed
        .getInitializationService()
        .runInitializationSequence.mockResolvedValue({
          success: true,
        });
      await engineWithoutEntityManager.startNewGame(DEFAULT_TEST_WORLD);

      expect(testBed.getLogger().warn).toHaveBeenCalledWith(
        'GameEngine._resetCoreGameState: EntityManager not available.'
      );
    });

    it('should handle missing playtimeTracker in resetCoreGameState', async () => {
      // Create engine without playtimeTracker
      const testBed = context.bed;
      testBed.withTokenOverride(tokens.PlaytimeTracker, null);
      const engineWithoutTracker = testBed.env.createInstance();

      // Trigger resetCoreGameState through startNewGame
      testBed
        .getInitializationService()
        .runInitializationSequence.mockResolvedValue({
          success: true,
        });
      await engineWithoutTracker.startNewGame(DEFAULT_TEST_WORLD);

      expect(testBed.getLogger().warn).toHaveBeenCalledWith(
        'GameEngine._resetCoreGameState: PlaytimeTracker not available.'
      );
    });
  });
});
