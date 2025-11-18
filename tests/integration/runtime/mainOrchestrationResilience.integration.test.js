/**
 * @file Integration tests that exercise the real main.js bootstrap orchestration
 *       with minimal but non-mocked stage dependencies. These scenarios focus on
 *       error resilience paths that were previously uncovered.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';

/**
 * Controls for the mocked container configuration behaviour.
 * Tests can toggle these flags to simulate specific failure modes.
 */
const mockContainerConfigControl = {
  shouldThrow: false,
  error: null,
  lastLogger: null,
};

/**
 * Controls for the mocked GameEngine behaviour.
 * Allows tests to force startNewGame failures while still exercising
 * the real stage orchestration.
 */
const mockGameEngineControl = {
  startShouldFail: false,
  instances: /** @type {any[]} */ ([]),
};

const mockUiBootstrapControl = {
  /** @type {((doc: Document) => import('../../../src/bootstrapper/UIBootstrapper.js').EssentialUIElements) | null} */
  override: null,
};

const mockAuxiliaryControl = {
  /** @type {Set<string>} */
  failures: new Set(),
};

jest.mock('../../../src/dependencyInjection/containerConfig.js', () => {
  const { tokens } = require('../../../src/dependencyInjection/tokens.js');

  const configureContainer = jest.fn(async (container) => {
    if (mockContainerConfigControl.shouldThrow) {
      throw mockContainerConfigControl.error ?? new Error('Simulated DI failure');
    }

    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock EventBus for cache invalidation setup
    const eventBus = {
      subscribe: jest.fn(),
      dispatch: jest.fn(),
    };

    container.registerInstance(tokens.ILogger, logger);
    container.registerInstance(tokens.IEventBus, eventBus);
    mockContainerConfigControl.lastLogger = logger;
    return Promise.resolve();
  });

  return { configureContainer };
});

jest.mock('../../../src/dependencyInjection/appContainer.js', () => {
  class TestAppContainer {
    constructor() {
      this.#registry = new Map();
    }

    /** @type {Map<any, { type: 'instance' | 'factory'; value: any }> } */
    #registry;

    registerInstance(token, instance) {
      this.#registry.set(token, { type: 'instance', value: instance });
    }

    registerFactory(token, factory) {
      this.#registry.set(token, { type: 'factory', value: factory });
    }

    resolve(token) {
      const entry = this.#registry.get(token);
      if (!entry) {
        throw new Error(`Service for token ${String(token)} was not registered`);
      }
      if (entry.type === 'factory') {
        return entry.value();
      }
      return entry.value;
    }

    isRegistered(token) {
      return this.#registry.has(token);
    }
  }

  return { __esModule: true, default: TestAppContainer };
});

jest.mock('../../../src/engine/gameEngine.js', () => {
  class TestGameEngine {
    constructor({ logger }) {
      this.logger = logger;
      this.startNewGameCalls = [];
      this.showLoadGameUI = jest.fn().mockResolvedValue(undefined);
      this.showSaveGameUI = jest.fn().mockResolvedValue(undefined);
      this.stop = jest.fn().mockResolvedValue(undefined);
      this.getEngineStatus = jest
        .fn()
        .mockReturnValue({ isLoopRunning: false });

      mockGameEngineControl.instances.push(this);
    }

    /**
     * @param {string} worldName
     * @returns {Promise<void>}
     */
    async startNewGame(worldName) {
      this.startNewGameCalls.push(worldName);
      if (mockGameEngineControl.startShouldFail) {
        throw new Error('Simulated start failure');
      }
    }
  }

  return { __esModule: true, default: TestGameEngine };
});

jest.mock('../../../src/bootstrapper/stages/auxiliary/index.js', () => {
  const createResult = (service) => {
    if (mockAuxiliaryControl.failures.has(service)) {
      return { success: false, error: new Error(`${service} failed`) };
    }
    return { success: true };
  };

  const makeInitializer = (service) => jest.fn(() => createResult(service));

  return {
    initEngineUIManager: makeInitializer('EngineUIManager'),
    initSaveGameUI: makeInitializer('SaveGameUI'),
    initLoadGameUI: makeInitializer('LoadGameUI'),
    initLlmSelectionModal: makeInitializer('LlmSelectionModal'),
    initCurrentTurnActorRenderer: makeInitializer('CurrentTurnActorRenderer'),
    initSpeechBubbleRenderer: makeInitializer('SpeechBubbleRenderer'),
    initProcessingIndicatorController: makeInitializer(
      'ProcessingIndicatorController'
    ),
    initCriticalLogNotifier: makeInitializer('CriticalLogNotifier'),
    initActorParticipationController: makeInitializer(
      'ActorParticipationController'
    ),
    initPerceptibleEventSenderController: makeInitializer(
      'PerceptibleEventSenderController'
    ),
  };
});

jest.mock('../../../src/bootstrapper/UIBootstrapper.js', () => {
  const actual = jest.requireActual('../../../src/bootstrapper/UIBootstrapper.js');

  class ControlledUIBootstrapper extends actual.UIBootstrapper {
    gatherEssentialElements(doc) {
      if (mockUiBootstrapControl.override) {
        return mockUiBootstrapControl.override(doc);
      }
      return super.gatherEssentialElements(doc);
    }
  }

  return { __esModule: true, UIBootstrapper: ControlledUIBootstrapper };
});

/**
 * Helper to prepare the DOM and global mocks for each scenario using the
 * existing Jest JSDOM environment.
 *
 * @param {string} html
 */
function setupDom(html) {
  document.body.innerHTML = html;
  global.alert = jest.fn();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ startWorld: 'aurora-bay' }),
  });
}

/**
 * Imports the main.js module in isolation so every test gets a fresh module
 * instance with the above mocks applied.
 */
async function importMainModule() {
  let imported;
  await jest.isolateModulesAsync(async () => {
    imported = await import('../../../src/main.js');
  });
  return imported;
}

describe('main.js bootstrap resilience integration', () => {
  beforeEach(() => {
    mockContainerConfigControl.shouldThrow = false;
    mockContainerConfigControl.error = null;
    mockContainerConfigControl.lastLogger = null;
    mockGameEngineControl.startShouldFail = false;
    mockGameEngineControl.instances.length = 0;
    mockUiBootstrapControl.override = null;
    mockAuxiliaryControl.failures = new Set();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    global.fetch = undefined;
    global.alert = undefined;
  });

  it('displays bootstrap failures using fallback DOM helpers when critical UI elements are missing', async () => {
    setupDom(`
      <main>
        <h1 id="page-title">Starship Chronicles</h1>
        <div id="outputDiv"></div>
        <input id="speech-input" placeholder="Command" />
      </main>
    `);

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});

    const { bootstrapApp } = await importMainModule();

    await bootstrapApp();

    const fallbackElement = document.getElementById('temp-startup-error');
    expect(fallbackElement).not.toBeNull();
    expect(fallbackElement?.textContent).toContain(
      'Application failed to start due to a critical error:'
    );
    expect(fallbackElement?.style.color).toBe('red');
    expect(fallbackElement?.style.border).toBe('1px solid red');

    expect(global.alert).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('surfaces beginGame guard failures with UI updates when the game engine was never initialized', async () => {
    setupDom(`
      <main>
        <h1 id="page-title">Living Narrative Engine</h1>
        <div id="outputDiv"></div>
        <div id="error-output" style="display: none"></div>
        <input id="speech-input" placeholder="Type here" />
      </main>
    `);

    mockUiBootstrapControl.override = (doc) => ({
      outputDiv: doc.getElementById('outputDiv'),
      errorDiv: null,
      inputElement: doc.getElementById('speech-input'),
      titleElement: doc.getElementById('page-title'),
      document: doc,
    });

    mockContainerConfigControl.shouldThrow = true;
    mockContainerConfigControl.error = new Error('DI configuration failed');

    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});

    const { bootstrapApp, beginGame, __TEST_ONLY__setCurrentPhaseForError } =
      await importMainModule();

    await bootstrapApp();

    __TEST_ONLY__setCurrentPhaseForError('Manual Phase Verification');

    await expect(beginGame(true)).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    const fallbackElements = Array.from(
      document.querySelectorAll('#temp-startup-error')
    );
    expect(fallbackElements.length).toBeGreaterThan(0);
    expect(
      fallbackElements.some((el) =>
        el.textContent?.includes(
          'Critical: GameEngine not initialized before attempting Start Game stage.'
        )
      )
    ).toBe(true);

    const titleElement = document.getElementById('page-title');
    expect(titleElement?.textContent).toBe('Fatal Error!');

    const inputElement = document.getElementById('speech-input');
    expect(inputElement).not.toBeNull();
    expect(inputElement?.disabled).toBe(true);
    expect(inputElement?.placeholder).toBe('Application failed to start.');

    expect(global.alert).not.toHaveBeenCalled();
  });

  it('propagates startGame failures through displayFatalStartupError and preserves diagnostic details', async () => {
    setupDom(`
      <main>
        <h1 id="page-title">Narrative Simulator</h1>
        <div id="outputDiv"></div>
        <div id="error-output" style="display: none"></div>
        <input id="speech-input" placeholder="Enter command" />
        <button id="open-save-game-button">Save</button>
        <button id="open-load-game-button">Load</button>
      </main>
    `);

    mockUiBootstrapControl.override = (doc) => ({
      outputDiv: doc.getElementById('outputDiv'),
      errorDiv: null,
      inputElement: doc.getElementById('speech-input'),
      titleElement: doc.getElementById('page-title'),
      document: doc,
    });

    mockGameEngineControl.startShouldFail = true;

    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});

    const { bootstrapApp, beginGame } = await importMainModule();

    await bootstrapApp();

    expect(mockGameEngineControl.instances).toHaveLength(1);
    const createdEngine = mockGameEngineControl.instances[0];
    expect(createdEngine.startNewGameCalls).toEqual([]);

    await expect(beginGame()).rejects.toThrow(
      'Failed to start new game with world "aurora-bay": Simulated start failure'
    );

    expect(createdEngine.startNewGameCalls).toEqual(['aurora-bay']);
    expect(createdEngine.showLoadGameUI).not.toHaveBeenCalled();

    const fallbackElements = document.querySelectorAll('#temp-startup-error');
    expect(fallbackElements.length).toBeGreaterThan(0);
    const latestFallback = fallbackElements[fallbackElements.length - 1];
    expect(latestFallback.textContent).toContain('Failed to start new game with world');
    expect(latestFallback.textContent).toContain('Simulated start failure');

    expect(global.alert).not.toHaveBeenCalled();
  });

  it('completes bootstrap successfully and shows load UI when requested', async () => {
    setupDom(`
      <main>
        <h1 id="page-title">Full Bootstrap</h1>
        <div id="outputDiv"></div>
        <div id="error-output" style="display: none"></div>
        <input id="speech-input" placeholder="Command" />
        <button id="open-save-game-button">Save</button>
        <button id="open-load-game-button">Load</button>
      </main>
    `);

    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});

    const { bootstrapApp, beginGame } = await importMainModule();

    await bootstrapApp();

    expect(mockGameEngineControl.instances).toHaveLength(1);
    const engine = mockGameEngineControl.instances[0];

    await expect(beginGame(true)).resolves.toBeUndefined();

    expect(engine.startNewGameCalls).toEqual(['aurora-bay']);
    expect(engine.showLoadGameUI).toHaveBeenCalledTimes(1);
    expect(global.alert).not.toHaveBeenCalled();
  });

  it('falls back to the default start world when game configuration fetch fails', async () => {
    setupDom(`
      <main>
        <h1 id="page-title">Fallback World</h1>
        <div id="outputDiv"></div>
        <div id="error-output" style="display: none"></div>
        <input id="speech-input" placeholder="Command" />
        <button id="open-save-game-button">Save</button>
        <button id="open-load-game-button">Load</button>
      </main>
    `);

    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    });

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});

    const { bootstrapApp, beginGame } = await importMainModule();

    await bootstrapApp();
    await beginGame();

    const engine = mockGameEngineControl.instances[0];
    expect(engine.startNewGameCalls).toEqual(['default']);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load startWorld from game.json:',
      expect.any(Error)
    );
  });

  it('logs individual auxiliary service failures when bootstrap stages report batched errors', async () => {
    setupDom(`
      <main>
        <h1 id="page-title">Auxiliary Failure</h1>
        <div id="outputDiv"></div>
        <div id="error-output" style="display: none"></div>
        <input id="speech-input" placeholder="Command" />
      </main>
    `);

    mockAuxiliaryControl.failures = new Set(['LoadGameUI']);

    const { bootstrapApp } = await importMainModule();

    await bootstrapApp();

    const logger = mockContainerConfigControl.lastLogger;
    expect(logger).not.toBeNull();
    expect(logger?.error).toHaveBeenCalledWith(
      'main.js: Failed to init LoadGameUI',
      expect.any(Error)
    );
  });
});

