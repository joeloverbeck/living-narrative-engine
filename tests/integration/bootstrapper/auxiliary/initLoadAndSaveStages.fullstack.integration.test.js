import { describe, it, beforeEach, expect } from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import GameEngine from '../../../../src/engine/gameEngine.js';
import GameEngineLoadAdapter from '../../../../src/adapters/GameEngineLoadAdapter.js';
import GameEngineSaveAdapter from '../../../../src/adapters/GameEngineSaveAdapter.js';
import {
  initLoadGameUI,
  initSaveGameUI,
} from '../../../../src/bootstrapper/stages/auxiliary/index.js';
import { initProcessingIndicatorController } from '../../../../src/bootstrapper/stages/auxiliary/initProcessingIndicatorController.js';
import {
  ENGINE_OPERATION_IN_PROGRESS_UI,
  ENGINE_READY_UI,
  GAME_SAVED_ID,
} from '../../../../src/constants/eventIds.js';
import StageError from '../../../../src/bootstrapper/StageError.js';

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(message, metadata) {
    this.debugEntries.push({ message, metadata });
  }

  info(message, metadata) {
    this.infoEntries.push({ message, metadata });
  }

  warn(message, metadata) {
    this.warnEntries.push({ message, metadata });
  }

  error(message, metadata) {
    this.errorEntries.push({ message, metadata });
  }
}

class SimpleEntityManager {
  constructor() {
    this.clearCount = 0;
  }

  clearAll() {
    this.clearCount += 1;
  }
}

class SimpleTurnManager {
  constructor() {
    this.started = false;
    this.startCount = 0;
    this.stopped = false;
  }

  async start() {
    this.startCount += 1;
    this.started = true;
  }

  async stop() {
    this.stopped = true;
  }
}

class SimplePlaytimeTracker {
  constructor() {
    this.resetCount = 0;
    this.sessionStarted = false;
    this.sessionEnded = false;
  }

  reset() {
    this.resetCount += 1;
  }

  startSession() {
    this.sessionStarted = true;
  }

  endSessionAndAccumulate() {
    this.sessionEnded = true;
  }
}

class SimpleInitializationService {
  async runInitializationSequence() {
    return { success: true };
  }
}

class RecordingSafeEventDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventId, payload, options) {
    this.events.push({ eventId, payload, options });
    return true;
  }
}

class ConfigurableGamePersistenceService {
  constructor() {
    this.loadCalls = [];
    this.saveCalls = [];
    this.nextLoadResult = {
      success: true,
      data: {
        metadata: { gameTitle: 'Default World' },
        state: { actors: [] },
      },
    };
    this.nextSaveResult = {
      success: true,
      filePath: '/saves/default.json',
    };
  }

  setNextLoadResult(result) {
    this.nextLoadResult = result;
  }

  setNextSaveResult(result) {
    this.nextSaveResult = result;
  }

  async loadAndRestoreGame(identifier) {
    this.loadCalls.push(identifier);
    const result = this.nextLoadResult;
    if (result instanceof Error) {
      throw result;
    }
    return result;
  }

  isSavingAllowed() {
    return true;
  }

  async saveGame(saveName, isManual, activeWorld) {
    this.saveCalls.push({ saveName, isManual, activeWorld });
    const result = this.nextSaveResult;
    if (result instanceof Error) {
      throw result;
    }
    return result;
  }
}

class RecordingLoadGameUI {
  constructor() {
    this.adapter = null;
    this.initCallCount = 0;
  }

  init(adapter) {
    this.initCallCount += 1;
    this.adapter = adapter;
  }
}

class RecordingSaveGameUI {
  constructor() {
    this.adapter = null;
    this.initCallCount = 0;
  }

  init(adapter) {
    this.initCallCount += 1;
    this.adapter = adapter;
  }
}

class PassiveProcessingIndicatorController {}

function createStageEnvironment() {
  const container = new AppContainer();
  const logger = new RecordingLogger();
  const entityManager = new SimpleEntityManager();
  const turnManager = new SimpleTurnManager();
  const playtimeTracker = new SimplePlaytimeTracker();
  const safeEventDispatcher = new RecordingSafeEventDispatcher();
  const initializationService = new SimpleInitializationService();
  const persistenceService = new ConfigurableGamePersistenceService();

  container.register(tokens.ILogger, logger);
  container.register(tokens.IEntityManager, entityManager);
  container.register(tokens.ITurnManager, turnManager);
  container.register(tokens.PlaytimeTracker, playtimeTracker);
  container.register(tokens.ISafeEventDispatcher, safeEventDispatcher);
  container.register(tokens.IInitializationService, initializationService);
  container.register(tokens.GamePersistenceService, persistenceService);

  const engine = new GameEngine({ container, logger });

  return {
    container,
    logger,
    engine,
    entityManager,
    turnManager,
    playtimeTracker,
    safeEventDispatcher,
    persistenceService,
  };
}

describe('Auxiliary bootstrap stages – full integration coverage', () => {
  /** @type {ReturnType<typeof createStageEnvironment>} */
  let env;

  beforeEach(() => {
    env = createStageEnvironment();
  });

  describe('initLoadGameUI', () => {
    it('wires the real load adapter and proxies through the game engine', async () => {
      env.container.register(
        tokens.LoadGameUI,
        () => new RecordingLoadGameUI()
      );

      const stageResult = await initLoadGameUI({
        container: env.container,
        gameEngine: env.engine,
        logger: env.logger,
        tokens,
      });

      expect(stageResult).toEqual({ success: true });
      const loadGameUI = env.container.resolve(tokens.LoadGameUI);

      expect(loadGameUI.initCallCount).toBe(1);
      expect(loadGameUI.adapter).toBeInstanceOf(GameEngineLoadAdapter);

      env.persistenceService.setNextLoadResult({
        success: true,
        data: {
          metadata: { gameTitle: 'Integration Realm' },
          state: { actors: ['hero'] },
        },
      });

      const loadResult = await loadGameUI.adapter.load('slot-integration');

      expect(loadResult).toEqual({
        success: true,
        data: {
          metadata: { gameTitle: 'Integration Realm' },
          state: { actors: ['hero'] },
        },
      });
      expect(env.persistenceService.loadCalls).toEqual(['slot-integration']);
      expect(env.entityManager.clearCount).toBeGreaterThanOrEqual(1);
      expect(env.playtimeTracker.resetCount).toBeGreaterThanOrEqual(1);
      expect(env.turnManager.started).toBe(true);

      const debugMessages = env.logger.debugEntries.map(
        (entry) => entry.message
      );
      expect(
        debugMessages.some((msg) =>
          msg.includes('LoadGameUI Init: Resolving LoadGameUI')
        )
      ).toBe(true);
      expect(
        debugMessages.some((msg) =>
          msg.includes('LoadGameUI Init: Initialized successfully')
        )
      ).toBe(true);
    });
  });

  describe('initSaveGameUI', () => {
    it('connects the save adapter and performs a real manual save through the engine', async () => {
      env.container.register(
        tokens.SaveGameUI,
        () => new RecordingSaveGameUI()
      );

      const stageResult = await initSaveGameUI({
        container: env.container,
        gameEngine: env.engine,
        logger: env.logger,
        tokens,
      });

      expect(stageResult).toEqual({ success: true });
      const saveGameUI = env.container.resolve(tokens.SaveGameUI);

      expect(saveGameUI.initCallCount).toBe(1);
      expect(saveGameUI.adapter).toBeInstanceOf(GameEngineSaveAdapter);

      env.persistenceService.setNextLoadResult({
        success: true,
        data: {
          metadata: { gameTitle: 'Stage World' },
          state: { actors: [] },
        },
      });
      await env.engine.loadGame('slot-bootstrap-prep');
      env.persistenceService.loadCalls = [];

      env.persistenceService.setNextSaveResult({
        success: true,
        filePath: '/saves/stage-world.json',
      });

      const saveOutcome = await saveGameUI.adapter.save(
        'slot-stage',
        'Stage Save'
      );

      expect(saveOutcome).toEqual({
        success: true,
        filePath: '/saves/stage-world.json',
      });
      expect(env.persistenceService.saveCalls).toEqual([
        { saveName: 'Stage Save', isManual: true, activeWorld: 'Stage World' },
      ]);

      const dispatchedEvents = env.safeEventDispatcher.events.map(
        (event) => event.eventId
      );
      expect(dispatchedEvents).toContain(ENGINE_OPERATION_IN_PROGRESS_UI);
      expect(dispatchedEvents).toContain(GAME_SAVED_ID);
      expect(dispatchedEvents).toContain(ENGINE_READY_UI);
    });
  });

  describe('initProcessingIndicatorController', () => {
    it('returns success when the controller resolves successfully', () => {
      env.container.register(
        tokens.ProcessingIndicatorController,
        () => new PassiveProcessingIndicatorController()
      );

      const stageResult = initProcessingIndicatorController({
        container: env.container,
        logger: env.logger,
        tokens,
      });

      expect(stageResult).toEqual({ success: true });
      const debugMessages = env.logger.debugEntries.map(
        (entry) => entry.message
      );
      expect(debugMessages.at(-1)).toContain(
        'ProcessingIndicatorController Init: Resolved successfully'
      );
    });

    it('returns a StageError when the controller cannot be resolved', () => {
      env.container.register(tokens.ProcessingIndicatorController, () => null);

      const stageResult = initProcessingIndicatorController({
        container: env.container,
        logger: env.logger,
        tokens,
      });

      expect(stageResult.success).toBe(false);
      expect(stageResult.error).toBeInstanceOf(StageError);
      expect(stageResult.error.message).toBe(
        'ProcessingIndicatorController could not be resolved.'
      );
      expect(stageResult.error.phase).toBe(
        'ProcessingIndicatorController Init'
      );
      expect(env.logger.warnEntries[0].message).toContain(
        'ProcessingIndicatorController could not be resolved'
      );
    });

    it('captures resolution errors and exposes them through the stage result', () => {
      const stageResult = initProcessingIndicatorController({
        container: env.container,
        logger: env.logger,
        tokens,
      });

      expect(stageResult.success).toBe(false);
      expect(stageResult.error).toBeInstanceOf(StageError);
      expect(stageResult.error.message).toContain(
        'AppContainer: No service registered'
      );
      expect(env.logger.errorEntries[0].message).toContain(
        'ProcessingIndicatorController Init: Error during resolution.'
      );
    });
  });
});
