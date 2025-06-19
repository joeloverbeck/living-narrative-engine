import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { displayFatalStartupError } from '../../src/utils/errorUtils.js';

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

    const alertSpy = jest.fn();
    const domAdapter = {
      createElement: document.createElement.bind(document),
      insertAfter: (ref, el) => ref.insertAdjacentElement('afterend', el),
      setTextContent: (el, text) => {
        el.textContent = text;
      },
      setStyle: (el, prop, val) => {
        el.style[prop] = val;
      },
      alert: alertSpy,
    };
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const result = displayFatalStartupError(
      uiElements,
      {
        userMessage: 'Oops',
        consoleMessage: 'Bad things',
        errorObject: new Error('fail'),
        pageTitle: 'Error',
        inputPlaceholder: 'halt',
        phase: 'Test',
      },
      logger,
      domAdapter
    );

    expect(result).toEqual({ displayed: true });

    expect(logger.error).toHaveBeenCalledWith(
      '[errorUtils] [Bootstrapper Error - Phase: Test] Bad things',
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

    const alertSpy = jest.fn();
    const domAdapter = {
      createElement: document.createElement.bind(document),
      insertAfter: (ref, el) => ref.insertAdjacentElement('afterend', el),
      setTextContent: (el, text) => {
        el.textContent = text;
      },
      setStyle: (el, prop, val) => {
        el.style[prop] = val;
      },
      alert: alertSpy,
    };
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const result = displayFatalStartupError(
      uiElements,
      {
        userMessage: 'Oops',
        consoleMessage: 'Bad',
      },
      logger,
      domAdapter
    );

    const tempEl = outputDiv.nextElementSibling;
    expect(tempEl).not.toBeNull();
    expect(tempEl.id).toBe('temp-startup-error');
    expect(tempEl.textContent).toBe('Oops');
    expect(logger.info).toHaveBeenCalledWith(
      '[errorUtils] displayFatalStartupError: Displayed error in a dynamically created element near outputDiv.'
    );
    expect(alertSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ displayed: true });
  });

  it('falls back to alert when no DOM targets', () => {
    setDom('');
    const alertSpy = jest.fn();
    const domAdapter = {
      createElement: document.createElement.bind(document),
      insertAfter: (ref, el) => ref.insertAdjacentElement('afterend', el),
      setTextContent: (el, text) => {
        el.textContent = text;
      },
      setStyle: (el, prop, val) => {
        el.style[prop] = val;
      },
      alert: alertSpy,
    };
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const result = displayFatalStartupError(
      {},
      {
        userMessage: 'Oops',
        consoleMessage: 'Bad',
      },
      logger,
      domAdapter
    );

    expect(alertSpy).toHaveBeenCalledWith('Oops');
    expect(logger.info).toHaveBeenCalledWith(
      '[errorUtils] displayFatalStartupError: Displayed error using alert() as a fallback.'
    );
    expect(result).toEqual({ displayed: false });
  });
});
