import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { initLoadGameUI } from '../../../../src/bootstrapper/stages/auxiliary/initLoadGameUI.js';
import GameEngineLoadAdapter from '../../../../src/adapters/GameEngineLoadAdapter.js';

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.errorEntries = [];
    this.warnEntries = [];
  }

  debug(message, metadata) {
    this.debugEntries.push({ message, metadata });
  }

  warn(message, metadata) {
    this.warnEntries.push({ message, metadata });
  }

  error(message, metadata) {
    this.errorEntries.push({ message, metadata });
  }
}

class TestLoadGameUI {
  constructor() {
    this.adapter = null;
    this.initCallCount = 0;
  }

  init(adapter) {
    this.initCallCount += 1;
    this.adapter = adapter;
  }

  async loadSlot(identifier) {
    if (!this.adapter) {
      throw new Error('Load service not wired');
    }
    return this.adapter.load(identifier);
  }
}

describe('initLoadGameUI integration wiring', () => {
  let container;
  let logger;
  let loadGameUI;
  let gameEngine;

  beforeEach(() => {
    container = new AppContainer();
    logger = new RecordingLogger();
    loadGameUI = new TestLoadGameUI();
    gameEngine = {
      loadGame: jest.fn().mockResolvedValue({
        success: true,
        data: { metadata: { gameTitle: 'Test World' } },
      }),
    };
    container.register(tokens.LoadGameUI, loadGameUI);
  });

  it('initializes the UI with a real adapter that proxies to the engine', async () => {
    const result = await initLoadGameUI({
      container,
      gameEngine,
      logger,
      tokens,
    });

    expect(result).toEqual({ success: true });
    expect(loadGameUI.initCallCount).toBe(1);
    expect(loadGameUI.adapter).toBeInstanceOf(GameEngineLoadAdapter);

    const response = await loadGameUI.loadSlot('slot-42');

    expect(gameEngine.loadGame).toHaveBeenCalledWith('slot-42');
    expect(response).toEqual({
      success: true,
      data: { metadata: { gameTitle: 'Test World' } },
    });
    expect(logger.debugEntries[0].message).toContain(
      'LoadGameUI Init: Resolving'
    );
    expect(logger.debugEntries.at(-1)?.message).toContain(
      'LoadGameUI Init: Initialized successfully'
    );
  });

  it('propagates engine errors through the adapter for consumers to handle', async () => {
    gameEngine.loadGame.mockRejectedValue(new Error('engine unavailable'));

    await initLoadGameUI({ container, gameEngine, logger, tokens });

    await expect(loadGameUI.loadSlot('slot-error')).rejects.toThrow(
      'engine unavailable'
    );
    expect(gameEngine.loadGame).toHaveBeenCalledWith('slot-error');
  });
});
