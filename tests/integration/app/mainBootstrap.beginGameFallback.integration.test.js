import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

const INITIAL_DOM = `
  <div id="outputDiv"></div>
  <div id="error-output"></div>
  <input id="speech-input" />
`;

describe('main.js beginGame fallback integration', () => {
  let consoleErrorSpy;
  let getElementSpy;
  let querySelectorSpy;

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = INITIAL_DOM;
    global.alert = jest.fn();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    getElementSpy = jest.spyOn(document, 'getElementById');
    querySelectorSpy = jest.spyOn(document, 'querySelector');
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
    getElementSpy?.mockRestore();
    querySelectorSpy?.mockRestore();
    delete global.alert;
    document.body.innerHTML = '';
  });

  it('uses DOM lookups when beginGame runs before bootstrapApp', async () => {
    const { beginGame } = await import('../../../src/main.js');

    await expect(beginGame()).rejects.toThrow(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );

    expect(getElementSpy).toHaveBeenCalledWith('outputDiv');
    expect(getElementSpy).toHaveBeenCalledWith('error-output');
    expect(getElementSpy).toHaveBeenCalledWith('speech-input');

    const errorDiv = document.getElementById('error-output');
    expect(errorDiv).not.toBeNull();
    expect(errorDiv.textContent).toBe(
      'Critical: GameEngine not initialized before attempting Start Game stage.'
    );
    expect(errorDiv.style.display).toBe('block');

    const inputElement = document.getElementById('speech-input');
    expect(inputElement).not.toBeNull();
    expect(inputElement.disabled).toBe(true);
    expect(inputElement.placeholder).toBe('Application failed to start.');

    expect(global.alert).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Critical: GameEngine not initialized before attempting Start Game stage.'
      )
    );
  });
});
