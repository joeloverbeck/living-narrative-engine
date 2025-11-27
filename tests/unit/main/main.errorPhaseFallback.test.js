import { jest, describe, it, expect, afterEach } from '@jest/globals';
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

/**
 *
 */
function createUiElements() {
  document.body.innerHTML = `
    <div id="outputDiv"></div>
    <div id="error-output"></div>
    <input id="speech-input" />
    <h1>Title</h1>
  `;
  return {
    outputDiv: document.querySelector('#outputDiv'),
    errorDiv: document.querySelector('#error-output'),
    inputElement: document.querySelector('#speech-input'),
    titleElement: document.querySelector('h1'),
    document,
  };
}

describe('main.js error phase fallbacks', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    document.body.innerHTML = '';
    delete global.fetch;
  });

  it('prefers runtime fallback when all bootstrap services resolved', async () => {
    const uiElements = createUiElements();
    const logger = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    let setPhaseForTest;

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: createMainBootstrapContainerMock() });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitGlobalConfig.mockResolvedValue({ success: true });
    mockInitEngine.mockResolvedValue({
      success: true,
      payload: { showLoadGameUI: jest.fn(), start: jest.fn() },
    });
    mockMenu.mockResolvedValue({ success: true });
    mockGlobal.mockResolvedValue({ success: true });
    const stageError = new Error('aux failure');
    mockInitAux.mockImplementation(async () => {
      stageError.phase = '';
      if (setPhaseForTest) {
        setPhaseForTest(null);
      }
      return { success: false, error: stageError };
    });

    await jest.isolateModulesAsync(async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ startWorld: 'eden' }),
      });
      const main = await import('../../../src/main.js');
      setPhaseForTest = main.__TEST_ONLY__setCurrentPhaseForError;
      await main.bootstrapApp();

      const [, errorDetails, passedLogger] = mockDisplayFatal.mock.calls[0];
      expect(errorDetails.phase).toBe(
        'Bootstrap Orchestration - Application Logic/Runtime'
      );
      expect(passedLogger).toBe(logger);
    });
  });

  it('falls back to core services resolution when logger is absent', async () => {
    const uiElements = createUiElements();
    let setPhaseForTest;

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: createMainBootstrapContainerMock() });
    const stageError = new Error('logger failure');
    mockResolveCore.mockImplementation(async () => {
      stageError.phase = '';
      if (setPhaseForTest) {
        setPhaseForTest(null);
      }
      return { success: false, error: stageError };
    });

    await jest.isolateModulesAsync(async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      const main = await import('../../../src/main.js');
      setPhaseForTest = main.__TEST_ONLY__setCurrentPhaseForError;
      await main.bootstrapApp();

      const [, errorDetails, passedLogger] = mockDisplayFatal.mock.calls[0];
      expect(errorDetails.phase).toBe(
        'Bootstrap Orchestration - Core Services Resolution'
      );
      expect(passedLogger).toBeNull();
    });
  });

  it('falls back to DI container setup when only UI elements resolved', async () => {
    const uiElements = createUiElements();
    let setPhaseForTest;

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    const stageError = new Error('di failure');
    mockSetupDI.mockImplementation(async () => {
      stageError.phase = '';
      if (setPhaseForTest) {
        setPhaseForTest(null);
      }
      return { success: false, error: stageError };
    });

    await jest.isolateModulesAsync(async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      const main = await import('../../../src/main.js');
      setPhaseForTest = main.__TEST_ONLY__setCurrentPhaseForError;
      await main.bootstrapApp();

      const [, errorDetails, passedLogger] = mockDisplayFatal.mock.calls[0];
      expect(errorDetails.phase).toBe(
        'Bootstrap Orchestration - DI Container Setup'
      );
      expect(passedLogger).toBeNull();
    });
  });

  it('defaults to UI element validation when no stages succeed', async () => {
    createUiElements();
    let setPhaseForTest;
    const stageError = new Error('ui failure');
    mockEnsure.mockImplementation(async () => {
      stageError.phase = '';
      if (setPhaseForTest) {
        setPhaseForTest(null);
      }
      return { success: false, error: stageError };
    });

    await jest.isolateModulesAsync(async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });
      const main = await import('../../../src/main.js');
      setPhaseForTest = main.__TEST_ONLY__setCurrentPhaseForError;
      await main.bootstrapApp();

      const [fallbackElements, errorDetails, passedLogger] =
        mockDisplayFatal.mock.calls[0];
      expect(fallbackElements.outputDiv).toBeInstanceOf(HTMLElement);
      expect(fallbackElements.errorDiv).toBeInstanceOf(HTMLElement);
      expect(fallbackElements.inputElement).toBeInstanceOf(HTMLElement);
      expect(fallbackElements.document).toBe(document);
      expect(errorDetails.phase).toBe(
        'Bootstrap Orchestration - UI Element Validation'
      );
      expect(passedLogger).toBeNull();
    });
  });

  it('evaluates load UI branch regardless of game engine implementation', async () => {
    const uiElements = createUiElements();
    const logger = { info: jest.fn(), debug: jest.fn(), error: jest.fn(), warn: jest.fn() };
    const gameEngine = {
      showLoadGameUI: jest.fn(),
    };

    mockEnsure.mockResolvedValue({ success: true, payload: uiElements });
    mockSetupDI.mockResolvedValue({ success: true, payload: createMainBootstrapContainerMock() });
    mockResolveCore.mockResolvedValue({ success: true, payload: { logger } });
    mockInitGlobalConfig.mockResolvedValue({ success: true });
    mockInitEngine.mockResolvedValue({ success: true, payload: gameEngine });
    mockInitAux.mockResolvedValue({ success: true });
    mockMenu.mockResolvedValue({ success: true });
    mockGlobal.mockResolvedValue({ success: true });
    mockStartGame.mockResolvedValue({ success: true });

    await jest.isolateModulesAsync(async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ startWorld: 'eden' }),
      });
      const main = await import('../../../src/main.js');
      await main.bootstrapApp();

      await main.beginGame(true);
      expect(gameEngine.showLoadGameUI).toHaveBeenCalledTimes(1);

      mockDisplayFatal.mockClear();
      gameEngine.showLoadGameUI = undefined;
      await main.beginGame(true);
      expect(mockDisplayFatal).not.toHaveBeenCalled();
    });
  });
});
