import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';

const createEssentialElements = () => {
  const outputDiv = document.createElement('div');
  outputDiv.id = 'outputDiv';
  document.body.appendChild(outputDiv);

  const errorDiv = document.createElement('div');
  errorDiv.id = 'error-output';
  document.body.appendChild(errorDiv);

  const titleElement = document.createElement('h1');
  document.body.appendChild(titleElement);

  const inputElement = document.createElement('input');
  inputElement.id = 'speech-input';
  document.body.appendChild(inputElement);

  return { outputDiv, errorDiv, titleElement, inputElement, document };
};

describe('main.js bootstrap orchestration', () => {
  let originalFetch;
  let originalAlert;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    originalFetch = global.fetch;
    originalAlert = global.alert;
    global.alert = jest.fn();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.alert = originalAlert;
    document.body.innerHTML = '';
  });

  /**
   *
   * @param root0
   * @param root0.fetchImpl
   * @param root0.stageImplementations
   * @param root0.tokens
   * @param root0.logger
   * @param root0.gameEngineInstance
   */
  async function loadMain({
    fetchImpl,
    stageImplementations = {},
    tokens = {},
    logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() },
    gameEngineInstance = { showLoadGameUI: jest.fn() },
  } = {}) {
    const essentialUI = createEssentialElements();
    const containerInstance = {
      id: 'container',
      resolve: jest.fn().mockReturnValue({
        validateHandlerRegistryCompleteness: jest.fn().mockReturnValue({ isComplete: true }),
      }),
    };

    const defaultStages = {
      ensureCriticalDOMElementsStage: jest.fn(async (_doc, options) => {
        if (options && typeof options.createUIBootstrapper === 'function') {
          options.createUIBootstrapper();
        }
        return {
          success: true,
          payload: essentialUI,
        };
      }),
      setupDIContainerStage: jest.fn(async (_uiElements, configureFn, options, loggerLike) => {
        if (typeof configureFn === 'function') {
          configureFn();
        }
        if (options && typeof options.createAppContainer === 'function') {
          options.createAppContainer();
        }
        if (loggerLike && typeof loggerLike.log === 'function') {
          loggerLike.log('DI container configured');
        }
        return {
          success: true,
          payload: containerInstance,
        };
      }),
      resolveLoggerStage: jest.fn(async () => ({
        success: true,
        payload: { logger },
      })),
      initializeGlobalConfigStage: jest.fn(async () => ({ success: true })),
      initializeGameEngineStage: jest.fn(async (_container, _logger, { createGameEngine }) => {
        createGameEngine({ bootstrap: true });
        return { success: true, payload: gameEngineInstance };
      }),
      initializeAuxiliaryServicesStage: jest.fn(async () => ({ success: true })),
      setupMenuButtonListenersStage: jest.fn(async () => ({ success: true })),
      setupGlobalEventListenersStage: jest.fn(async () => ({ success: true })),
      startGameStage: jest.fn(async () => ({ success: true })),
    };

    const stageMocks = { ...defaultStages, ...stageImplementations };

    const displayFatalStartupError = jest.fn();

    const fetchMock =
      fetchImpl ||
      jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ startWorld: 'custom-world' }),
        status: 200,
        statusText: 'OK',
      });

    global.fetch = fetchMock;

    let importedModule;

    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../src/utils/errorUtils.js', () => ({
        displayFatalStartupError,
      }));
      jest.doMock('../../src/dependencyInjection/containerConfig.js', () => ({
        configureContainer: jest.fn(),
      }));
      jest.doMock('../../src/dependencyInjection/tokens.js', () => ({ tokens }));
      const UIBootstrapper = jest.fn();
      jest.doMock('../../src/bootstrapper/UIBootstrapper.js', () => ({ UIBootstrapper }));
      const AppContainer = jest.fn();
      jest.doMock('../../src/dependencyInjection/appContainer.js', () => ({
        __esModule: true,
        default: AppContainer,
      }));
      const GameEngine = jest.fn(() => gameEngineInstance);
      jest.doMock('../../src/engine/gameEngine.js', () => ({
        __esModule: true,
        default: GameEngine,
      }));
      jest.doMock('../../src/bootstrapper/stages/index.js', () => stageMocks);

      importedModule = await import('../../src/main.js');
    });

    return {
      module: importedModule,
      stageMocks,
      displayFatalStartupError,
      fetchMock,
      logger,
      gameEngineInstance,
      essentialUI,
    };
  }

  /**
   *
   * @param helpers
   * @param tag
   */
  function exerciseHelperUtilities(helpers, tag = 'div') {
    const anchor = document.createElement('div');
    document.body.appendChild(anchor);
    const element = helpers.createElement(tag);
    helpers.insertAfter(anchor, element);
    helpers.setTextContent(element, `helper executed: ${tag}`);
    helpers.setStyle(element, 'data-helper', tag);
    helpers.alert(`helper alert: ${tag}`);
    return element;
  }

  it('completes bootstrap and begins the game with the configured world and optional UI', async () => {
    const fetchResponse = {
      ok: true,
      json: async () => ({ startWorld: 'custom-world' }),
      status: 200,
      statusText: 'OK',
    };

    const { module, stageMocks, displayFatalStartupError, logger, gameEngineInstance } =
      await loadMain({ fetchImpl: jest.fn().mockResolvedValue(fetchResponse) });

    await module.bootstrapApp();

    expect(stageMocks.ensureCriticalDOMElementsStage).toHaveBeenCalledTimes(1);
    expect(stageMocks.setupDIContainerStage).toHaveBeenCalledWith(
      expect.objectContaining({ outputDiv: expect.any(HTMLElement) }),
      expect.any(Function),
      expect.objectContaining({ createAppContainer: expect.any(Function) }),
      console,
    );

    await module.beginGame(true);

    expect(stageMocks.startGameStage).toHaveBeenCalledWith(gameEngineInstance, 'custom-world', logger);
    expect(gameEngineInstance.showLoadGameUI).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('Starting game with world: custom-world');
    expect(displayFatalStartupError).not.toHaveBeenCalled();
  });

  it('surfaces auxiliary stage failures and logs chained service errors', async () => {
    const stageError = new Error('Auxiliary bootstrap failure');
    stageError.phase = 'Auxiliary Services Initialization';
    stageError.failures = [
      { service: 'CacheWarmup', error: new Error('cache error') },
      { service: 'MetricsCollector', error: new Error('metrics error') },
    ];

    const initializeAuxiliaryServicesStage = jest.fn(async () => ({
      success: false,
      error: stageError,
    }));

    const {
      module,
      stageMocks,
      displayFatalStartupError,
      logger,
      essentialUI,
    } = await loadMain({ stageImplementations: { initializeAuxiliaryServicesStage } });

    await module.bootstrapApp();

    expect(stageMocks.initializeAuxiliaryServicesStage).toHaveBeenCalledTimes(1);
    expect(displayFatalStartupError).toHaveBeenCalledTimes(1);

    const [uiElementsArg, errorDetails, loggerArg, helpers] = displayFatalStartupError.mock.calls[0];
    expect(uiElementsArg).toBe(essentialUI);
    expect(errorDetails.phase).toBe('Auxiliary Services Initialization');
    expect(errorDetails.errorObject).toBe(stageError);
    expect(loggerArg).toBe(logger);
    expect(helpers).toEqual(
      expect.objectContaining({
        createElement: expect.any(Function),
        insertAfter: expect.any(Function),
        setTextContent: expect.any(Function),
        setStyle: expect.any(Function),
        alert: expect.any(Function),
      }),
    );

    exerciseHelperUtilities(helpers, 'span');

    expect(logger.error).toHaveBeenCalledWith(
      'main.js: Bootstrap error caught in main orchestrator. Error Phase: "Auxiliary Services Initialization"',
      stageError,
    );
    expect(logger.error).toHaveBeenCalledWith('main.js: Failed to init CacheWarmup', stageError.failures[0].error);
    expect(logger.error).toHaveBeenCalledWith(
      'main.js: Failed to init MetricsCollector',
      stageError.failures[1].error,
    );
  });

  it('reports fatal error when beginGame is invoked before bootstrapApp', async () => {
    const { module, displayFatalStartupError } = await loadMain();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(module.beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.',
    );

    expect(displayFatalStartupError).toHaveBeenCalledTimes(1);
    const [uiElementsArg, errorDetails, loggerArg, helpers] =
      displayFatalStartupError.mock.calls[0];
    expect(uiElementsArg).toEqual(
      expect.objectContaining({
        outputDiv: expect.any(HTMLElement),
        errorDiv: expect.any(HTMLElement),
        inputElement: expect.any(HTMLElement),
        document,
      })
    );
    expect(errorDetails.phase).toBe('Start Game');
    expect(loggerArg).toBeNull();
    expect(helpers).toEqual(
      expect.objectContaining({
        createElement: expect.any(Function),
        insertAfter: expect.any(Function),
        setTextContent: expect.any(Function),
        setStyle: expect.any(Function),
        alert: expect.any(Function),
      }),
    );
    exerciseHelperUtilities(helpers, 'section');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'main.js: Critical: GameEngine not initialized before attempting Start Game stage.',
    );

    consoleErrorSpy.mockRestore();
  });

  it('uses default world when configuration fetch fails and surfaces start errors', async () => {
    const fetchFailure = jest
      .fn()
      .mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });
    const startFailure = new Error('start failed');
    startFailure.phase = 'Start Game';

    const startGameStage = jest.fn(async () => ({ success: false, error: startFailure }));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { module, stageMocks, displayFatalStartupError, logger, gameEngineInstance } = await loadMain({
      fetchImpl: fetchFailure,
      stageImplementations: { startGameStage },
    });

    await module.bootstrapApp();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load startWorld from game.json:',
      expect.any(Error),
    );

    await expect(module.beginGame()).rejects.toThrow(startFailure);
    expect(stageMocks.startGameStage).toHaveBeenCalledWith(gameEngineInstance, 'default', logger);
    expect(logger.debug).toHaveBeenCalledWith('Starting game with world: default');
    expect(gameEngineInstance.showLoadGameUI).not.toHaveBeenCalled();

    expect(displayFatalStartupError).toHaveBeenCalledTimes(1);
    const [uiElementsArg, errorDetails, loggerArg, helperFns] = displayFatalStartupError.mock.calls[0];
    expect(uiElementsArg).toEqual(
      expect.objectContaining({
        outputDiv: expect.any(HTMLElement),
        errorDiv: expect.any(HTMLElement),
      }),
    );
    expect(loggerArg).toBe(logger);
    expect(errorDetails.phase).toBe('Start Game');
    exerciseHelperUtilities(helperFns, 'div');

    consoleErrorSpy.mockRestore();
  });

  it('propagates logger resolution failures and reports the core services phase', async () => {
    let setPhase;
    const loggerResolutionError = new Error('logger unavailable');

    const resolveLoggerStage = jest.fn(async () => {
      if (setPhase) {
        setPhase(undefined);
      }
      return { success: false, error: loggerResolutionError };
    });

    const { module, displayFatalStartupError, stageMocks } = await loadMain({
      stageImplementations: { resolveLoggerStage },
    });

    setPhase = module.__TEST_ONLY__setCurrentPhaseForError;

    await module.bootstrapApp();

    expect(stageMocks.resolveLoggerStage).toHaveBeenCalledTimes(1);
    const [uiElementsArg, errorDetails, loggerArg, helpers] = displayFatalStartupError.mock.calls[0];
    expect(uiElementsArg).toEqual(expect.objectContaining({ outputDiv: expect.any(HTMLElement) }));
    expect(loggerArg).toBeNull();
    expect(errorDetails.phase).toBe('Bootstrap Orchestration - Core Services Resolution');
    exerciseHelperUtilities(helpers, 'core');
  });

  it('surfaces global configuration initialization errors', async () => {
    const configError = new Error('config stage failed');
    const initializeGlobalConfigStage = jest.fn(async () => ({
      success: false,
      error: configError,
    }));

    const { module, displayFatalStartupError, stageMocks, logger } = await loadMain({
      stageImplementations: { initializeGlobalConfigStage },
    });

    await module.bootstrapApp();

    expect(stageMocks.initializeGlobalConfigStage).toHaveBeenCalledTimes(1);
    const [uiElementsArg, errorDetails, loggerArg, helpers] = displayFatalStartupError.mock.calls[0];
    expect(uiElementsArg).toEqual(expect.objectContaining({ outputDiv: expect.any(HTMLElement) }));
    expect(loggerArg).toBe(logger);
    expect(errorDetails.phase).toBe('Bootstrap Orchestration - Global Configuration Initialization');
    exerciseHelperUtilities(helpers, 'config');
  });

  it('captures game engine initialization failures', async () => {
    const engineError = new Error('engine instantiation failed');
    const initializeGameEngineStage = jest.fn(async (_container, _logger, { createGameEngine }) => {
      if (typeof createGameEngine === 'function') {
        createGameEngine({ cause: 'failure path' });
      }
      return { success: false, error: engineError };
    });

    const { module, displayFatalStartupError, stageMocks, logger } = await loadMain({
      stageImplementations: { initializeGameEngineStage },
    });

    await module.bootstrapApp();

    expect(stageMocks.initializeGameEngineStage).toHaveBeenCalledTimes(1);
    const [uiElementsArg, errorDetails, loggerArg, helpers] = displayFatalStartupError.mock.calls[0];
    expect(uiElementsArg).toEqual(expect.objectContaining({ outputDiv: expect.any(HTMLElement) }));
    expect(loggerArg).toBe(logger);
    expect(errorDetails.phase).toBe('Bootstrap Orchestration - Game Engine Initialization');
    exerciseHelperUtilities(helpers, 'engine');
  });

  it('alerts when menu button listener setup fails', async () => {
    const menuError = new Error('menu listeners failed');
    const setupMenuButtonListenersStage = jest.fn(async () => ({
      success: false,
      error: menuError,
    }));

    const { module, displayFatalStartupError, stageMocks, logger } = await loadMain({
      stageImplementations: { setupMenuButtonListenersStage },
    });

    await module.bootstrapApp();

    expect(stageMocks.setupMenuButtonListenersStage).toHaveBeenCalledTimes(1);
    const [uiElementsArg, errorDetails, loggerArg, helpers] = displayFatalStartupError.mock.calls[0];
    expect(uiElementsArg).toEqual(expect.objectContaining({ outputDiv: expect.any(HTMLElement) }));
    expect(loggerArg).toBe(logger);
    expect(errorDetails.phase).toBe('Bootstrap Orchestration - Menu Button Listeners Setup');
    exerciseHelperUtilities(helpers, 'menu');
  });

  it('treats global event listener failures as runtime issues', async () => {
    let setPhase;
    const globalError = new Error('global listeners failed');
    const setupGlobalEventListenersStage = jest.fn(async () => {
      if (setPhase) {
        setPhase(undefined);
      }
      return { success: false, error: globalError };
    });

    const { module, displayFatalStartupError, stageMocks, logger } = await loadMain({
      stageImplementations: { setupGlobalEventListenersStage },
    });

    setPhase = module.__TEST_ONLY__setCurrentPhaseForError;

    await module.bootstrapApp();

    expect(stageMocks.setupGlobalEventListenersStage).toHaveBeenCalledTimes(1);
    const [uiElementsArg, errorDetails, loggerArg, helpers] = displayFatalStartupError.mock.calls[0];
    expect(uiElementsArg).toEqual(expect.objectContaining({ outputDiv: expect.any(HTMLElement) }));
    expect(loggerArg).toBe(logger);
    expect(errorDetails.phase).toBe('Bootstrap Orchestration - Application Logic/Runtime');
    exerciseHelperUtilities(helpers, 'global');
  });

  it('begins the game without load UI support when the engine lacks the optional hook', async () => {
    const fetchResponse = {
      ok: true,
      json: async () => ({ startWorld: 'scenario-world' }),
      status: 200,
      statusText: 'OK',
    };

    const gameEngineInstance = { showLoadGameUI: undefined };

    const { module, stageMocks, logger } = await loadMain({
      fetchImpl: jest.fn().mockResolvedValue(fetchResponse),
      gameEngineInstance,
    });

    await module.bootstrapApp();
    await module.beginGame(true);

    expect(stageMocks.startGameStage).toHaveBeenCalledWith(gameEngineInstance, 'scenario-world', logger);
  });

  it('defaults to the fallback world when configuration omits startWorld', async () => {
    const fetchResponse = {
      ok: true,
      json: async () => ({}),
      status: 200,
      statusText: 'OK',
    };

    const { module, stageMocks, logger, gameEngineInstance } = await loadMain({
      fetchImpl: jest.fn().mockResolvedValue(fetchResponse),
    });

    await module.bootstrapApp();
    await module.beginGame();

    expect(stageMocks.startGameStage).toHaveBeenCalledWith(gameEngineInstance, 'default', logger);
  });

  it('derives detected phase when DI container setup fails without explicit metadata', async () => {
    let setPhase;
    const diError = new Error('container wiring failed');

    const setupDIContainerStage = jest.fn(async () => {
      if (setPhase) {
        setPhase(undefined);
      }
      return { success: false, error: diError };
    });

    const { module, displayFatalStartupError, stageMocks } = await loadMain({
      stageImplementations: { setupDIContainerStage },
    });

    setPhase = module.__TEST_ONLY__setCurrentPhaseForError;

    await module.bootstrapApp();

    expect(stageMocks.setupDIContainerStage).toHaveBeenCalledTimes(1);
    const [uiElementsArg, errorDetails, loggerArg, helperFns] = displayFatalStartupError.mock.calls[0];
    expect(uiElementsArg).toEqual(
      expect.objectContaining({ outputDiv: expect.any(HTMLElement) }),
    );
    expect(loggerArg).toBeNull();
    expect(errorDetails.phase).toBe('Bootstrap Orchestration - DI Container Setup');
    exerciseHelperUtilities(helperFns, 'p');
  });

  it('falls back to default UI handles when critical DOM validation fails', async () => {
    let setPhase;
    const uiError = new Error('missing elements');
    const ensureCriticalDOMElementsStage = jest.fn(async () => {
      if (setPhase) {
        setPhase(undefined);
      }
      return { success: false, error: uiError };
    });

    const { module, displayFatalStartupError } = await loadMain({
      stageImplementations: { ensureCriticalDOMElementsStage },
    });

    setPhase = module.__TEST_ONLY__setCurrentPhaseForError;

    await module.bootstrapApp();

    expect(displayFatalStartupError).toHaveBeenCalledTimes(1);
    const [uiElementsArg, errorDetails, loggerArg, helperFns] = displayFatalStartupError.mock.calls[0];
    expect(uiElementsArg).toEqual(
      expect.objectContaining({
        outputDiv: document.getElementById('outputDiv'),
        errorDiv: document.getElementById('error-output'),
      }),
    );
    expect(errorDetails.errorObject).toBe(uiError);
    expect(loggerArg).toBeNull();
    exerciseHelperUtilities(helperFns, 'aside');
  });
});
