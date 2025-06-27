import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { StartupErrorHandler } from '../../../src/utils/startupErrorHandler.js';

/**
 *
 * @param html
 */
function setDom(html) {
  document.body.innerHTML = html;
}

describe('StartupErrorHandler additional branches', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  it('dispatches when showErrorInElement throws', () => {
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
    jest.spyOn(handler, 'showErrorInElement').mockImplementation(() => {
      throw new Error('boom');
    });

    const result = handler.displayFatalStartupError(uiElements, {
      userMessage: 'Oops',
      consoleMessage: 'msg',
      phase: 'phase',
    });

    expect(dispatcher.dispatch).toHaveBeenCalled();
    expect(result).toEqual({ displayed: true });
  });

  it('logs when disableInput throws without dispatcher', () => {
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

    const handler = new StartupErrorHandler(logger, domAdapter, null);
    jest.spyOn(handler, 'disableInput').mockImplementation(() => {
      throw new Error('fail');
    });

    const result = handler.displayFatalStartupError(uiElements, {
      userMessage: 'Oops',
      consoleMessage: 'msg',
      phase: 'phase',
    });

    expect(logger.error).toHaveBeenCalledWith(
      '[errorUtils] displayFatalStartupError: Failed to disable or set placeholder on inputElement.',
      expect.any(Error)
    );
    expect(result).toEqual({ displayed: true });
  });
});
