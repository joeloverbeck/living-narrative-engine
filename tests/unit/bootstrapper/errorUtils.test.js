import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { displayFatalStartupError } from '../../../src/utils/errorUtils.js';

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

  it('displays message and updates provided elements, and dispatches error if dispatcher is provided', () => {
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
    const dispatcher = { dispatch: jest.fn() };

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
      domAdapter,
      dispatcher
    );

    expect(result).toEqual({ displayed: true });

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        message: expect.stringContaining('Bad things'),
        details: expect.any(Object),
      })
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
    const dispatcher = { dispatch: jest.fn() };

    const result = displayFatalStartupError(
      uiElements,
      {
        userMessage: 'Oops',
        consoleMessage: 'Bad',
      },
      logger,
      domAdapter,
      dispatcher
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
    const dispatcher = { dispatch: jest.fn() };

    const result = displayFatalStartupError(
      {},
      {
        userMessage: 'Oops',
        consoleMessage: 'Bad',
      },
      logger,
      domAdapter,
      dispatcher
    );

    expect(alertSpy).toHaveBeenCalledWith('Oops');
    expect(logger.info).toHaveBeenCalledWith(
      '[errorUtils] displayFatalStartupError: Displayed error using alert() as a fallback.'
    );
    expect(result).toEqual({ displayed: false });
  });

  it('logs errors when showErrorInElement throws without dispatcher', () => {
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
        if (el.id === 'errorDiv') {
          throw new Error('fail');
        }
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
        consoleMessage: 'Startup failure',
        phase: 'TestPhase',
      },
      logger,
      domAdapter
    );

    expect(logger.error).toHaveBeenNthCalledWith(
      1,
      '[errorUtils] [Bootstrapper Error - Phase: TestPhase] Startup failure',
      ''
    );
    expect(logger.error).toHaveBeenNthCalledWith(
      2,
      '[errorUtils] displayFatalStartupError: Failed to set textContent on errorDiv.',
      expect.any(Error)
    );
    expect(alertSpy).not.toHaveBeenCalled();
    expect(result).toEqual({ displayed: true });
  });

  it('dispatches error when temporary element creation fails', () => {
    setDom('<div id="outputDiv"></div>');
    const outputDiv = document.querySelector('#outputDiv');
    const uiElements = { outputDiv };

    const alertSpy = jest.fn();
    const domAdapter = {
      createElement: () => {
        throw new Error('create fail');
      },
      insertAfter: jest.fn(),
      setTextContent: jest.fn(),
      setStyle: jest.fn(),
      alert: alertSpy,
    };
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    const dispatcher = { dispatch: jest.fn() };

    const result = displayFatalStartupError(
      uiElements,
      {
        userMessage: 'Oops',
        consoleMessage: 'Bad',
      },
      logger,
      domAdapter,
      dispatcher
    );

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ details: { error: 'create fail' } })
    );
    expect(alertSpy).toHaveBeenCalledWith('Oops');
    expect(result).toEqual({ displayed: false });
  });
});
