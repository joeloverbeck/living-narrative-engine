import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

const baseDom = `
  <div id="outputDiv"></div>
  <div id="error-output"></div>
  <input id="speech-input" />
  <h1>Title</h1>
`;

const createUIElements = () => ({
  outputDiv: document.getElementById('outputDiv'),
  errorDiv: document.getElementById('error-output'),
  titleElement: document.querySelector('h1'),
  inputElement: document.getElementById('speech-input'),
  document,
});

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('main.js fallback and override coverage', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = baseDom;
    global.alert = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
    delete global.alert;
  });

  it('uses fallback DOM adapter when bootstrap fails before UI elements are captured', async () => {
    const stageMocks = {
      ensureCriticalDOMElementsStage: jest.fn(async () => {
        const error = new Error('UI bootstrap failed');
        error.phase = 'UI Element Validation';
        throw error;
      }),
      setupDIContainerStage: jest.fn(),
      resolveLoggerStage: jest.fn(),
      initializeGlobalConfigStage: jest.fn(),
      initializeGameEngineStage: jest.fn(),
      initializeAuxiliaryServicesStage: jest.fn(),
      setupMenuButtonListenersStage: jest.fn(),
      setupGlobalEventListenersStage: jest.fn(),
      startGameStage: jest.fn(),
    };

    jest.doMock('../../../src/bootstrapper/stages/index.js', () => stageMocks);
    jest.doMock('../../../src/dependencyInjection/containerConfig.js', () => ({
      __esModule: true,
      configureContainer: jest.fn(),
    }));
    jest.doMock('../../../src/dependencyInjection/tokens.js', () => ({
      __esModule: true,
      tokens: {},
    }));
    jest.doMock('../../../src/bootstrapper/UIBootstrapper.js', () => ({
      __esModule: true,
      UIBootstrapper: class {
        gatherEssentialElements() {
          return createUIElements();
        }
      },
    }));
    jest.doMock('../../../src/dependencyInjection/appContainer.js', () => ({
      __esModule: true,
      default: class {
        constructor() {
          this.resolve = jest.fn();
          this.isRegistered = jest.fn().mockReturnValue(false);
        }
      },
    }));
    jest.doMock('../../../src/engine/gameEngine.js', () => ({
      __esModule: true,
      default: class {
        constructor(opts = {}) {
          Object.assign(this, opts);
          this.showLoadGameUI = jest.fn();
        }
      },
    }));

    // Remove the dedicated error div so the fallback DOM adapter must fabricate one
    const existingErrorDiv = document.getElementById('error-output');
    existingErrorDiv?.remove();

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { bootstrapApp, __TEST_ONLY__setCurrentPhaseForError } = await import(
      '../../../src/main.js'
    );

    __TEST_ONLY__setCurrentPhaseForError('Preflight Phase');

    await expect(bootstrapApp()).resolves.toBeUndefined();

    expect(global.fetch).toHaveBeenCalledWith('./data/game.json');

    const tempError = document.getElementById('temp-startup-error');
    expect(tempError).not.toBeNull();
    expect(tempError?.textContent).toContain('UI bootstrap failed');
    expect(global.alert).not.toHaveBeenCalled();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load startWorld from game.json:',
      expect.any(Error)
    );
  });

  it('allows overriding the start world via test helper before beginGame', async () => {
    const logger = createLogger();
    const createdGameEngines = [];
    const tokens = { ILogger: Symbol('ILogger') };

    const stageMocks = {
      ensureCriticalDOMElementsStage: jest.fn(async (_doc, options) => {
        const bootstrapper = options.createUIBootstrapper();
        const uiElements = bootstrapper.gatherEssentialElements();
        return { success: true, payload: uiElements };
      }),
      setupDIContainerStage: jest.fn(
        async (_ui, _configureContainer, { createAppContainer }) => {
          const container = createAppContainer();
          container.resolve.mockImplementation((token) => {
            if (token === tokens.ILogger) {
              return logger;
            }
            return undefined;
          });
          return { success: true, payload: container };
        }
      ),
      resolveLoggerStage: jest.fn(async () => ({
        success: true,
        payload: { logger },
      })),
      initializeGlobalConfigStage: jest.fn(async () => ({ success: true })),
      initializeGameEngineStage: jest.fn(
        async (_container, resolvedLogger, { createGameEngine }) => {
          expect(resolvedLogger).toBe(logger);
          const engine = createGameEngine({ createdFromStage: true });
          createdGameEngines.push(engine);
          return { success: true, payload: engine };
        }
      ),
      initializeAuxiliaryServicesStage: jest.fn(async () => ({
        success: true,
      })),
      setupMenuButtonListenersStage: jest.fn(async () => ({ success: true })),
      setupGlobalEventListenersStage: jest.fn(async () => ({ success: true })),
      startGameStage: jest.fn(async () => ({ success: true })),
    };

    jest.doMock('../../../src/bootstrapper/stages/index.js', () => stageMocks);
    jest.doMock('../../../src/dependencyInjection/containerConfig.js', () => ({
      __esModule: true,
      configureContainer: jest.fn(),
    }));
    jest.doMock('../../../src/dependencyInjection/tokens.js', () => ({
      __esModule: true,
      tokens,
    }));
    const bootstrapperInstances = [];
    jest.doMock('../../../src/bootstrapper/UIBootstrapper.js', () => ({
      __esModule: true,
      UIBootstrapper: class {
        constructor() {
          this.gatherEssentialElements = jest
            .fn()
            .mockImplementation(() => createUIElements());
          bootstrapperInstances.push(this);
        }
      },
    }));
    jest.doMock('../../../src/dependencyInjection/appContainer.js', () => ({
      __esModule: true,
      default: class {
        constructor() {
          this.resolve = jest.fn();
          this.isRegistered = jest.fn().mockReturnValue(false);
        }
      },
    }));
    jest.doMock('../../../src/engine/gameEngine.js', () => ({
      __esModule: true,
      default: class {
        constructor(opts = {}) {
          Object.assign(this, opts);
          this.showLoadGameUI = jest.fn().mockResolvedValue(undefined);
        }
      },
    }));

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'alpha' }),
    });

    const { bootstrapApp, beginGame, __TEST_ONLY__setStartWorld } =
      await import('../../../src/main.js');

    await bootstrapApp();

    expect(bootstrapperInstances).toHaveLength(1);
    expect(bootstrapperInstances[0].gatherEssentialElements).toHaveBeenCalled();

    __TEST_ONLY__setStartWorld('beta');

    await beginGame();

    const engineInstance = createdGameEngines.at(-1);
    expect(stageMocks.startGameStage).toHaveBeenCalledWith(
      engineInstance,
      'beta',
      logger
    );
    expect(logger.debug).toHaveBeenCalledWith('Starting game with world: beta');
  });

  it('displays fatal error output when startGameStage fails after bootstrap', async () => {
    const logger = createLogger();
    const tokens = { ILogger: Symbol('ILogger') };
    const stageMocks = {
      ensureCriticalDOMElementsStage: jest.fn(async (_doc, options) => {
        const bootstrapper = options.createUIBootstrapper();
        const uiElements = bootstrapper.gatherEssentialElements();
        return { success: true, payload: uiElements };
      }),
      setupDIContainerStage: jest.fn(
        async (_ui, _configureContainer, { createAppContainer }) => {
          const container = createAppContainer();
          container.resolve.mockImplementation((token) => {
            if (token === tokens.ILogger) {
              return logger;
            }
            return undefined;
          });
          return { success: true, payload: container };
        }
      ),
      resolveLoggerStage: jest.fn(async () => ({
        success: true,
        payload: { logger },
      })),
      initializeGlobalConfigStage: jest.fn(async () => ({ success: true })),
      initializeGameEngineStage: jest.fn(
        async (_container, resolvedLogger, { createGameEngine }) => {
          expect(resolvedLogger).toBe(logger);
          const engine = createGameEngine({ createdFromStage: true });
          return { success: true, payload: engine };
        }
      ),
      initializeAuxiliaryServicesStage: jest.fn(async () => ({
        success: true,
      })),
      setupMenuButtonListenersStage: jest.fn(async () => ({ success: true })),
      setupGlobalEventListenersStage: jest.fn(async () => ({ success: true })),
      startGameStage: jest
        .fn()
        .mockResolvedValueOnce({
          success: false,
          error: new Error('start failure'),
        }),
    };

    jest.doMock('../../../src/bootstrapper/stages/index.js', () => stageMocks);
    jest.doMock('../../../src/dependencyInjection/containerConfig.js', () => ({
      __esModule: true,
      configureContainer: jest.fn(),
    }));
    jest.doMock('../../../src/dependencyInjection/tokens.js', () => ({
      __esModule: true,
      tokens,
    }));
    jest.doMock('../../../src/bootstrapper/UIBootstrapper.js', () => ({
      __esModule: true,
      UIBootstrapper: class {
        gatherEssentialElements() {
          return createUIElements();
        }
      },
    }));
    jest.doMock('../../../src/dependencyInjection/appContainer.js', () => ({
      __esModule: true,
      default: class {
        constructor() {
          this.resolve = jest.fn();
          this.isRegistered = jest.fn().mockReturnValue(false);
        }
      },
    }));
    jest.doMock('../../../src/engine/gameEngine.js', () => ({
      __esModule: true,
      default: class {
        constructor(opts = {}) {
          Object.assign(this, opts);
          this.showLoadGameUI = jest.fn().mockResolvedValue(undefined);
        }
      },
    }));

    // Force the fallback DOM adapter to fabricate an error element during beginGame failure
    const existingErrorDiv = document.getElementById('error-output');
    existingErrorDiv?.remove();

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'delta' }),
    });

    const { bootstrapApp, beginGame } = await import('../../../src/main.js');

    await bootstrapApp();

    await expect(beginGame()).rejects.toThrow('start failure');

    const tempError = document.getElementById('temp-startup-error');
    expect(tempError).not.toBeNull();
    expect(tempError?.textContent).toContain('start failure');
    expect(global.alert).not.toHaveBeenCalled();
  });

  it('renders fatal error when beginGame is called after a failed bootstrap', async () => {
    const logger = createLogger();
    const tokens = { ILogger: Symbol('ILogger') };
    const stageMocks = {
      ensureCriticalDOMElementsStage: jest.fn(async (_doc, options) => {
        const bootstrapper = options.createUIBootstrapper();
        const uiElements = {
          outputDiv: document.getElementById('outputDiv'),
          errorDiv: null,
          titleElement: document.querySelector('h1'),
          inputElement: document.getElementById('speech-input'),
          document,
        };
        return { success: true, payload: uiElements };
      }),
      setupDIContainerStage: jest.fn(
        async (_ui, _configureContainer, { createAppContainer }) => {
          const container = createAppContainer();
          container.resolve.mockImplementation((token) => {
            if (token === tokens.ILogger) {
              return logger;
            }
            return undefined;
          });
          return { success: true, payload: container };
        }
      ),
      resolveLoggerStage: jest.fn(async () => ({
        success: true,
        payload: { logger },
      })),
      initializeGlobalConfigStage: jest.fn(async () => ({ success: true })),
      initializeGameEngineStage: jest.fn(async () => {
        const error = new Error('engine init failure');
        error.phase = 'Game Engine Initialization';
        throw error;
      }),
      initializeAuxiliaryServicesStage: jest.fn(),
      setupMenuButtonListenersStage: jest.fn(),
      setupGlobalEventListenersStage: jest.fn(),
      startGameStage: jest.fn(),
    };

    jest.doMock('../../../src/bootstrapper/stages/index.js', () => stageMocks);
    jest.doMock('../../../src/dependencyInjection/containerConfig.js', () => ({
      __esModule: true,
      configureContainer: jest.fn(),
    }));
    jest.doMock('../../../src/dependencyInjection/tokens.js', () => ({
      __esModule: true,
      tokens,
    }));
    jest.doMock('../../../src/bootstrapper/UIBootstrapper.js', () => ({
      __esModule: true,
      UIBootstrapper: class {
        gatherEssentialElements() {
          return createUIElements();
        }
      },
    }));
    jest.doMock('../../../src/dependencyInjection/appContainer.js', () => ({
      __esModule: true,
      default: class {
        constructor() {
          this.resolve = jest.fn();
          this.isRegistered = jest.fn().mockReturnValue(false);
        }
      },
    }));
    jest.doMock('../../../src/engine/gameEngine.js', () => ({
      __esModule: true,
      default: class {
        constructor(opts = {}) {
          Object.assign(this, opts);
          this.showLoadGameUI = jest.fn();
        }
      },
    }));

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'epsilon' }),
    });

    const { bootstrapApp, beginGame } = await import('../../../src/main.js');

    await expect(bootstrapApp()).resolves.toBeUndefined();

    await expect(beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    const tempError = document.getElementById('temp-startup-error');
    expect(tempError).not.toBeNull();
    expect(tempError?.textContent).toContain('engine init failure');
    expect(global.alert).not.toHaveBeenCalled();
  });
});
