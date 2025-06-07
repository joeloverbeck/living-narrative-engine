import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { displayFatalStartupError } from '../../src/bootstrapper/errorUtils.js';

/**
 * Helper to set HTML content for each test.
 *
 * @param {string} html - HTML snippet to inject into document.body.
 */
function setDom(html) {
  document.body.innerHTML = html;
}

describe('displayFatalStartupError', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  it('displays message and updates provided elements', () => {
    setDom(`
      <div id="outputDiv"></div>
      <div id="errorDiv"></div>
      <input id="inputEl" />
      <h1 id="title"></h1>
    `);
    const uiElements = {
      outputDiv: document.querySelector('#outputDiv'),
      errorDiv: document.querySelector('#errorDiv'),
      inputElement: document.querySelector('#inputEl'),
      titleElement: document.querySelector('#title'),
    };

    const alertSpy = jest.spyOn(global, 'alert').mockImplementation(() => {});
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    displayFatalStartupError(uiElements, {
      userMessage: 'Oops',
      consoleMessage: 'Bad things',
      errorObject: new Error('fail'),
      pageTitle: 'Error',
      inputPlaceholder: 'halt',
      phase: 'Test',
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Bootstrapper Error - Phase: Test] Bad things',
      expect.any(Error)
    );
    const errorDiv = uiElements.errorDiv;
    expect(errorDiv.textContent).toBe('Oops');
    expect(errorDiv.style.display).toBe('block');
    expect(uiElements.titleElement.textContent).toBe('Error');
    expect(uiElements.inputElement.disabled).toBe(true);
    expect(uiElements.inputElement.placeholder).toBe('halt');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('creates temporary element when errorDiv missing', () => {
    setDom('<div id="outputDiv"></div>');
    const outputDiv = document.querySelector('#outputDiv');
    const uiElements = { outputDiv };

    const alertSpy = jest.spyOn(global, 'alert').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    displayFatalStartupError(uiElements, {
      userMessage: 'Oops',
      consoleMessage: 'Bad',
    });

    const tempEl = outputDiv.nextElementSibling;
    expect(tempEl).not.toBeNull();
    expect(tempEl.id).toBe('temp-startup-error');
    expect(tempEl.textContent).toBe('Oops');
    expect(logSpy).toHaveBeenCalledWith(
      'displayFatalStartupError: Displayed error in a dynamically created element near outputDiv.'
    );
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('falls back to alert when no DOM targets', () => {
    setDom('');
    const alertSpy = jest.spyOn(global, 'alert').mockImplementation(() => {});
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    displayFatalStartupError(
      {},
      {
        userMessage: 'Oops',
        consoleMessage: 'Bad',
      }
    );

    expect(alertSpy).toHaveBeenCalledWith('Oops');
    expect(logSpy).toHaveBeenCalledWith(
      'displayFatalStartupError: Displayed error using alert() as a fallback.'
    );
  });
});
