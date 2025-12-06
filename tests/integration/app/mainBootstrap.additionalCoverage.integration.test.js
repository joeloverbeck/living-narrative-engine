import { jest } from '@jest/globals';

const mockConfigureContainer = jest.fn();
const mockTokens = { ExampleToken: Symbol('ExampleToken') };

const mockUIBootstrapper = jest.fn().mockImplementation(() => ({
  gatherEssentialElements: jest.fn(),
}));

const mockAppContainer = jest.fn().mockImplementation(() => ({
  resolve: jest.fn(),
}));

const mockGameEngine = jest.fn().mockImplementation((opts = {}) => ({
  ...opts,
  logger: opts.logger,
  showLoadGameUI: jest.fn().mockResolvedValue(undefined),
}));

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

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const baseDom = `
  <div id="outputDiv"></div>
  <div id="error-output"></div>
  <input id="speech-input" />
  <h1>Title</h1>
`;

const fallbackDom = `
  <div id="outputDiv"></div>
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

beforeAll(() => {
  global.alert = jest.fn();
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  Object.values(mockStages).forEach((mockFn) => mockFn.mockReset());
  global.fetch = jest.fn();
});

describe('main bootstrap additional coverage', () => {
  it('falls back to default world when game.json fails to load', async () => {
    document.body.innerHTML = baseDom;

    const logger = createLogger();
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    global.fetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    mockStages.ensureCriticalDOMElementsStage.mockImplementation(
      async (_doc, options) => {
        const bootstrapper = options.createUIBootstrapper();
        expect(mockUIBootstrapper).toHaveBeenCalled();
        expect(bootstrapper).toBeDefined();
        return { success: true, payload: createUIElements() };
      }
    );

    mockStages.setupDIContainerStage.mockImplementation(
      async (ui, configureContainer, { createAppContainer }) => {
        expect(ui.outputDiv).toBeInstanceOf(HTMLElement);
        expect(configureContainer).toBe(mockConfigureContainer);
        const appContainer = createAppContainer();
        return { success: true, payload: appContainer };
      }
    );

    mockStages.resolveLoggerStage.mockResolvedValue({
      success: true,
      payload: { logger },
    });

    mockStages.initializeGlobalConfigStage.mockResolvedValue({ success: true });

    mockStages.initializeGameEngineStage.mockImplementation(
      async (_container, resolvedLogger, { createGameEngine }) => {
        expect(resolvedLogger).toBe(logger);
        const engine = createGameEngine({ logger: resolvedLogger });
        return { success: true, payload: engine };
      }
    );

    mockStages.initializeAuxiliaryServicesStage.mockResolvedValue({
      success: true,
    });
    mockStages.setupMenuButtonListenersStage.mockResolvedValue({
      success: true,
    });
    mockStages.setupGlobalEventListenersStage.mockResolvedValue({
      success: true,
    });
    mockStages.startGameStage.mockResolvedValue({ success: true });

    const { bootstrapApp, beginGame, __TEST_ONLY__setCurrentPhaseForError } =
      await import('../../../src/main.js');

    __TEST_ONLY__setCurrentPhaseForError('Custom Phase Before Bootstrap');

    await bootstrapApp();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load startWorld from game.json:',
      expect.any(Error)
    );

    await beginGame();

    expect(mockStages.startGameStage).toHaveBeenLastCalledWith(
      expect.any(Object),
      'default',
      logger
    );

    consoleErrorSpy.mockRestore();
  });

  it('creates fallback DOM elements when the UI validation stage fails', async () => {
    document.body.innerHTML = fallbackDom;

    const logger = createLogger();
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    global.fetch.mockRejectedValue(new Error('network offline'));

    mockStages.ensureCriticalDOMElementsStage.mockImplementation(
      async (_doc, options) => {
        options.createUIBootstrapper();
        return {
          success: false,
          error: Object.assign(new Error('UI validation failed'), {
            phase: 'UI Element Validation',
          }),
        };
      }
    );

    const { bootstrapApp } = await import('../../../src/main.js');

    await bootstrapApp();

    const fallbackElement = document.getElementById('temp-startup-error');
    expect(fallbackElement).not.toBeNull();
    expect(fallbackElement?.textContent).toContain(
      'Application failed to start'
    );
    expect(fallbackElement?.style.border).toContain('1px solid red');

    consoleErrorSpy.mockRestore();
    logger.debug.mockReset();
  });

  it('surfaces fatal error when beginGame runs without an initialized engine', async () => {
    document.body.innerHTML = baseDom;
    document.getElementById('error-output')?.remove();

    const logger = createLogger();

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'aurora' }),
    });

    mockStages.ensureCriticalDOMElementsStage.mockImplementation(
      async (_doc, options) => {
        options.createUIBootstrapper();
        return { success: true, payload: createUIElements() };
      }
    );

    mockStages.setupDIContainerStage.mockImplementation(
      async (ui, configureContainer, { createAppContainer }) => {
        expect(ui.outputDiv).toBeInstanceOf(HTMLElement);
        expect(configureContainer).toBe(mockConfigureContainer);
        return { success: true, payload: createAppContainer() };
      }
    );

    mockStages.resolveLoggerStage.mockResolvedValue({
      success: true,
      payload: { logger },
    });

    mockStages.initializeGlobalConfigStage.mockResolvedValue({ success: true });

    mockStages.initializeGameEngineStage.mockResolvedValue({
      success: false,
      error: new Error('engine initialization failed'),
    });

    const { bootstrapApp, beginGame } = await import('../../../src/main.js');

    await bootstrapApp();

    document.getElementById('temp-startup-error')?.remove();

    await expect(beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    const fallbackElement = document.getElementById('temp-startup-error');
    expect(fallbackElement).not.toBeNull();
    expect(fallbackElement?.textContent).toContain(
      'Critical: GameEngine not initialized'
    );
    expect(fallbackElement?.style.border).toContain('1px solid red');
  });

  it('reports fatal error when the start game stage fails after bootstrap', async () => {
    document.body.innerHTML = baseDom;
    document.getElementById('error-output')?.remove();

    const logger = createLogger();

    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ startWorld: 'elysium' }),
    });

    mockStages.ensureCriticalDOMElementsStage.mockImplementation(
      async (_doc, options) => {
        options.createUIBootstrapper();
        return { success: true, payload: createUIElements() };
      }
    );

    mockStages.setupDIContainerStage.mockImplementation(
      async (_ui, configureContainer, { createAppContainer }) => {
        expect(configureContainer).toBe(mockConfigureContainer);
        return { success: true, payload: createAppContainer() };
      }
    );

    mockStages.resolveLoggerStage.mockResolvedValue({
      success: true,
      payload: { logger },
    });

    mockStages.initializeGlobalConfigStage.mockResolvedValue({ success: true });

    mockStages.initializeGameEngineStage.mockImplementation(
      async (_container, resolvedLogger, { createGameEngine }) => {
        const engine = createGameEngine({ logger: resolvedLogger });
        return { success: true, payload: engine };
      }
    );

    mockStages.initializeAuxiliaryServicesStage.mockResolvedValue({
      success: true,
    });
    mockStages.setupMenuButtonListenersStage.mockResolvedValue({
      success: true,
    });
    mockStages.setupGlobalEventListenersStage.mockResolvedValue({
      success: true,
    });

    mockStages.startGameStage.mockResolvedValue({
      success: false,
      error: new Error('unable to load world'),
    });

    const { bootstrapApp, beginGame } = await import('../../../src/main.js');

    await bootstrapApp();

    await expect(beginGame()).rejects.toThrow('unable to load world');

    const fallbackElement = document.getElementById('temp-startup-error');
    expect(fallbackElement).not.toBeNull();
    expect(fallbackElement?.textContent).toContain(
      'Application failed to start'
    );
    expect(fallbackElement?.style.border).toContain('1px solid red');
  });
});
