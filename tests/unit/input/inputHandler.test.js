import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import InputHandler from '../../../src/input/inputHandler.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';

jest.mock('../../../src/events/validatedEventDispatcher.js');

/**
 * Creates a stubbed document object for testing.
 *
 * @returns {{addEventListener: jest.Mock, removeEventListener: jest.Mock, cb?: Function}}
 */
function createDocMock() {
  const doc = {
    addEventListener: jest.fn((_, cb) => {
      doc.cb = cb;
    }),
    removeEventListener: jest.fn((_, cb) => {
      if (doc.cb === cb) {
        doc.cb = undefined;
      }
    }),
  };
  return doc;
}

/**
 * Creates a minimal logger mock.
 *
 * @returns {{debug: jest.Mock, warn: jest.Mock, error: jest.Mock}}
 */
function createLoggerMock() {
  return { debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
}

describe('InputHandler', () => {
  let dom;
  let inputEl;
  let ved;
  let callback;
  let handler;
  let docMock;
  let logger;

  beforeEach(() => {
    dom = global.document;
    dom.body.innerHTML = '<form id="f"><input id="cmd" /></form>';
    inputEl = dom.getElementById('cmd');
    docMock = createDocMock();
    logger = createLoggerMock();
    ved = new ValidatedEventDispatcher();
    ved.dispatch = jest.fn();
    ved.subscribe = jest.fn(() => jest.fn());
    callback = jest.fn();
    handler = new InputHandler(inputEl, callback, ved, {
      document: docMock,
      logger,
    });
    jest.spyOn(inputEl, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    dom.body.innerHTML = '';
  });

  test('constructor requires HTMLInputElement', () => {
    expect(
      () =>
        new InputHandler(null, callback, ved, {
          document: docMock,
          logger,
        })
    ).toThrow('InputHandler requires a valid HTMLInputElement.');
  });

  test('constructor warns and defaults callback when invalid', () => {
    const warnSpy = jest.spyOn(logger, 'warn');
    const h = new InputHandler(inputEl, 123, ved, {
      document: docMock,
      logger,
    });
    h.enable();
    inputEl.value = 'cmd';
    docMock.cb(new window.KeyboardEvent('keydown', { key: 'Enter' }));
    expect(warnSpy).toHaveBeenCalled();
    expect(docMock.addEventListener).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function)
    );
  });

  test('constructor requires dispatcher with dispatch and subscribe', () => {
    expect(
      () =>
        new InputHandler(
          inputEl,
          callback,
          {},
          {
            document: docMock,
            logger,
          }
        )
    ).toThrow(
      'InputHandler requires a valid IValidatedEventDispatcher instance.'
    );
  });

  test('constructor validates document and logger', () => {
    expect(
      () =>
        new InputHandler(inputEl, callback, ved, {
          document: {},
          logger,
        })
    ).toThrow(
      'InputHandler requires a valid document with addEventListener and removeEventListener.'
    );

    expect(
      () =>
        new InputHandler(inputEl, callback, ved, {
          document: docMock,
          logger: {},
        })
    ).toThrow(
      'InputHandler requires a logger implementing debug, warn, and error.'
    );
  });

  test('subscribes to enable and disable events', () => {
    expect(ved.subscribe).toHaveBeenCalledWith(
      'core:enable_input',
      expect.any(Function)
    );
    expect(ved.subscribe).toHaveBeenCalledWith(
      'core:disable_input',
      expect.any(Function)
    );
  });

  test('dispatching enter when enabled invokes callback and clears input', () => {
    handler.enable();
    inputEl.value = 'look';
    docMock.cb(new window.KeyboardEvent('keydown', { key: 'Enter' }));
    expect(callback).toHaveBeenCalledWith('look');
    expect(inputEl.value).toBe('');
  });

  test('dispatching enter when disabled does not invoke callback', () => {
    inputEl.value = 'look';
    docMock.cb(new window.KeyboardEvent('keydown', { key: 'Enter' }));
    expect(callback).not.toHaveBeenCalled();
  });

  test('setCommandCallback updates callback', () => {
    const newCb = jest.fn();
    handler.setCommandCallback(newCb);
    handler.enable();
    inputEl.value = 'go';
    docMock.cb(new window.KeyboardEvent('keydown', { key: 'Enter' }));
    expect(newCb).toHaveBeenCalledWith('go');
  });

  test('setCommandCallback rejects non-function', () => {
    const errorSpy = jest.spyOn(logger, 'error');
    handler.setCommandCallback('bad');
    handler.enable();
    inputEl.value = 'go';
    docMock.cb(new window.KeyboardEvent('keydown', { key: 'Enter' }));
    expect(callback).toHaveBeenCalledWith('go');
    expect(errorSpy).toHaveBeenCalled();
    expect(docMock.addEventListener).toHaveBeenCalled();
  });

  test('enable focuses the input element', () => {
    handler.enable();
    expect(inputEl.focus).toHaveBeenCalled();
  });

  test('handles events from injected document', () => {
    const globalSpy = jest.spyOn(dom, 'addEventListener');
    handler.enable();
    inputEl.value = 'hi';
    docMock.cb(new window.KeyboardEvent('keydown', { key: 'Enter' }));
    expect(globalSpy).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith('hi');
    globalSpy.mockRestore();
  });

  test('dispose removes listeners and prevents further callbacks', () => {
    handler.enable();
    const addedCb = docMock.cb;
    handler.dispose();

    inputEl.value = 'test';
    if (docMock.cb) {
      docMock.cb(new window.KeyboardEvent('keydown', { key: 'Enter' }));
    }

    expect(callback).not.toHaveBeenCalled();
    expect(docMock.removeEventListener).toHaveBeenCalledWith(
      'keydown',
      addedCb
    );
    expect(docMock.cb).toBeUndefined();
    const unsub = ved.subscribe.mock.results[0].value;
    expect(unsub).toHaveBeenCalled();
  });
});
