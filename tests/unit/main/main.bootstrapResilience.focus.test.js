import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

const mockStageImplementations = {
  ensureCriticalDOMElementsStage: jest.fn(),
  setupDIContainerStage: jest.fn(),
  resolveLoggerStage: jest.fn(),
  initializeGlobalConfigStage: jest.fn(),
  initializeGameEngineStage: jest.fn(),
  initializeAuxiliaryServicesStage: jest.fn(),
  setupMenuButtonListenersStage: jest.fn(),
  setupGlobalEventListenersStage: jest.fn(),
  startGameStage: jest.fn(),
};

const mockDisplayFatalStartupError = jest.fn();

const MockUIBootstrapper = jest.fn();
const MockAppContainer = jest.fn(function MockAppContainer() {
  this._created = true;
});
const MockGameEngine = jest.fn(function MockGameEngine(opts = {}) {
  Object.assign(this, opts);
});

jest.mock('../../../src/bootstrapper/stages/index.js', () => ({
  __esModule: true,
  ensureCriticalDOMElementsStage: (...args) =>
    mockStageImplementations.ensureCriticalDOMElementsStage(...args),
  setupDIContainerStage: (...args) =>
    mockStageImplementations.setupDIContainerStage(...args),
  resolveLoggerStage: (...args) =>
    mockStageImplementations.resolveLoggerStage(...args),
  initializeGlobalConfigStage: (...args) =>
    mockStageImplementations.initializeGlobalConfigStage(...args),
  initializeGameEngineStage: (...args) =>
    mockStageImplementations.initializeGameEngineStage(...args),
  initializeAuxiliaryServicesStage: (...args) =>
    mockStageImplementations.initializeAuxiliaryServicesStage(...args),
  setupMenuButtonListenersStage: (...args) =>
    mockStageImplementations.setupMenuButtonListenersStage(...args),
  setupGlobalEventListenersStage: (...args) =>
    mockStageImplementations.setupGlobalEventListenersStage(...args),
  startGameStage: (...args) => mockStageImplementations.startGameStage(...args),
}));

jest.mock('../../../src/utils/errorUtils.js', () => ({
  __esModule: true,
  displayFatalStartupError: (...args) => mockDisplayFatalStartupError(...args),
}));

jest.mock('../../../src/dependencyInjection/containerConfig.js', () => ({
  __esModule: true,
  configureContainer: jest.fn(),
}));

jest.mock('../../../src/bootstrapper/UIBootstrapper.js', () => ({
  __esModule: true,
  UIBootstrapper: MockUIBootstrapper,
}));

jest.mock('../../../src/dependencyInjection/appContainer.js', () => ({
  __esModule: true,
  default: MockAppContainer,
}));

jest.mock('../../../src/engine/gameEngine.js', () => ({
  __esModule: true,
  default: MockGameEngine,
}));

const originalFetch = global.fetch;
const originalConsoleError = console.error;
const originalAlert = global.alert;

/**
 *
 */
function resetStageMocks() {
  Object.values(mockStageImplementations).forEach((mockFn) =>
    mockFn.mockReset()
  );
}

/**
 *
 */
function makeUiElements() {
  return {
    outputDiv: document.getElementById('outputDiv'),
    errorDiv: document.getElementById('error-output'),
    inputElement: /** @type {HTMLInputElement | null} */ (
      document.getElementById('speech-input')
    ),
    titleElement: document.querySelector('h1'),
    document,
  };
}

/**
 *
 * @param root0
 * @param root0.uiElements
 * @param root0.logger
 * @param root0.gameEngine
 */
function configureHappyPathStages({ uiElements, logger, gameEngine }) {
  mockStageImplementations.ensureCriticalDOMElementsStage.mockResolvedValue({
    success: true,
    payload: uiElements,
  });
  mockStageImplementations.setupDIContainerStage.mockResolvedValue({
    success: true,
    payload: {},
  });
  mockStageImplementations.resolveLoggerStage.mockResolvedValue({
    success: true,
    payload: { logger },
  });
  mockStageImplementations.initializeGlobalConfigStage.mockResolvedValue({
    success: true,
  });
  mockStageImplementations.initializeGameEngineStage.mockResolvedValue({
    success: true,
    payload: gameEngine,
  });
  mockStageImplementations.initializeAuxiliaryServicesStage.mockResolvedValue({
    success: true,
  });
  mockStageImplementations.setupMenuButtonListenersStage.mockResolvedValue({
    success: true,
  });
  mockStageImplementations.setupGlobalEventListenersStage.mockResolvedValue({
    success: true,
  });
  mockStageImplementations.startGameStage.mockResolvedValue({ success: true });
}

describe('main.js focused bootstrap coverage', () => {
  beforeEach(() => {
    resetStageMocks();
    mockDisplayFatalStartupError.mockReset();
    MockUIBootstrapper.mockClear();
    MockAppContainer.mockClear();
    MockGameEngine.mockClear();
    global.fetch = jest.fn();
    console.error = jest.fn();
    global.alert = jest.fn();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    if (originalFetch === undefined) {
      delete global.fetch;
    } else {
      global.fetch = originalFetch;
    }
    console.error = originalConsoleError;
    if (originalAlert === undefined) {
      delete global.alert;
    } else {
      global.alert = originalAlert;
    }
    document.body.innerHTML = '';
  });

  it('boots successfully from fetched startWorld and supports optional load UI', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Title</h1>
    `;

    const logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const gameEngine = {
      showLoadGameUI: jest.fn().mockResolvedValue(undefined),
    };
    const uiElements = makeUiElements();

    mockStageImplementations.ensureCriticalDOMElementsStage.mockImplementation(
      async (_doc, factories) => {
        const bootstrapper = factories.createUIBootstrapper();
        expect(MockUIBootstrapper).toHaveBeenCalledTimes(1);
        expect(bootstrapper).toBeInstanceOf(MockUIBootstrapper);
        return { success: true, payload: uiElements };
      }
    );

    mockStageImplementations.setupDIContainerStage.mockImplementation(
      async (_elements, _configure, { createAppContainer }) => {
        const container = createAppContainer();
        expect(container).toBeInstanceOf(MockAppContainer);
        return { success: true, payload: container };
      }
    );

    mockStageImplementations.resolveLoggerStage.mockResolvedValue({
      success: true,
      payload: { logger },
    });

    mockStageImplementations.initializeGlobalConfigStage.mockResolvedValue({
      success: true,
    });

    mockStageImplementations.initializeGameEngineStage.mockImplementation(
      async (_container, _logger, { createGameEngine }) => {
        const created = createGameEngine({ initial: 'state' });
        expect(created).toBeInstanceOf(MockGameEngine);
        return { success: true, payload: gameEngine };
      }
    );

    mockStageImplementations.initializeAuxiliaryServicesStage.mockResolvedValue(
      { success: true }
    );
    mockStageImplementations.setupMenuButtonListenersStage.mockResolvedValue({
      success: true,
    });
    mockStageImplementations.setupGlobalEventListenersStage.mockResolvedValue({
      success: true,
    });
    mockStageImplementations.startGameStage.mockResolvedValue({
      success: true,
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ startWorld: 'campaign-world' }),
    });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();
    main.__TEST_ONLY__setCurrentPhaseForError('Post-Bootstrap Phase');

    expect(
      mockStageImplementations.ensureCriticalDOMElementsStage
    ).toHaveBeenCalledWith(
      document,
      expect.objectContaining({ createUIBootstrapper: expect.any(Function) })
    );
    expect(
      mockStageImplementations.setupGlobalEventListenersStage
    ).toHaveBeenCalledTimes(1);

    await main.beginGame(true);

    expect(mockStageImplementations.startGameStage).toHaveBeenCalledWith(
      gameEngine,
      'campaign-world',
      logger
    );
    const loadUISpy = gameEngine.showLoadGameUI;
    expect(loadUISpy).toHaveBeenCalledTimes(1);

    main.__TEST_ONLY__setStartWorld('secondary-world');
    gameEngine.showLoadGameUI = undefined;

    await main.beginGame(true);

    expect(mockStageImplementations.startGameStage).toHaveBeenLastCalledWith(
      gameEngine,
      'secondary-world',
      logger
    );
    expect(loadUISpy).toHaveBeenCalledTimes(1);
    expect(mockDisplayFatalStartupError).not.toHaveBeenCalled();

    main.__TEST_ONLY__setStartWorld(undefined);
    await main.beginGame();
    expect(mockStageImplementations.startGameStage).toHaveBeenLastCalledWith(
      gameEngine,
      'default',
      logger
    );
  });

  it('surfaces auxiliary stage failures and logs nested failures after fetch rejection', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Title</h1>
    `;

    const logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const uiElements = makeUiElements();

    mockStageImplementations.ensureCriticalDOMElementsStage.mockResolvedValue({
      success: true,
      payload: uiElements,
    });
    mockStageImplementations.setupDIContainerStage.mockResolvedValue({
      success: true,
      payload: {},
    });
    mockStageImplementations.resolveLoggerStage.mockResolvedValue({
      success: true,
      payload: { logger },
    });
    mockStageImplementations.initializeGlobalConfigStage.mockResolvedValue({
      success: true,
    });
    mockStageImplementations.initializeGameEngineStage.mockResolvedValue({
      success: true,
      payload: {},
    });

    const stageError = new Error('Aux failure');
    stageError.failures = [
      { service: 'CacheWarmup', error: new Error('cache boom') },
      { service: 'MetricsCollector', error: new Error('metrics boom') },
    ];

    mockStageImplementations.initializeAuxiliaryServicesStage.mockResolvedValue(
      {
        success: false,
        error: stageError,
      }
    );
    mockStageImplementations.setupMenuButtonListenersStage.mockResolvedValue({
      success: true,
    });
    mockStageImplementations.setupGlobalEventListenersStage.mockResolvedValue({
      success: true,
    });
    mockStageImplementations.startGameStage.mockResolvedValue({
      success: true,
    });

    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();

    expect(console.error).toHaveBeenCalledWith(
      'Failed to load startWorld from game.json:',
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      'main.js: Bootstrap error caught in main orchestrator. Error Phase: "Bootstrap Orchestration - Auxiliary Services Initialization"',
      stageError
    );
    expect(logger.error).toHaveBeenCalledWith(
      'main.js: Failed to init CacheWarmup',
      stageError.failures[0].error
    );
    expect(logger.error).toHaveBeenCalledWith(
      'main.js: Failed to init MetricsCollector',
      stageError.failures[1].error
    );
    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);

    const [, errorDetails] = mockDisplayFatalStartupError.mock.calls[0];
    expect(errorDetails.phase).toBe(
      'Bootstrap Orchestration - Auxiliary Services Initialization'
    );
    expect(mockStageImplementations.startGameStage).not.toHaveBeenCalled();
  });

  describe('handles individual bootstrap stage failures', () => {
    const failureScenarios = [
      {
        label: 'DI container stage failure',
        expectedPhase: 'Bootstrap Orchestration - DI Container Setup',
        expectLoggerError: false,
        applyFailure({ stageError }) {
          mockStageImplementations.setupDIContainerStage.mockResolvedValue({
            success: false,
            error: stageError,
          });
        },
      },
      {
        label: 'logger resolution failure',
        expectedPhase: 'Bootstrap Orchestration - Core Services Resolution',
        expectLoggerError: false,
        applyFailure({ stageError }) {
          mockStageImplementations.resolveLoggerStage.mockResolvedValue({
            success: false,
            error: stageError,
          });
        },
      },
      {
        label: 'global configuration failure',
        expectedPhase:
          'Bootstrap Orchestration - Global Configuration Initialization',
        expectLoggerError: true,
        applyFailure({ stageError }) {
          mockStageImplementations.initializeGlobalConfigStage.mockResolvedValue(
            {
              success: false,
              error: stageError,
            }
          );
        },
      },
      {
        label: 'game engine initialization failure',
        expectedPhase: 'Bootstrap Orchestration - Game Engine Initialization',
        expectLoggerError: true,
        applyFailure({ stageError }) {
          mockStageImplementations.initializeGameEngineStage.mockResolvedValue({
            success: false,
            error: stageError,
          });
        },
      },
      {
        label: 'menu listener setup failure',
        expectedPhase: 'Bootstrap Orchestration - Menu Button Listeners Setup',
        expectLoggerError: true,
        applyFailure({ stageError }) {
          mockStageImplementations.setupMenuButtonListenersStage.mockResolvedValue(
            {
              success: false,
              error: stageError,
            }
          );
        },
      },
      {
        label: 'global listener setup failure',
        expectedPhase: 'Bootstrap Orchestration - Global Event Listeners Setup',
        expectLoggerError: true,
        applyFailure({ stageError }) {
          mockStageImplementations.setupGlobalEventListenersStage.mockResolvedValue(
            {
              success: false,
              error: stageError,
            }
          );
        },
      },
    ];

    it.each(failureScenarios)(
      'handles %s',
      async ({ expectedPhase, expectLoggerError, applyFailure }) => {
        document.body.innerHTML = `
        <div id="outputDiv"></div>
        <div id="error-output"></div>
        <input id="speech-input" />
        <h1>Title</h1>
      `;

        const logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
        const gameEngine = {};
        const uiElements = makeUiElements();
        configureHappyPathStages({ uiElements, logger, gameEngine });
        const stageError = new Error('Stage failure');
        applyFailure({ stageError, logger, gameEngine });

        global.fetch.mockResolvedValue({
          ok: true,
          json: jest.fn().mockResolvedValue({ startWorld: 'alpha' }),
        });

        let main;
        await jest.isolateModulesAsync(async () => {
          main = await import('../../../src/main.js');
        });

        await main.bootstrapApp();

        expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
        const [, errorDetails] = mockDisplayFatalStartupError.mock.calls[0];
        expect(errorDetails.phase).toBe(expectedPhase);

        const expectedLogMessage = `main.js: Bootstrap error caught in main orchestrator. Error Phase: "${expectedPhase}"`;

        if (expectLoggerError) {
          expect(logger.error).toHaveBeenCalledWith(
            expectedLogMessage,
            stageError
          );
        } else {
          expect(logger.error).not.toHaveBeenCalled();
          expect(console.error).toHaveBeenCalledWith(
            expectedLogMessage,
            stageError
          );
        }
      }
    );

    it('falls back to application runtime phase when current phase is cleared', async () => {
      document.body.innerHTML = `
        <div id="outputDiv"></div>
        <div id="error-output"></div>
        <input id="speech-input" />
        <h1>Title</h1>
      `;

      const logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
      const gameEngine = {};
      const uiElements = makeUiElements();
      configureHappyPathStages({ uiElements, logger, gameEngine });
      const stageError = new Error('post-bootstrap failure');

      let mainModule;
      mockStageImplementations.initializeAuxiliaryServicesStage.mockImplementation(
        async () => {
          mainModule.__TEST_ONLY__setCurrentPhaseForError(null);
          return { success: false, error: stageError };
        }
      );

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ startWorld: 'alpha' }),
      });

      await jest.isolateModulesAsync(async () => {
        mainModule = await import('../../../src/main.js');
      });

      await mainModule.bootstrapApp();

      const [, errorDetails] = mockDisplayFatalStartupError.mock.calls[0];
      expect(errorDetails.phase).toBe(
        'Bootstrap Orchestration - Application Logic/Runtime'
      );
      expect(logger.error).toHaveBeenCalledWith(
        'main.js: Bootstrap error caught in main orchestrator. Error Phase: "Bootstrap Orchestration - Application Logic/Runtime"',
        stageError
      );
    });

    it('falls back to core services resolution when logger stage fails without phase', async () => {
      document.body.innerHTML = `
        <div id="outputDiv"></div>
        <div id="error-output"></div>
        <input id="speech-input" />
        <h1>Title</h1>
      `;

      const logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
      const gameEngine = {};
      const uiElements = makeUiElements();
      configureHappyPathStages({ uiElements, logger, gameEngine });
      const stageError = new Error('logger resolution failure');

      let mainModule;
      mockStageImplementations.resolveLoggerStage.mockImplementation(
        async () => {
          mainModule.__TEST_ONLY__setCurrentPhaseForError(null);
          return { success: false, error: stageError };
        }
      );

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ startWorld: 'alpha' }),
      });

      await jest.isolateModulesAsync(async () => {
        mainModule = await import('../../../src/main.js');
      });

      await mainModule.bootstrapApp();

      const [, errorDetails] = mockDisplayFatalStartupError.mock.calls[0];
      expect(errorDetails.phase).toBe(
        'Bootstrap Orchestration - Core Services Resolution'
      );
      expect(console.error).toHaveBeenCalledWith(
        'main.js: Bootstrap error caught in main orchestrator. Error Phase: "Bootstrap Orchestration - Core Services Resolution"',
        stageError
      );
    });

    it('falls back to DI container setup when phase is cleared before container stage fails', async () => {
      document.body.innerHTML = `
        <div id="outputDiv"></div>
        <div id="error-output"></div>
        <input id="speech-input" />
        <h1>Title</h1>
      `;

      const logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
      const gameEngine = {};
      const uiElements = makeUiElements();
      configureHappyPathStages({ uiElements, logger, gameEngine });
      const stageError = new Error('container failure');

      let mainModule;
      mockStageImplementations.setupDIContainerStage.mockImplementation(
        async () => {
          mainModule.__TEST_ONLY__setCurrentPhaseForError(null);
          return { success: false, error: stageError };
        }
      );

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ startWorld: 'alpha' }),
      });

      await jest.isolateModulesAsync(async () => {
        mainModule = await import('../../../src/main.js');
      });

      await mainModule.bootstrapApp();

      const [, errorDetails] = mockDisplayFatalStartupError.mock.calls[0];
      expect(errorDetails.phase).toBe(
        'Bootstrap Orchestration - DI Container Setup'
      );
      expect(console.error).toHaveBeenCalledWith(
        'main.js: Bootstrap error caught in main orchestrator. Error Phase: "Bootstrap Orchestration - DI Container Setup"',
        stageError
      );
    });

    it('falls back to UI element validation when initial phase is cleared', async () => {
      document.body.innerHTML = '';

      const logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
      const gameEngine = {};
      configureHappyPathStages({
        uiElements: {
          outputDiv: null,
          errorDiv: null,
          inputElement: null,
          titleElement: null,
          document,
        },
        logger,
        gameEngine,
      });
      const stageError = new Error('ui failure');

      let mainModule;
      mockStageImplementations.ensureCriticalDOMElementsStage.mockImplementation(
        async () => {
          mainModule.__TEST_ONLY__setCurrentPhaseForError(null);
          return { success: false, error: stageError };
        }
      );

      global.fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ startWorld: 'alpha' }),
      });

      await jest.isolateModulesAsync(async () => {
        mainModule = await import('../../../src/main.js');
      });

      await mainModule.bootstrapApp();

      const [, errorDetails] = mockDisplayFatalStartupError.mock.calls[0];
      expect(errorDetails.phase).toBe(
        'Bootstrap Orchestration - UI Element Validation'
      );
      expect(console.error).toHaveBeenCalledWith(
        'main.js: Bootstrap error caught in main orchestrator. Error Phase: "Bootstrap Orchestration - UI Element Validation"',
        stageError
      );
    });
  });

  it('falls back to DOM lookups when critical UI validation fails', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Fallback</h1>
    `;

    mockStageImplementations.ensureCriticalDOMElementsStage.mockResolvedValue({
      success: false,
      error: Object.assign(new Error('ui missing'), {
        phase: 'UI Element Validation',
      }),
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
    });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();

    expect(console.error).toHaveBeenCalledWith(
      'main.js: Bootstrap error caught in main orchestrator. Error Phase: "UI Element Validation"',
      expect.any(Error)
    );

    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [fallbackElements, errorDetails, , domHelpers] =
      mockDisplayFatalStartupError.mock.calls[0];
    expect(errorDetails.phase).toBe('UI Element Validation');
    expect(fallbackElements.outputDiv).toBe(
      document.getElementById('outputDiv')
    );
    expect(fallbackElements.errorDiv).toBe(
      document.getElementById('error-output')
    );
    expect(fallbackElements.inputElement).toBe(
      document.getElementById('speech-input')
    );

    const helperElement = domHelpers.createElement('section');
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    domHelpers.insertAfter(anchor, helperElement);
    domHelpers.setTextContent(helperElement, 'fallback-text');
    domHelpers.setStyle(helperElement, 'color', 'red');
  });

  it('throws when beginGame runs without a bootstrapped engine', async () => {
    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    main.__TEST_ONLY__setCurrentPhaseForError('Manual Phase');

    await expect(main.beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );
    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [, errorDetails, , domHelpers] =
      mockDisplayFatalStartupError.mock.calls[0];
    expect(errorDetails.phase).toBe('Start Game');

    const helperNode = domHelpers.createElement('article');
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    domHelpers.insertAfter(anchor, helperNode);
    domHelpers.setTextContent(helperNode, 'engine missing');
    domHelpers.setStyle(helperNode, 'fontWeight', 'bold');
  });

  it('surfaces start game failures and rethrows with preserved context', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Title</h1>
    `;

    const logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const gameEngine = {};
    const uiElements = makeUiElements();

    mockStageImplementations.ensureCriticalDOMElementsStage.mockResolvedValue({
      success: true,
      payload: uiElements,
    });
    mockStageImplementations.setupDIContainerStage.mockResolvedValue({
      success: true,
      payload: {},
    });
    mockStageImplementations.resolveLoggerStage.mockResolvedValue({
      success: true,
      payload: { logger },
    });
    mockStageImplementations.initializeGlobalConfigStage.mockResolvedValue({
      success: true,
    });
    mockStageImplementations.initializeGameEngineStage.mockResolvedValue({
      success: true,
      payload: gameEngine,
    });
    mockStageImplementations.initializeAuxiliaryServicesStage.mockResolvedValue(
      { success: true }
    );
    mockStageImplementations.setupMenuButtonListenersStage.mockResolvedValue({
      success: true,
    });
    mockStageImplementations.setupGlobalEventListenersStage.mockResolvedValue({
      success: true,
    });

    const startError = new Error('could not start');
    mockStageImplementations.startGameStage.mockResolvedValue({
      success: false,
      error: startError,
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ startWorld: 'initial-world' }),
    });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();
    main.__TEST_ONLY__setStartWorld('override-world');

    await expect(main.beginGame(true)).rejects.toThrow(startError);

    expect(mockStageImplementations.startGameStage).toHaveBeenCalledWith(
      gameEngine,
      'override-world',
      logger
    );
    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    const [, errorDetails, , domHelpers] =
      mockDisplayFatalStartupError.mock.calls[0];
    expect(errorDetails.phase).toBe('Start Game');
    expect(errorDetails.errorObject).toBe(startError);

    const helperEl = domHelpers.createElement('div');
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    domHelpers.insertAfter(anchor, helperEl);
    domHelpers.setTextContent(helperEl, 'start failure');
    domHelpers.setStyle(helperEl, 'border', '1px solid black');
  });
});
