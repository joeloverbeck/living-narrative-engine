import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { StartupErrorHandler } from '../../../src/utils/startupErrorHandler.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js', () => ({
  safeDispatchError: jest.fn(),
}));

/**
 *
 * @param html
 */
function setDom(html) {
  document.body.innerHTML = html;
}

describe('StartupErrorHandler dispatcher branches', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  it('dispatches when temporary element creation fails', () => {
    setDom('<div id="outputDiv"></div>');
    const uiElements = { outputDiv: document.querySelector('#outputDiv') };
    const domAdapter = {
      createElement: () => {
        throw new Error('create fail');
      },
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
    const dispatcher = { dispatch: jest.fn() };
    const handler = new StartupErrorHandler(logger, domAdapter, dispatcher);
    const result = handler.displayErrorMessage({
      errorDiv: null,
      outputDiv: uiElements.outputDiv,
      userMessage: 'Oops',
    });
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'displayFatalStartupError: Failed to create or append temporary error element.',
      { error: 'create fail' }
    );
    expect(domAdapter.alert).toHaveBeenCalledWith('Oops');
    expect(result).toEqual({ displayed: false });
  });

  it('dispatches when title update fails', () => {
    setDom('<input id="inputEl" /><h1 id="title"></h1>');
    const uiElements = {
      titleElement: document.querySelector('#title'),
      inputElement: document.querySelector('#inputEl'),
    };
    const domAdapter = {
      setTextContent: () => {
        throw new Error('title fail');
      },
      setStyle: jest.fn(),
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
    handler.updateElements({
      titleElement: uiElements.titleElement,
      inputElement: uiElements.inputElement,
      pageTitle: 'X',
      inputPlaceholder: 'Y',
    });
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'displayFatalStartupError: Failed to set textContent on titleElement.',
      expect.objectContaining({ raw: 'title fail' })
    );
  });

  it('dispatches when disableInput throws', () => {
    setDom('<input id="inputEl" /><h1 id="title"></h1>');
    const uiElements = {
      titleElement: document.querySelector('#title'),
      inputElement: document.querySelector('#inputEl'),
    };
    const domAdapter = {
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
    const dispatcher = { dispatch: jest.fn() };
    const handler = new StartupErrorHandler(logger, domAdapter, dispatcher);
    jest.spyOn(handler, 'disableInput').mockImplementation(() => {
      throw new Error('disable fail');
    });
    handler.updateElements({
      titleElement: uiElements.titleElement,
      inputElement: uiElements.inputElement,
      pageTitle: 'X',
      inputPlaceholder: 'Y',
    });
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'displayFatalStartupError: Failed to disable or set placeholder on inputElement.',
      expect.objectContaining({ raw: 'disable fail' })
    );
  });
});
