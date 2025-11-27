import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';

const mockConfigureContainer = jest.fn();
const mockTokens = { ILogger: Symbol('ILogger') };

const helperInvocations = [];
const mockDisplayFatalStartupError = jest.fn((uiRefs, details, logger, helpers) => {
  if (!helpers) {
    helperInvocations.push({ executed: false });
    return;
  }

  const anchor = document.createElement('div');
  anchor.id = `anchor-${helperInvocations.length}`;
  document.body.appendChild(anchor);

  const element = helpers.createElement('section');
  helpers.setTextContent(element, details.consoleMessage || details.userMessage);
  helpers.setStyle(element, 'color', 'crimson');
  helpers.insertAfter(anchor, element);
  helpers.alert(`alert:${details.phase}`);

  helperInvocations.push({
    executed: true,
    insertedSibling: anchor.nextElementSibling,
    text: element.textContent,
    color: element.style.color,
    tagName: element.tagName,
    uiRefs,
    logger,
    details,
  });
});

const uiBootstrapperInstances = [];
const mockUIBootstrapper = jest.fn().mockImplementation(() => {
  const instance = { gatherEssentialElements: jest.fn() };
  uiBootstrapperInstances.push(instance);
  return instance;
});

const appContainerInstances = [];
const mockAppContainer = jest.fn().mockImplementation(() => {
  const instance = { resolve: jest.fn() };
  appContainerInstances.push(instance);
  return instance;
});

const gameEngineInstances = [];
const mockGameEngine = jest.fn().mockImplementation((opts = {}) => {
  const instance = {
    ...opts,
    logger: opts.logger,
    showLoadGameUI: jest.fn().mockResolvedValue(undefined),
  };
  gameEngineInstances.push(instance);
  return instance;
});

const mockStages = {
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

jest.mock('../../../src/dependencyInjection/containerConfig.js', () => ({
  __esModule: true,
  configureContainer: mockConfigureContainer,
}));

jest.mock('../../../src/dependencyInjection/tokens.js', () => ({
  __esModule: true,
  tokens: mockTokens,
}));

jest.mock('../../../src/utils/errorUtils.js', () => ({
  __esModule: true,
  displayFatalStartupError: mockDisplayFatalStartupError,
}));

jest.mock('../../../src/bootstrapper/UIBootstrapper.js', () => ({
  __esModule: true,
  UIBootstrapper: mockUIBootstrapper,
}));

jest.mock('../../../src/dependencyInjection/appContainer.js', () => ({
  __esModule: true,
  default: mockAppContainer,
}));

jest.mock('../../../src/engine/gameEngine.js', () => ({
  __esModule: true,
  default: mockGameEngine,
}));

jest.mock('../../../src/bootstrapper/stages/index.js', () => mockStages);

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

const configureSuccessfulStages = () => {
  const uiElements = createUIElements();
  const eventBus = { subscribe: jest.fn() }; // Mock EventBus for cache invalidation
  // Mock handler validator and registry for startup completeness validation
  const mockHandlerValidator = {
    validateHandlerRegistryCompleteness: jest.fn().mockReturnValue({
      isComplete: true,
      missingHandlers: [],
      orphanedHandlers: [],
    }),
  };
  const mockOperationRegistry = {
    getRegisteredTypes: jest.fn().mockReturnValue([]),
  };
  const container = {
    resolve: jest.fn((token) => {
      // Return eventBus when IEventBus token is requested
      if (token === 'IEventBus' || token?.includes?.('EventBus')) {
        return eventBus;
      }
      // Return handler validator for startup completeness validation
      if (token === 'HandlerCompletenessValidator') {
        return mockHandlerValidator;
      }
      // Return operation registry for startup completeness validation
      if (token === 'OperationRegistry') {
        return mockOperationRegistry;
      }
      return undefined;
    }),
  };
  const logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };

  mockStages.ensureCriticalDOMElementsStage.mockResolvedValue({
    success: true,
    payload: uiElements,
  });
  mockStages.setupDIContainerStage.mockResolvedValue({
    success: true,
    payload: container,
  });
  mockStages.resolveLoggerStage.mockResolvedValue({
    success: true,
    payload: { logger },
  });
  mockStages.initializeGlobalConfigStage.mockResolvedValue({ success: true });
  mockStages.initializeGameEngineStage.mockResolvedValue({
    success: true,
    payload: gameEngineInstances.at(-1) || {
      showLoadGameUI: jest.fn().mockResolvedValue(undefined),
    },
  });
  mockStages.initializeAuxiliaryServicesStage.mockResolvedValue({ success: true });
  mockStages.setupMenuButtonListenersStage.mockResolvedValue({ success: true });
  mockStages.setupGlobalEventListenersStage.mockResolvedValue({ success: true });
  mockStages.startGameStage.mockResolvedValue({ success: true });

  return { uiElements, container, logger };
};

const importMainModule = async () => {
  return import('../../../src/main.js');
};

describe('main.js integration failure coverage', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.resetModules();
    Object.values(mockStages).forEach((mockFn) => mockFn.mockReset());
    helperInvocations.length = 0;
    mockDisplayFatalStartupError.mockClear();
    uiBootstrapperInstances.length = 0;
    appContainerInstances.length = 0;
    gameEngineInstances.length = 0;
    document.body.innerHTML = baseDom;
    global.alert = jest.fn();
    global.fetch = jest.fn();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
    delete global.alert;
  });

  it('starts with the default world when configuration omits startWorld', async () => {
    const { logger } = configureSuccessfulStages();
    const engine = { showLoadGameUI: jest.fn().mockResolvedValue(undefined) };
    mockStages.initializeGameEngineStage.mockResolvedValue({
      success: true,
      payload: engine,
    });

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const { bootstrapApp, beginGame } = await importMainModule();

    await bootstrapApp();

    expect(mockDisplayFatalStartupError).not.toHaveBeenCalled();

    await beginGame();

    expect(mockStages.startGameStage).toHaveBeenCalledWith(engine, 'default', logger);
    expect(engine.showLoadGameUI).not.toHaveBeenCalled();
  });

  const failureScenarios = [
    {
      name: 'DI container setup failure',
      stage: 'setupDIContainerStage',
      phase: 'DI Container Setup',
      hasLogger: false,
      buildError: () => new Error('Container stage failed'),
    },
    {
      name: 'logger resolution failure',
      stage: 'resolveLoggerStage',
      phase: 'Core Services Resolution',
      hasLogger: false,
      buildError: () => new Error('Logger stage failed'),
    },
    {
      name: 'global configuration initialization failure',
      stage: 'initializeGlobalConfigStage',
      phase: 'Global Configuration Initialization',
      hasLogger: true,
      buildError: () => new Error('Config stage failed'),
    },
    {
      name: 'game engine initialization failure',
      stage: 'initializeGameEngineStage',
      phase: 'Game Engine Initialization',
      hasLogger: true,
      buildError: () => new Error('Engine stage failed'),
    },
    {
      name: 'menu listener setup failure',
      stage: 'setupMenuButtonListenersStage',
      phase: 'Menu Button Listeners Setup',
      hasLogger: true,
      buildError: () => {
        const error = new Error('Menu stage failed');
        error.failures = [
          { service: 'MenuService', error: new Error('handler missing') },
        ];
        return error;
      },
    },
    {
      name: 'global event listener setup failure',
      stage: 'setupGlobalEventListenersStage',
      phase: 'Global Event Listeners Setup',
      hasLogger: true,
      buildError: () => new Error('Global events stage failed'),
    },
  ];

  describe.each(failureScenarios)('$name', ({ stage, phase, hasLogger, buildError }) => {
    it('reports the stage failure with helper utilities', async () => {
      const { logger, uiElements } = configureSuccessfulStages();
      const engine = { showLoadGameUI: jest.fn().mockResolvedValue(undefined) };
      mockStages.initializeGameEngineStage.mockResolvedValue({
        success: true,
        payload: engine,
      });

      const stageError = buildError();
      mockStages[stage].mockResolvedValueOnce({ success: false, error: stageError });

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({ startWorld: 'ember' }),
      });

      const { bootstrapApp } = await importMainModule();

      await bootstrapApp();

      expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
      expect(helperInvocations).toHaveLength(1);

      const helperResult = helperInvocations[0];
      expect(helperResult.executed).toBe(true);
      expect(helperResult.insertedSibling).toBeInstanceOf(HTMLElement);
      expect(helperResult.text).toContain('Critical error');
      expect(helperResult.color).toBe('crimson');
      expect(helperResult.tagName).toBe('SECTION');

      const [uiRefs, details, loggerArg] = mockDisplayFatalStartupError.mock.calls[0];
      expect(details.phase).toContain(stageError.phase || phase);
      expect(uiRefs).toBe(uiElements);

      if (hasLogger) {
        expect(loggerArg).toBe(logger);
        expect(logger.error).toHaveBeenCalledWith(
          expect.stringContaining('Bootstrap error caught in main orchestrator'),
          stageError,
        );
      } else {
        expect(loggerArg).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Bootstrap error caught in main orchestrator'),
          stageError,
        );
      }

      if (Array.isArray(stageError.failures)) {
        for (const failure of stageError.failures) {
          const logSpy = hasLogger ? logger.error : consoleErrorSpy;
          expect(logSpy).toHaveBeenCalledWith(
            `main.js: Failed to init ${failure.service}`,
            failure.error,
          );
        }
      }
    });
  });
});
