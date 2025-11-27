import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { createMainBootstrapContainerMock } from '../../common/mockFactories/mainBootstrapContainer.js';

const mockEnsure = jest.fn();
const mockSetupDI = jest.fn();
const mockResolveCore = jest.fn();
const mockInitGlobalConfig = jest.fn();
const mockInitEngine = jest.fn();
const mockInitAux = jest.fn();
const mockMenu = jest.fn();
const mockGlobal = jest.fn();
const mockStartGame = jest.fn();
const mockDisplayFatal = jest.fn();

const mockUIBootstrapperCtor = jest.fn(() => ({ marker: 'ui-bootstrapper' }));
const mockAppContainerCtor = jest.fn(() => ({ marker: 'app-container' }));
const createdGameEngines = [];
const mockGameEngineCtor = jest.fn(function MockGameEngineConstructor(opts) {
  Object.assign(this, opts, {
    createdAt: Date.now(),
    showLoadGameUI: jest.fn().mockResolvedValue(undefined),
  });
  createdGameEngines.push(this);
});

jest.mock('../../../src/bootstrapper/stages/index.js', () => ({
  __esModule: true,
  ensureCriticalDOMElementsStage: (...args) => mockEnsure(...args),
  setupDIContainerStage: (...args) => mockSetupDI(...args),
  resolveLoggerStage: (...args) => mockResolveCore(...args),
  initializeGlobalConfigStage: (...args) => mockInitGlobalConfig(...args),
  initializeGameEngineStage: (...args) => mockInitEngine(...args),
  setupMenuButtonListenersStage: (...args) => mockMenu(...args),
  setupGlobalEventListenersStage: (...args) => mockGlobal(...args),
  startGameStage: (...args) => mockStartGame(...args),
  initializeAuxiliaryServicesStage: (...args) => mockInitAux(...args),
}));

jest.mock('../../../src/utils/errorUtils.js', () => ({
  __esModule: true,
  displayFatalStartupError: (...args) => mockDisplayFatal(...args),
}));

jest.mock('../../../src/dependencyInjection/containerConfig.js', () => ({
  __esModule: true,
  configureContainer: jest.fn(),
}));

const MockUIBootstrapper = jest.fn(function MockUIBootstrapper() {
  return mockUIBootstrapperCtor();
});

const MockAppContainer = jest.fn(function MockAppContainer() {
  return mockAppContainerCtor();
});

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
  default: mockGameEngineCtor,
}));

describe('main.js inline factory and fallback coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createdGameEngines.length = 0;
    document.body.innerHTML = '';
    delete global.fetch;
    global.alert = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetModules();
    jest.clearAllTimers();
    delete global.fetch;
    delete global.alert;
  });

  it('executes inline factories and supports beginGame success flow with load UI', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ startWorld: 'andromeda' }),
    });

    const outputDiv = document.createElement('div');
    outputDiv.id = 'outputDiv';
    const errorDiv = document.createElement('div');
    errorDiv.id = 'error-output';
    const input = document.createElement('input');
    input.id = 'speech-input';
    const heading = document.createElement('h1');
    document.body.append(outputDiv, errorDiv, input, heading);

    const uiElements = {
      outputDiv,
      errorDiv,
      inputElement: input,
      titleElement: heading,
      document,
    };

    const logger = { debug: jest.fn(), info: jest.fn(), error: jest.fn(), warn: jest.fn() };

    let createdEngine;

    mockEnsure.mockImplementation(async (_doc, options) => {
      expect(typeof options.createUIBootstrapper).toBe('function');
      const bootstrapper = options.createUIBootstrapper();
      expect(bootstrapper).toEqual({ marker: 'ui-bootstrapper' });
      return { success: true, payload: uiElements };
    });

    mockSetupDI.mockImplementation(async (_elements, _config, options) => {
      expect(typeof options.createAppContainer).toBe('function');
      const container = options.createAppContainer();
      expect(container).toEqual({ marker: 'app-container' });
      // Return a container with proper resolve method for handler completeness validation
      const baseContainer = createMainBootstrapContainerMock();
      return { success: true, payload: { ...container, resolve: baseContainer.resolve } };
    });

    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitGlobalConfig.mockResolvedValue({ success: true });

    mockInitEngine.mockImplementation(async (_container, resolvedLogger, options) => {
      expect(resolvedLogger).toBe(logger);
      expect(typeof options.createGameEngine).toBe('function');
      createdEngine = options.createGameEngine({ bootstrap: true });
      expect(createdEngine.bootstrap).toBe(true);
      expect(createdGameEngines).toContain(createdEngine);
      return { success: true, payload: createdEngine };
    });

    mockInitAux.mockResolvedValue({ success: true });
    mockMenu.mockResolvedValue({ success: true });
    mockGlobal.mockResolvedValue({ success: true });

    mockStartGame.mockImplementation(async (engine, worldName, providedLogger) => {
      expect(engine).toBe(createdEngine);
      expect(worldName).toBe('andromeda');
      expect(providedLogger).toBe(logger);
      return { success: true };
    });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    main.__TEST_ONLY__setCurrentPhaseForError('coverage-phase');

    await main.bootstrapApp();
    expect(mockInitEngine).toHaveBeenCalledTimes(1);
    expect(mockDisplayFatal).not.toHaveBeenCalled();
    await main.beginGame(true);

    expect(mockStartGame).toHaveBeenCalledTimes(1);
    expect(createdEngine.showLoadGameUI).toHaveBeenCalledTimes(1);
    expect(mockDisplayFatal).not.toHaveBeenCalled();
  });

  it('invokes fallback DOM helpers when bootstrap fails early', async () => {
    const errorDiv = document.createElement('div');
    errorDiv.id = 'error-output';
    const outputDiv = document.createElement('div');
    outputDiv.id = 'outputDiv';
    const input = document.createElement('input');
    input.id = 'speech-input';
    const heading = document.createElement('h1');
    document.body.append(outputDiv, errorDiv, input, heading);

    const bootstrapFailure = Object.assign(new Error('ui failure'), {
      phase: 'UI Element Validation',
      failures: [
        { service: 'Alpha', error: new Error('alpha') },
        { service: 'Beta', error: new Error('beta') },
      ],
    });

    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    mockEnsure.mockResolvedValue({ success: false, error: bootstrapFailure });

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await main.bootstrapApp();

    expect(mockSetupDI).not.toHaveBeenCalled();
    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);

    const [, errorDetails, passedLogger, domHelpers] = mockDisplayFatal.mock.calls[0];
    expect(errorDetails.errorObject).toBe(bootstrapFailure);
    expect(passedLogger).toBeNull();

    const helperElement = domHelpers.createElement('section');
    expect(helperElement.tagName).toBe('SECTION');

    const ref = document.createElement('div');
    const parent = document.createElement('div');
    parent.appendChild(ref);
    const newNode = document.createElement('span');
    domHelpers.insertAfter(ref, newNode);
    expect(parent.lastChild).toBe(newNode);

    domHelpers.setTextContent(newNode, 'hello');
    expect(newNode.textContent).toBe('hello');

    domHelpers.setStyle(newNode, 'color', 'purple');
    expect(newNode.style.color).toBe('purple');

    const alertSpy = global.alert;
    domHelpers.alert('boom');
    expect(alertSpy).toHaveBeenCalledWith('boom');

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('invokes beginGame fallback helpers when engine is missing', async () => {
    const outputDiv = document.createElement('div');
    outputDiv.id = 'outputDiv';
    const errorDiv = document.createElement('div');
    errorDiv.id = 'error-output';
    const input = document.createElement('input');
    input.id = 'speech-input';
    const heading = document.createElement('h1');
    document.body.append(outputDiv, errorDiv, input, heading);

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    let main;
    await jest.isolateModulesAsync(async () => {
      main = await import('../../../src/main.js');
    });

    await expect(main.beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);

    const [, , , domHelpers] = mockDisplayFatal.mock.calls[0];
    const helperElement = domHelpers.createElement('article');
    expect(helperElement.tagName).toBe('ARTICLE');

    const ref = document.createElement('div');
    const container = document.createElement('div');
    container.appendChild(ref);
    const sibling = document.createElement('span');
    domHelpers.insertAfter(ref, sibling);
    expect(container.lastChild).toBe(sibling);

    domHelpers.setTextContent(sibling, 'fallback');
    expect(sibling.textContent).toBe('fallback');

    domHelpers.setStyle(sibling, 'fontWeight', 'bold');
    expect(sibling.style.fontWeight).toBe('bold');

    const alertSpy = global.alert;
    domHelpers.alert('notify');
    expect(alertSpy).toHaveBeenCalledWith('notify');

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
