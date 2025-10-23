import { jest, describe, it, afterEach, expect } from '@jest/globals';

const mockDisplayFatal = jest.fn();

jest.mock('../../../src/utils/errorUtils.js', () => ({
  __esModule: true,
  displayFatalStartupError: (...args) => mockDisplayFatal(...args),
}));

jest.mock('../../../src/bootstrapper/stages', () => ({
  __esModule: true,
  ensureCriticalDOMElementsStage: jest.fn(() => ({
    success: true,
    payload: {},
  })),
  setupDIContainerStage: jest.fn(() => ({ success: true, payload: {} })),
  resolveLoggerStage: jest.fn(() => ({
    success: true,
    payload: { logger: null },
  })),
  initializeGameEngineStage: jest.fn(() => ({ success: true, payload: null })),
  initializeAuxiliaryServicesStage: jest.fn(() => ({ success: true })),
  setupMenuButtonListenersStage: jest.fn(() => ({ success: true })),
  setupGlobalEventListenersStage: jest.fn(() => ({ success: true })),
  startGameStage: jest.fn(() => ({ success: true })),
}));

jest.mock('../../../src/dependencyInjection/containerConfig.js', () => ({
  __esModule: true,
  configureContainer: jest.fn(),
}));

afterEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  document.body.innerHTML = '';
});

describe('main.js beginGame without bootstrap', () => {
  it('displays fatal error when gameEngine is missing', async () => {
    document.body.innerHTML = `
      <div id="outputDiv"></div>
      <div id="error-output"></div>
      <input id="speech-input" />
      <h1>Title</h1>`;
    const main = await import('../../../src/main.js');
    await expect(main.beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized'
    );
    expect(mockDisplayFatal).toHaveBeenCalledTimes(1);
    const [elements, details] = mockDisplayFatal.mock.calls[0];
    // beginGame now provides fallback UI elements when uiElements is undefined
    expect(elements).toMatchObject({
      outputDiv: expect.anything(),
      errorDiv: expect.anything(),
      titleElement: expect.anything(),
      inputElement: expect.anything(),
      document: expect.anything(),
    });
    expect(details.phase).toBe('Start Game');
  });
});
