import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';

const mockEnsureCriticalDOMElementsStage = jest.fn();
const mockSetupDIContainerStage = jest.fn();
const mockResolveLoggerStage = jest.fn();
const mockInitializeGlobalConfigStage = jest.fn();
const mockInitializeGameEngineStage = jest.fn();
const mockInitializeAuxiliaryServicesStage = jest.fn();
const mockSetupMenuButtonListenersStage = jest.fn();
const mockSetupGlobalEventListenersStage = jest.fn();
const mockStartGameStage = jest.fn();

jest.mock('../../../src/bootstrapper/stages/index.js', () => ({
  __esModule: true,
  ensureCriticalDOMElementsStage: (...args) =>
    mockEnsureCriticalDOMElementsStage(...args),
  setupDIContainerStage: (...args) => mockSetupDIContainerStage(...args),
  resolveLoggerStage: (...args) => mockResolveLoggerStage(...args),
  initializeGlobalConfigStage: (...args) =>
    mockInitializeGlobalConfigStage(...args),
  initializeGameEngineStage: (...args) =>
    mockInitializeGameEngineStage(...args),
  initializeAuxiliaryServicesStage: (...args) =>
    mockInitializeAuxiliaryServicesStage(...args),
  setupMenuButtonListenersStage: (...args) =>
    mockSetupMenuButtonListenersStage(...args),
  setupGlobalEventListenersStage: (...args) =>
    mockSetupGlobalEventListenersStage(...args),
  startGameStage: (...args) => mockStartGameStage(...args),
}));

jest.mock('../../../src/dependencyInjection/containerConfig.js', () => ({
  __esModule: true,
  configureContainer: jest.fn(),
}));

describe('main.js fatal bootstrap fallback behaviour', () => {
  const originalAlert = global.alert;
  const originalConsoleError = console.error;
  let capturedUIElements;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    capturedUIElements = undefined;

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    });

    global.alert = jest.fn();
    console.error = jest.fn();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    if (global.fetch) {
      delete global.fetch;
    }
    global.alert = originalAlert;
    console.error = originalConsoleError;
    document.body.innerHTML = '';
  });

  it('invokes alert fallback when bootstrap fails before DOM elements exist', async () => {
    const stageError = new Error('UI bootstrap failure');
    stageError.phase = 'UI Element Validation';
    stageError.failures = [
      { service: 'UIBootstrapper', error: new Error('missing output div') },
      { service: 'UIRenderer', error: new Error('no render target') },
    ];

    mockEnsureCriticalDOMElementsStage.mockResolvedValue({
      success: false,
      error: stageError,
    });

    await jest.isolateModulesAsync(async () => {
      const { StartupErrorHandler } = await import(
        '../../../src/utils/startupErrorHandler.js'
      );
      const originalDisplayFatal =
        StartupErrorHandler.prototype.displayFatalStartupError;
      const displaySpy = jest
        .spyOn(StartupErrorHandler.prototype, 'displayFatalStartupError')
        .mockImplementation(function (...args) {
          capturedUIElements = args[0];
          return originalDisplayFatal.apply(this, args);
        });

      const mainModule = await import('../../../src/main.js');

      await expect(mainModule.bootstrapApp()).resolves.toBeUndefined();

      displaySpy.mockRestore();
    });

    expect(global.alert).toHaveBeenCalledTimes(1);
    const [alertMessage] = global.alert.mock.calls[0];
    expect(alertMessage).toContain('Application failed to start');

    const loggedMessages = console.error.mock.calls.map((call) => call[0]);
    expect(loggedMessages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Failed to load startWorld from game.json'),
        expect.stringContaining(
          'main.js: Bootstrap error caught in main orchestrator.'
        ),
        expect.stringContaining('main.js: Failed to init UIBootstrapper'),
        expect.stringContaining('main.js: Failed to init UIRenderer'),
      ])
    );

    expect(capturedUIElements).toMatchObject({
      outputDiv: null,
      errorDiv: null,
      inputElement: null,
      document,
    });
  });
});
