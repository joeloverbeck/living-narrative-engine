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

describe('StartupErrorHandler primitive error branches', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  it('handles non-Error from showErrorInElement', () => {
    setDom('<div id="errorDiv"></div>');
    const ui = {
      outputDiv: null,
      errorDiv: document.querySelector('#errorDiv'),
    };
    const domAdapter = {
      createElement: document.createElement.bind(document),
      insertAfter: jest.fn(),
      setTextContent: jest.fn(),
      setStyle: jest.fn(),
      alert: jest.fn(),
    };
    const dispatcher = { dispatch: jest.fn() };
    const handler = new StartupErrorHandler(null, domAdapter, dispatcher);
    jest.spyOn(handler, 'showErrorInElement').mockImplementation(() => {
      throw 'boom';
    });
    const result = handler.displayErrorMessage({
      errorDiv: ui.errorDiv,
      outputDiv: ui.outputDiv,
      userMessage: 'oops',
    });
    expect(result).toEqual({ displayed: false });
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'displayFatalStartupError: Failed to set textContent on errorDiv.',
      { error: 'boom' }
    );
    expect(domAdapter.alert).toHaveBeenCalledWith('oops');
  });

  it('handles non-Error from createTemporaryErrorElement', () => {
    setDom('<div id="outputDiv"></div>');
    const ui = { outputDiv: document.querySelector('#outputDiv') };
    const domAdapter = {
      createElement: () => {
        throw 'fail';
      },
      insertAfter: jest.fn(),
      setTextContent: jest.fn(),
      setStyle: jest.fn(),
      alert: jest.fn(),
    };
    const dispatcher = { dispatch: jest.fn() };
    const handler = new StartupErrorHandler(null, domAdapter, dispatcher);
    const result = handler.displayErrorMessage({
      errorDiv: null,
      outputDiv: ui.outputDiv,
      userMessage: 'bad',
    });
    expect(result).toEqual({ displayed: false });
    expect(safeDispatchError).toHaveBeenCalledWith(
      dispatcher,
      'displayFatalStartupError: Failed to create or append temporary error element.',
      { error: 'fail' }
    );
    expect(domAdapter.alert).toHaveBeenCalledWith('bad');
  });

  it('handles updateElements failures with primitive errors', () => {
    setDom('<input id="inp" /><h1 id="title"></h1>');
    const ui = {
      inputElement: document.querySelector('#inp'),
      titleElement: document.querySelector('#title'),
    };
    const domAdapter = {
      setTextContent: () => {
        throw 'tfail';
      },
      setStyle: jest.fn(),
      alert: jest.fn(),
    };
    const dispatcher = { dispatch: jest.fn() };
    const handler = new StartupErrorHandler(null, domAdapter, dispatcher);
    jest.spyOn(handler, 'disableInput').mockImplementation(() => {
      throw 'dfail';
    });
    handler.updateElements({
      titleElement: ui.titleElement,
      inputElement: ui.inputElement,
      pageTitle: 'x',
      inputPlaceholder: 'y',
    });
    expect(safeDispatchError).toHaveBeenNthCalledWith(
      1,
      dispatcher,
      'displayFatalStartupError: Failed to set textContent on titleElement.',
      expect.objectContaining({ raw: 'tfail' })
    );
    expect(safeDispatchError).toHaveBeenNthCalledWith(
      2,
      dispatcher,
      'displayFatalStartupError: Failed to disable or set placeholder on inputElement.',
      expect.objectContaining({ raw: 'dfail' })
    );
  });
});
