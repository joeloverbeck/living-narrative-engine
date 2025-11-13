import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';

const TEST_HTML_SHELL = `<!DOCTYPE html>
  <html>
    <body>
      <div id="app-root"></div>
    </body>
  </html>`;

describe('main.js catastrophic bootstrap scenarios', () => {
  /** @type {JSDOM} */
  let dom;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM(TEST_HTML_SHELL, { url: 'http://localhost/' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.alert = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    dom.window.close();
    jest.restoreAllMocks();
    delete global.window;
    delete global.document;
    delete global.alert;
    delete global.fetch;
  });

  it('falls back to DOM helpers when early bootstrap stages fail', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <input id="speech-input" />
    `;

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: jest.fn().mockResolvedValue({}),
    });

    let mainModule;
    await jest.isolateModulesAsync(async () => {
      mainModule = await import('../../../src/main.js');
    });

    const {
      bootstrapApp,
      __TEST_ONLY__setCurrentPhaseForError,
      __TEST_ONLY__setStartWorld,
    } = mainModule;

    __TEST_ONLY__setCurrentPhaseForError('Injected Phase');
    __TEST_ONLY__setStartWorld('manual-world');

    await expect(bootstrapApp()).resolves.toBeUndefined();

    expect(global.fetch).toHaveBeenCalledWith('./data/game.json');
    expect(console.error).toHaveBeenCalledWith(
      'Failed to load startWorld from game.json:',
      expect.any(Error)
    );

    const fallbackError = document.getElementById('temp-startup-error');
    expect(fallbackError).not.toBeNull();
    expect(fallbackError?.textContent).toContain('Application failed to start due to a critical error:');
    expect(fallbackError?.style.border).toBe('1px solid red');
    // Title element no longer exists in game.html - verify it's absent
    expect(document.querySelector('h1')).toBeNull();
    expect(global.alert).not.toHaveBeenCalled();
  });

  it('reports missing critical DOM elements when phase tracking resets before validation failure', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <h1>Original Title</h1>
      <input id="speech-input" />
    `;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ startWorld: 'fallback' }),
    });

    const { stageFailure } = await import('../../../src/types/stageResult.js');

    global.__LNE_forcePhaseReset = () => {};

    jest.doMock('../../../src/bootstrapper/stages/index.js', () => {
      const actual = jest.requireActual('../../../src/bootstrapper/stages/index.js');
      return {
        ...actual,
        ensureCriticalDOMElementsStage: jest.fn(async () => {
          global.__LNE_forcePhaseReset?.();
          return stageFailure(new Error('missing critical UI'));
        }),
      };
    });

    let mainModule;
    await jest.isolateModulesAsync(async () => {
      mainModule = await import('../../../src/main.js');
    });

    global.__LNE_forcePhaseReset = () => {
      mainModule.__TEST_ONLY__setCurrentPhaseForError(undefined);
    };

    const { bootstrapApp } = mainModule;

    await expect(bootstrapApp()).resolves.toBeUndefined();

    const errorOutput = document.getElementById('error-output');
    expect(errorOutput?.textContent).toContain(
      'Application failed to start due to a critical error: missing critical UI'
    );
    expect(errorOutput?.style.display).toBe('block');

    delete global.__LNE_forcePhaseReset;
  });

  it('surfaces beginGame errors when the engine was never initialised', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <h1>Game Title</h1>
      <input id="speech-input" />
    `;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ startWorld: 'arena' }),
    });

    const { stageSuccess } = await import('../../../src/types/stageResult.js');
    const { tokens } = await import('../../../src/dependencyInjection/tokens.js');

    const mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    };
    const mockContainer = {
      resolve: jest.fn((token) => {
        if (token === tokens.ILogger) {
          return mockLogger;
        }
        return undefined;
      }),
    };

    const uiElementsPayload = {
      outputDiv: document.getElementById('outputDiv'),
      errorDiv: null,
      inputElement: document.getElementById('speech-input'),
      titleElement: document.querySelector('h1'),
      document,
    };

    jest.doMock('../../../src/bootstrapper/stages/index.js', () => {
      const actual = jest.requireActual('../../../src/bootstrapper/stages/index.js');
      return {
        ...actual,
        ensureCriticalDOMElementsStage: jest.fn(async () => stageSuccess(uiElementsPayload)),
        setupDIContainerStage: jest.fn(async (_ui, _config, options) => {
          options?.createAppContainer?.();
          return stageSuccess(mockContainer);
        }),
        resolveLoggerStage: jest.fn(async () => {
          const logger = mockContainer.resolve(tokens.ILogger);
          return stageSuccess({ logger });
        }),
        initializeGlobalConfigStage: jest.fn(async () => stageSuccess({})),
        initializeAuxiliaryServicesStage: jest.fn(async () => stageSuccess({})),
        setupMenuButtonListenersStage: jest.fn(async () => stageSuccess({})),
        setupGlobalEventListenersStage: jest.fn(async () => stageSuccess({})),
        initializeGameEngineStage: jest.fn(async () => stageSuccess(null)),
      };
    });

    jest.doMock('../../../src/dependencyInjection/appContainer.js', () => ({
      __esModule: true,
      default: class MockAppContainer {},
    }));

    jest.doMock('../../../src/dependencyInjection/containerConfig.js', () => ({
      configureContainer: jest.fn(async () => {}),
    }));

    let mainModule;
    await jest.isolateModulesAsync(async () => {
      mainModule = await import('../../../src/main.js');
    });

    const { bootstrapApp, beginGame } = mainModule;

    await expect(bootstrapApp()).resolves.toBeUndefined();

    await expect(beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);

    const fallbackEl = document.getElementById('temp-startup-error');
    expect(fallbackEl).not.toBeNull();
    expect(fallbackEl?.textContent).toContain(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    const inputEl = document.getElementById('speech-input');
    expect(inputEl?.disabled).toBe(true);
    expect(inputEl?.placeholder).toBe('Application failed to start.');

    expect(global.alert).not.toHaveBeenCalled();
  });

  it('reports startGameStage failures with user-facing DOM updates', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <h1>Game Title</h1>
      <input id="speech-input" />
    `;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ startWorld: 'nexus' }),
    });

    const { stageSuccess } = await import('../../../src/types/stageResult.js');
    const { tokens } = await import('../../../src/dependencyInjection/tokens.js');

    const mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    };
    const mockContainer = {
      resolve: jest.fn((token) => {
        if (token === tokens.ILogger) {
          return mockLogger;
        }
        return undefined;
      }),
    };

    const uiElementsPayload = {
      outputDiv: document.getElementById('outputDiv'),
      errorDiv: null,
      inputElement: document.getElementById('speech-input'),
      titleElement: document.querySelector('h1'),
      document,
    };

    jest.doMock('../../../src/bootstrapper/stages/index.js', () => {
      const actual = jest.requireActual('../../../src/bootstrapper/stages/index.js');
      return {
        ...actual,
        ensureCriticalDOMElementsStage: jest.fn(async () => stageSuccess(uiElementsPayload)),
        setupDIContainerStage: jest.fn(async (_ui, _config, options) => {
          options?.createAppContainer?.();
          return stageSuccess(mockContainer);
        }),
        resolveLoggerStage: jest.fn(async () => {
          const logger = mockContainer.resolve(tokens.ILogger);
          return stageSuccess({ logger });
        }),
        initializeGlobalConfigStage: jest.fn(async () => stageSuccess({})),
        initializeAuxiliaryServicesStage: jest.fn(async () => stageSuccess({})),
        setupMenuButtonListenersStage: jest.fn(async () => stageSuccess({})),
        setupGlobalEventListenersStage: jest.fn(async () => stageSuccess({})),
      };
    });

    jest.doMock('../../../src/dependencyInjection/appContainer.js', () => ({
      __esModule: true,
      default: class MockAppContainer {},
    }));

    jest.doMock('../../../src/dependencyInjection/containerConfig.js', () => ({
      configureContainer: jest.fn(async () => {}),
    }));

    jest.doMock('../../../src/engine/gameEngine.js', () => ({
      __esModule: true,
      default: class MockGameEngine {
        constructor({ logger }) {
          this.logger = logger;
          this.startNewGame = jest.fn(async () => {
            throw new Error('boot failure');
          });
          this.showLoadGameUI = jest.fn().mockResolvedValue(undefined);
        }
      },
    }));

    let mainModule;
    await jest.isolateModulesAsync(async () => {
      mainModule = await import('../../../src/main.js');
    });

    const { bootstrapApp, beginGame } = mainModule;

    await expect(bootstrapApp()).resolves.toBeUndefined();

    await expect(beginGame(true)).rejects.toThrow(
      'Failed to start new game with world "nexus": boot failure'
    );

    expect(mockContainer.resolve).toHaveBeenCalledWith(tokens.ILogger);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Bootstrap Stage: Start Game'),
      expect.any(Error)
    );

    const fallbackEl = document.getElementById('temp-startup-error');
    expect(fallbackEl).not.toBeNull();
    expect(fallbackEl?.textContent).toContain('Application failed to start due to a critical error:');

    const inputEl = document.getElementById('speech-input');
    expect(inputEl?.disabled).toBe(true);
    expect(inputEl?.placeholder).toBe('Application failed to start.');

    expect(global.alert).not.toHaveBeenCalled();
  });

  it('starts the game successfully and opens the load UI when requested', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <h1>Game Title</h1>
      <input id="speech-input" />
    `;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ startWorld: 'launchpad' }),
    });

    const { stageSuccess } = await import('../../../src/types/stageResult.js');
    const { tokens } = await import('../../../src/dependencyInjection/tokens.js');

    const mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    };
    const mockContainer = {
      resolve: jest.fn((token) => {
        if (token === tokens.ILogger) {
          return mockLogger;
        }
        return undefined;
      }),
    };

    jest.doMock('../../../src/bootstrapper/stages/index.js', () => {
      const actual = jest.requireActual('../../../src/bootstrapper/stages/index.js');
      return {
        ...actual,
        ensureCriticalDOMElementsStage: actual.ensureCriticalDOMElementsStage,
        setupDIContainerStage: jest.fn(async (_ui, _config, options) => {
          options?.createAppContainer?.();
          return stageSuccess(mockContainer);
        }),
        resolveLoggerStage: jest.fn(async () => {
          const logger = mockContainer.resolve(tokens.ILogger);
          return stageSuccess({ logger });
        }),
        initializeGlobalConfigStage: jest.fn(async () => stageSuccess({})),
        initializeGameEngineStage: jest.fn(async (_container, logger, options) => {
          const engine = options?.createGameEngine?.({ container: mockContainer, logger });
          return stageSuccess(engine);
        }),
        initializeAuxiliaryServicesStage: jest.fn(async () => stageSuccess({})),
        setupMenuButtonListenersStage: jest.fn(async () => stageSuccess({})),
        setupGlobalEventListenersStage: jest.fn(async () => stageSuccess({})),
      };
    });

    const showLoadUISpy = jest.fn().mockResolvedValue(undefined);
    jest.doMock('../../../src/engine/gameEngine.js', () => ({
      __esModule: true,
      default: class MockGameEngine {
        constructor({ logger }) {
          this.logger = logger;
          this.startNewGame = jest.fn().mockResolvedValue(undefined);
          this.showLoadGameUI = showLoadUISpy;
        }
      },
    }));

    jest.doMock('../../../src/dependencyInjection/appContainer.js', () => ({
      __esModule: true,
      default: class MockAppContainer {},
    }));

    jest.doMock('../../../src/dependencyInjection/containerConfig.js', () => ({
      configureContainer: jest.fn(async () => {}),
    }));

    let mainModule;
    await jest.isolateModulesAsync(async () => {
      mainModule = await import('../../../src/main.js');
    });

    const { bootstrapApp, beginGame } = mainModule;

    await expect(bootstrapApp()).resolves.toBeUndefined();

    await expect(beginGame(true)).resolves.toBeUndefined();

    expect(showLoadUISpy).toHaveBeenCalled();
  });

  it('loads the default world when game.json omits startWorld and beginGame fallback is triggered', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <h1>Game Title</h1>
      <input id="speech-input" />
    `;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });

    const { stageSuccess } = await import('../../../src/types/stageResult.js');
    const { tokens } = await import('../../../src/dependencyInjection/tokens.js');

    const mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    };
    const mockContainer = {
      resolve: jest.fn((token) => {
        if (token === tokens.ILogger) {
          return mockLogger;
        }
        return undefined;
      }),
    };

    const engineInstances = [];

    jest.doMock('../../../src/bootstrapper/stages/index.js', () => {
      const actual = jest.requireActual('../../../src/bootstrapper/stages/index.js');
      return {
        ...actual,
        ensureCriticalDOMElementsStage: actual.ensureCriticalDOMElementsStage,
        setupDIContainerStage: jest.fn(async (_ui, _config, options) => {
          options?.createAppContainer?.();
          return stageSuccess(mockContainer);
        }),
        resolveLoggerStage: jest.fn(async () => {
          const logger = mockContainer.resolve(tokens.ILogger);
          return stageSuccess({ logger });
        }),
        initializeGlobalConfigStage: jest.fn(async () => stageSuccess({})),
        initializeGameEngineStage: jest.fn(async (_container, logger, options) => {
          const engine = options?.createGameEngine?.({ container: mockContainer, logger });
          engineInstances.push(engine);
          return stageSuccess(engine);
        }),
        initializeAuxiliaryServicesStage: jest.fn(async () => stageSuccess({})),
        setupMenuButtonListenersStage: jest.fn(async () => stageSuccess({})),
        setupGlobalEventListenersStage: jest.fn(async () => stageSuccess({})),
      };
    });

    const startNewGameSpy = jest.fn().mockResolvedValue(undefined);
    jest.doMock('../../../src/engine/gameEngine.js', () => ({
      __esModule: true,
      default: class MockGameEngine {
        constructor({ logger }) {
          this.logger = logger;
          this.startNewGame = startNewGameSpy;
          this.showLoadGameUI = jest.fn().mockResolvedValue(undefined);
        }
      },
    }));

    jest.doMock('../../../src/dependencyInjection/appContainer.js', () => ({
      __esModule: true,
      default: class MockAppContainer {},
    }));

    jest.doMock('../../../src/dependencyInjection/containerConfig.js', () => ({
      configureContainer: jest.fn(async () => {}),
    }));

    let mainModule;
    await jest.isolateModulesAsync(async () => {
      mainModule = await import('../../../src/main.js');
    });

    const { bootstrapApp, beginGame, __TEST_ONLY__setStartWorld } = mainModule;

    await expect(bootstrapApp()).resolves.toBeUndefined();

    await expect(beginGame()).resolves.toBeUndefined();
    expect(startNewGameSpy).toHaveBeenLastCalledWith('default');

    startNewGameSpy.mockClear();
    __TEST_ONLY__setStartWorld('');

    await expect(beginGame()).resolves.toBeUndefined();
    expect(startNewGameSpy).toHaveBeenLastCalledWith('default');

    expect(engineInstances).toHaveLength(1);
  });

  it('derives the runtime phase fallback when late-stage failures omit metadata', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <h1>Game Title</h1>
      <input id="speech-input" />
    `;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ startWorld: 'citadel' }),
    });

    const { stageSuccess, stageFailure } = await import('../../../src/types/stageResult.js');
    const { tokens } = await import('../../../src/dependencyInjection/tokens.js');

    const mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    };
    const mockContainer = {
      resolve: jest.fn((token) => {
        if (token === tokens.ILogger) {
          return mockLogger;
        }
        return undefined;
      }),
    };

    global.__LNE_setPhaseToNull = () => {};

    jest.doMock('../../../src/bootstrapper/stages/index.js', () => {
      const actual = jest.requireActual('../../../src/bootstrapper/stages/index.js');
      return {
        ...actual,
        ensureCriticalDOMElementsStage: actual.ensureCriticalDOMElementsStage,
        setupDIContainerStage: jest.fn(async (_ui, _config, options) => {
          options?.createAppContainer?.();
          return stageSuccess(mockContainer);
        }),
        resolveLoggerStage: jest.fn(async () => {
          const logger = mockContainer.resolve(tokens.ILogger);
          return stageSuccess({ logger });
        }),
        initializeGlobalConfigStage: jest.fn(async () => stageSuccess({})),
        initializeGameEngineStage: jest.fn(async (_container, logger, options) => {
          const engine = options?.createGameEngine?.({ container: mockContainer, logger });
          return stageSuccess(engine);
        }),
        initializeAuxiliaryServicesStage: jest.fn(async () => stageSuccess({})),
        setupMenuButtonListenersStage: jest.fn(async () => stageSuccess({})),
        setupGlobalEventListenersStage: jest.fn(async () => {
          global.__LNE_setPhaseToNull?.();
          return stageFailure(new Error('global listeners failed mysteriously'));
        }),
      };
    });

    jest.doMock('../../../src/engine/gameEngine.js', () => ({
      __esModule: true,
      default: class MockGameEngine {
        constructor({ logger }) {
          this.logger = logger;
          this.startNewGame = jest.fn().mockResolvedValue(undefined);
        }
      },
    }));

    jest.doMock('../../../src/dependencyInjection/appContainer.js', () => ({
      __esModule: true,
      default: class MockAppContainer {},
    }));

    jest.doMock('../../../src/dependencyInjection/containerConfig.js', () => ({
      configureContainer: jest.fn(async () => {}),
    }));

    let mainModule;
    await jest.isolateModulesAsync(async () => {
      mainModule = await import('../../../src/main.js');
    });

    global.__LNE_setPhaseToNull = () => {
      mainModule.__TEST_ONLY__setCurrentPhaseForError(undefined);
    };

    const { bootstrapApp } = mainModule;

    await expect(bootstrapApp()).resolves.toBeUndefined();

    const errorOutput = document.getElementById('error-output');
    expect(errorOutput?.textContent).toContain(
      'Application failed to start due to a critical error: global listeners failed mysteriously'
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Bootstrap Orchestration - Application Logic/Runtime'),
      expect.any(Error)
    );

    delete global.__LNE_setPhaseToNull;
  });

  it('falls back to console logging when beginGame runs after an early bootstrap failure', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <h1>Game Title</h1>
      <input id="speech-input" />
    `;

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ startWorld: 'citadel' }),
    });

    const { stageSuccess, stageFailure } = await import('../../../src/types/stageResult.js');

    jest.doMock('../../../src/bootstrapper/stages/index.js', () => {
      const actual = jest.requireActual('../../../src/bootstrapper/stages/index.js');
      return {
        ...actual,
        ensureCriticalDOMElementsStage: actual.ensureCriticalDOMElementsStage,
        setupDIContainerStage: jest.fn(async () => stageFailure(new Error('container exploded'))),
      };
    });

    jest.doMock('../../../src/dependencyInjection/appContainer.js', () => ({
      __esModule: true,
      default: class MockAppContainer {},
    }));

    jest.doMock('../../../src/dependencyInjection/containerConfig.js', () => ({
      configureContainer: jest.fn(async () => {}),
    }));

    let mainModule;
    await jest.isolateModulesAsync(async () => {
      mainModule = await import('../../../src/main.js');
    });

    const { bootstrapApp, beginGame } = mainModule;

    await expect(bootstrapApp()).resolves.toBeUndefined();

    const consoleErrorSpy = jest.spyOn(console, 'error');

    await expect(beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Critical: GameEngine not initialized before attempting Start Game stage.')
    );

    consoleErrorSpy.mockRestore();
  });

  describe('stage failure coverage', () => {
    const failureCases = [
      {
        label: 'DI container setup',
        stage: 'setupDIContainerStage',
        failureMessage: 'container registration failed',
        configure(stages, _success, stageFailureFn) {
          stages.setupDIContainerStage.mockImplementation(async () => {
            global.__LNE_forcePhaseReset?.();
            return stageFailureFn(new Error('container registration failed'));
          });
        },
      },
      {
        label: 'logger resolution',
        stage: 'resolveLoggerStage',
        failureMessage: 'logger resolution failed',
        configure(stages, _success, stageFailureFn) {
          stages.resolveLoggerStage.mockImplementation(async () => {
            global.__LNE_forcePhaseReset?.();
            return stageFailureFn(new Error('logger resolution failed'));
          });
        },
      },
      {
        label: 'global configuration initialisation',
        stage: 'initializeGlobalConfigStage',
        failureMessage: 'config stage failed',
        configure(stages, _success, stageFailureFn) {
          stages.initializeGlobalConfigStage.mockImplementation(async () =>
            stageFailureFn(new Error('config stage failed'))
          );
        },
      },
      {
        label: 'game engine initialisation',
        stage: 'initializeGameEngineStage',
        failureMessage: 'engine stage failed',
        configure(stages, _success, stageFailureFn) {
          stages.initializeGameEngineStage.mockImplementation(async () =>
            stageFailureFn(new Error('engine stage failed'))
          );
        },
      },
      {
        label: 'auxiliary services initialisation',
        stage: 'initializeAuxiliaryServicesStage',
        failureMessage: 'auxiliary stage failed',
        configure(stages, stageSuccessFn, stageFailureFn) {
          stages.initializeGameEngineStage.mockImplementation(async () =>
            stageSuccessFn({})
          );
          stages.initializeAuxiliaryServicesStage.mockImplementation(async () => {
            const error = new Error('auxiliary stage failed');
            error.failures = [
              { service: 'AuxiliaryService', error: new Error('aux boom') },
            ];
            return stageFailureFn(error);
          });
        },
      },
      {
        label: 'menu listeners setup',
        stage: 'setupMenuButtonListenersStage',
        failureMessage: 'menu stage failed',
        configure(stages, stageSuccessFn, stageFailureFn) {
          stages.initializeGameEngineStage.mockImplementation(async () =>
            stageSuccessFn({})
          );
          stages.initializeAuxiliaryServicesStage.mockImplementation(async () =>
            stageSuccessFn({})
          );
          stages.setupMenuButtonListenersStage.mockImplementation(async () =>
            stageFailureFn(new Error('menu stage failed'))
          );
        },
      },
      {
        label: 'global listeners setup',
        stage: 'setupGlobalEventListenersStage',
        failureMessage: 'global listeners failed',
        configure(stages, stageSuccessFn, stageFailureFn) {
          stages.initializeGameEngineStage.mockImplementation(async () =>
            stageSuccessFn({})
          );
          stages.initializeAuxiliaryServicesStage.mockImplementation(async () =>
            stageSuccessFn({})
          );
          stages.setupMenuButtonListenersStage.mockImplementation(async () =>
            stageSuccessFn({})
          );
          stages.setupGlobalEventListenersStage.mockImplementation(async () =>
            stageFailureFn(new Error('global listeners failed'))
          );
        },
      },
    ];

    it.each(failureCases)('handles %s failure gracefully', async ({
      label,
      stage,
      configure,
      failureMessage,
    }) => {
      document.body.innerHTML = `
        <div id="outputDiv"></div>
        <div id="error-output"></div>
        <h1>Game Title</h1>
        <input id="speech-input" />
      `;

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ startWorld: 'sanctuary' }),
      });

      const { stageSuccess, stageFailure } = await import('../../../src/types/stageResult.js');
      const { tokens } = await import('../../../src/dependencyInjection/tokens.js');

      const mockLogger = {
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
      };
      const mockContainer = {
        resolve: jest.fn((token) => {
          if (token === tokens.ILogger) {
            return mockLogger;
          }
          return undefined;
        }),
      };

      jest.doMock('../../../src/bootstrapper/stages/index.js', () => {
        const actual = jest.requireActual('../../../src/bootstrapper/stages/index.js');
        const stages = {
          ...actual,
          ensureCriticalDOMElementsStage: actual.ensureCriticalDOMElementsStage,
          setupDIContainerStage: jest.fn(async (_ui, _config, options) => {
            options?.createAppContainer?.();
            return stageSuccess(mockContainer);
          }),
          resolveLoggerStage: jest.fn(async () => {
            const logger = mockContainer.resolve(tokens.ILogger);
            return stageSuccess({ logger });
          }),
          initializeGlobalConfigStage: jest.fn(async () => stageSuccess({})),
          initializeGameEngineStage: jest.fn(async () => stageSuccess({})),
          initializeAuxiliaryServicesStage: jest.fn(async () => stageSuccess({})),
          setupMenuButtonListenersStage: jest.fn(async () => stageSuccess({})),
          setupGlobalEventListenersStage: jest.fn(async () => stageSuccess({})),
        };
        configure(stages, stageSuccess, stageFailure);
        return stages;
      });

      jest.doMock('../../../src/dependencyInjection/appContainer.js', () => ({
        __esModule: true,
        default: class MockAppContainer {},
      }));

      jest.doMock('../../../src/dependencyInjection/containerConfig.js', () => ({
        configureContainer: jest.fn(async () => {}),
      }));

      let mainModule;
      await jest.isolateModulesAsync(async () => {
        mainModule = await import('../../../src/main.js');
      });

      if (label === 'logger resolution' || label === 'DI container setup') {
        global.__LNE_forcePhaseReset = () => {
          mainModule.__TEST_ONLY__setCurrentPhaseForError(undefined);
        };
      }

      const { bootstrapApp } = mainModule;

      await expect(bootstrapApp()).resolves.toBeUndefined();

      const errorOutput = document.getElementById('error-output');
      const fallbackMessage = errorOutput?.textContent || '';
      expect(fallbackMessage).toContain(
        `Application failed to start due to a critical error: ${failureMessage}`
      );
      expect(errorOutput?.style.display).toBe('block');

      if (label === 'logger resolution' || label === 'DI container setup') {
        delete global.__LNE_forcePhaseReset;
      }
    });
  });
});
