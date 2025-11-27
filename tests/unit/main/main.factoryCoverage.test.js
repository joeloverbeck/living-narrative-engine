import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { createMainBootstrapContainerMock } from '../../common/mockFactories/mainBootstrapContainer.js';

const bootstrapperInstances = [];
const containerInstances = [];
const engineInstances = [];
const engineConstructorArgs = [];

const mockEnsure = jest.fn();
const mockSetupDI = jest.fn();
const mockResolveCore = jest.fn();
const mockInitGlobalConfig = jest.fn();
const mockInitEngine = jest.fn();
const mockInitAux = jest.fn();
const mockMenu = jest.fn();
const mockGlobal = jest.fn();
const mockStartGame = jest.fn();
const mockDisplayFatalStartupError = jest.fn();

jest.mock('../../../src/bootstrapper/stages/index.js', () => ({
  __esModule: true,
  ensureCriticalDOMElementsStage: (...args) => mockEnsure(...args),
  setupDIContainerStage: (...args) => mockSetupDI(...args),
  resolveLoggerStage: (...args) => mockResolveCore(...args),
  initializeGlobalConfigStage: (...args) => mockInitGlobalConfig(...args),
  initializeGameEngineStage: (...args) => mockInitEngine(...args),
  initializeAuxiliaryServicesStage: (...args) => mockInitAux(...args),
  setupMenuButtonListenersStage: (...args) => mockMenu(...args),
  setupGlobalEventListenersStage: (...args) => mockGlobal(...args),
  startGameStage: (...args) => mockStartGame(...args),
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
  UIBootstrapper: class MockUIBootstrapper {
    constructor() {
      this.marker = 'ui-bootstrapper';
      bootstrapperInstances.push(this);
    }
  },
}));

jest.mock('../../../src/dependencyInjection/appContainer.js', () => ({
  __esModule: true,
  default: class MockAppContainer {
    constructor() {
      this.marker = 'app-container';
      containerInstances.push(this);
    }
  },
}));

jest.mock('../../../src/engine/gameEngine.js', () => ({
  __esModule: true,
  default: class MockGameEngine {
    constructor(opts = {}) {
      this.marker = 'game-engine';
      this.logger = opts.logger;
      this.showLoadGameUI = jest.fn().mockResolvedValue(undefined);
      engineConstructorArgs.push(opts);
      engineInstances.push(this);
    }
  },
}));

const originalAlert = global.alert;
const originalConsoleError = console.error;

/**
 *
 * @param doc
 */
function buildUiElements(doc) {
  return {
    outputDiv: doc.getElementById('outputDiv'),
    errorDiv: doc.getElementById('error-output'),
    inputElement: doc.getElementById('speech-input'),
    titleElement: doc.querySelector('h1'),
    document: doc,
  };
}

describe('main.js factory-driven bootstrap coverage', () => {
  beforeEach(() => {
    bootstrapperInstances.length = 0;
    containerInstances.length = 0;
    engineInstances.length = 0;
    engineConstructorArgs.length = 0;

    jest.resetModules();
    jest.clearAllMocks();

    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Title</h1>
      <div id="after-target"></div>
    `;

    global.alert = jest.fn();
    console.error = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ startWorld: 'default-world' }),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    if (originalAlert) {
      global.alert = originalAlert;
    } else {
      delete global.alert;
    }
    console.error = originalConsoleError;
    delete global.fetch;
  });

  it('executes stage-provided factories for UI, container, and engine setup', async () => {
    const logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ startWorld: 'factory-world' }),
    });

    mockEnsure.mockImplementation(async (doc, { createUIBootstrapper }) => {
      const uiBootstrapper = createUIBootstrapper();
      expect(uiBootstrapper.marker).toBe('ui-bootstrapper');
      return { success: true, payload: buildUiElements(doc) };
    });

    mockSetupDI.mockImplementation(async (elements, _configure, { createAppContainer }) => {
      expect(elements.outputDiv).toBe(document.getElementById('outputDiv'));
      const container = createAppContainer();
      expect(container.marker).toBe('app-container');
      // Add resolve method to container with bootstrap-required mocks
      const mockEventBus = { dispatch: jest.fn(), subscribe: jest.fn() };
      const baseContainer = createMainBootstrapContainerMock();
      container.resolve = jest.fn((token) => {
        if (token === 'IEventBus') return mockEventBus;
        return baseContainer.resolve(token);
      });
      return { success: true, payload: container };
    });

    mockResolveCore.mockImplementation(async (container) => {
      expect(container.marker).toBe('app-container');
      return { success: true, payload: { logger } };
    });

    mockInitGlobalConfig.mockResolvedValue({ success: true });

    mockInitEngine.mockImplementation(async (container, loggerArg, { createGameEngine }) => {
      expect(container.marker).toBe('app-container');
      expect(loggerArg).toBe(logger);
      const engine = createGameEngine({ stage: 'engine' });
      expect(engine.marker).toBe('game-engine');
      expect(engine.logger).toBe(logger);
      return { success: true, payload: engine };
    });

    mockInitAux.mockResolvedValue({ success: true });
    mockMenu.mockResolvedValue({ success: true });
    mockGlobal.mockResolvedValue({ success: true });

    mockStartGame.mockImplementation(async (engine, world, loggerArg) => {
      expect(engine).toBe(engineInstances[0]);
      expect(world).toBe('factory-world');
      expect(loggerArg).toBe(logger);
      return { success: true };
    });

    mockDisplayFatalStartupError.mockImplementation(() => {
      throw new Error('displayFatalStartupError should not be invoked during successful bootstrap');
    });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await expect(main.bootstrapApp()).resolves.toBeUndefined();

    expect(bootstrapperInstances).toHaveLength(1);
    expect(containerInstances).toHaveLength(1);
    expect(engineInstances).toHaveLength(1);
    expect(engineConstructorArgs[0]).toEqual(
      expect.objectContaining({ stage: 'engine', logger })
    );

    await expect(main.beginGame()).resolves.toBeUndefined();

    expect(mockStartGame).toHaveBeenCalledTimes(1);
    expect(mockDisplayFatalStartupError).not.toHaveBeenCalled();
  });

  it('reports fatal startup errors with DOM helpers when startGame stage fails', async () => {
    const logger = { debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const startError = new Error('start stage failure');

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ startWorld: 'crash-world' }),
    });

    mockEnsure.mockImplementation(async (doc, { createUIBootstrapper }) => {
      createUIBootstrapper();
      return { success: true, payload: buildUiElements(doc) };
    });

    mockSetupDI.mockImplementation(async (_elements, _configure, { createAppContainer }) => {
      const container = createAppContainer();
      // Add resolve method to container with bootstrap-required mocks
      const mockEventBus = { dispatch: jest.fn(), subscribe: jest.fn() };
      const baseContainer = createMainBootstrapContainerMock();
      container.resolve = jest.fn((token) => {
        if (token === 'IEventBus') return mockEventBus;
        return baseContainer.resolve(token);
      });
      return { success: true, payload: container };
    });

    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitGlobalConfig.mockResolvedValue({ success: true });

    mockInitEngine.mockImplementation(async (_container, _logger, { createGameEngine }) => ({
      success: true,
      payload: createGameEngine({}),
    }));

    mockInitAux.mockResolvedValue({ success: true });
    mockMenu.mockResolvedValue({ success: true });
    mockGlobal.mockResolvedValue({ success: true });

    mockStartGame.mockResolvedValue({ success: false, error: startError });

    mockDisplayFatalStartupError.mockImplementation((elements, details, loggerArg, domOps) => {
      expect(elements.outputDiv).toBe(document.getElementById('outputDiv'));
      expect(details.errorObject).toBe(startError);
      expect(details.phase).toBe('Start Game');
      expect(loggerArg).toBe(logger);

      const anchor = document.getElementById('after-target');
      const helper = document.createElement('div');
      domOps.setTextContent(helper, 'fatal error');
      domOps.setStyle(helper, 'color', 'orange');
      anchor.parentElement.insertBefore(helper, anchor);
      const created = domOps.createElement('aside');
      domOps.insertAfter(helper, created);
      expect(helper.nextSibling).toBe(created);
      domOps.alert('start-problem');
    });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();

    await expect(main.beginGame(true)).rejects.toBe(startError);

    expect(mockStartGame).toHaveBeenCalledTimes(1);
    expect(mockStartGame).toHaveBeenCalledWith(engineInstances[0], 'crash-world', logger);
    expect(engineInstances[0].showLoadGameUI).not.toHaveBeenCalled();
    expect(mockDisplayFatalStartupError).toHaveBeenCalledTimes(1);
    expect(global.alert).toHaveBeenCalledWith('start-problem');
  });
});
