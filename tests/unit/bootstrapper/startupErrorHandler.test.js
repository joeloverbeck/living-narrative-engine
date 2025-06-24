import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { StartupErrorHandler } from '../../../src/utils/startupErrorHandler.js';

/**
 *
 * @param html
 */
function setDom(html) {
  document.body.innerHTML = html;
}

describe('StartupErrorHandler', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  it('logs error, updates DOM, and dispatches event', () => {
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

    const domAdapter = {
      createElement: document.createElement.bind(document),
      insertAfter: (ref, el) => ref.insertAdjacentElement('afterend', el),
      setTextContent: (el, text) => {
        el.textContent = text;
      },
      setStyle: (el, prop, val) => {
        el.style[prop] = val;
      },
      alert: jest.fn(),
    };
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    const dispatcher = { dispatch: jest.fn() };

    const handler = new StartupErrorHandler(logger, domAdapter, dispatcher);
    const result = handler.displayFatalStartupError(uiElements, {
      userMessage: 'Oops',
      consoleMessage: 'Bad things',
      errorObject: new Error('fail'),
      pageTitle: 'Error',
      inputPlaceholder: 'halt',
      phase: 'Test',
    });

    expect(result).toEqual({ displayed: true });
    expect(dispatcher.dispatch).toHaveBeenCalled();
    expect(uiElements.errorDiv.textContent).toBe('Oops');
    expect(uiElements.titleElement.textContent).toBe('Error');
    expect(uiElements.inputElement.disabled).toBe(true);
    expect(uiElements.inputElement.placeholder).toBe('halt');
  });

  it('creates temporary element when errorDiv missing', () => {
    setDom('<div id="outputDiv"></div>');
    const uiElements = { outputDiv: document.querySelector('#outputDiv') };

    const domAdapter = {
      createElement: document.createElement.bind(document),
      insertAfter: (ref, el) => ref.insertAdjacentElement('afterend', el),
      setTextContent: (el, text) => {
        el.textContent = text;
      },
      setStyle: (el, prop, val) => {
        el.style[prop] = val;
      },
      alert: jest.fn(),
    };
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const handler = new StartupErrorHandler(logger, domAdapter, null);
    const result = handler.displayFatalStartupError(uiElements, {
      userMessage: 'Oops',
      consoleMessage: 'Bad',
    });

    const tempEl = uiElements.outputDiv.nextElementSibling;
    expect(tempEl).not.toBeNull();
    expect(tempEl.id).toBe('temp-startup-error');
    expect(tempEl.textContent).toBe('Oops');
    expect(result).toEqual({ displayed: true });
  });

  it('falls back to alert when no DOM targets', () => {
    setDom('');
    const domAdapter = {
      createElement: document.createElement.bind(document),
      insertAfter: jest.fn(),
      setTextContent: jest.fn(),
      setStyle: jest.fn(),
      alert: jest.fn(),
    };
    const logger = {
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const handler = new StartupErrorHandler(logger, domAdapter, null);
    const result = handler.displayFatalStartupError(
      {},
      {
        userMessage: 'Oops',
        consoleMessage: 'Bad',
      }
    );

    expect(domAdapter.alert).toHaveBeenCalledWith('Oops');
    expect(logger.info).toHaveBeenCalledWith(
      '[errorUtils] displayFatalStartupError: Displayed error using alert() as a fallback.'
    );
    expect(result).toEqual({ displayed: false });
  });
});
