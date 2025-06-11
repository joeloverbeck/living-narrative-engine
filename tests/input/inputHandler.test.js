import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import InputHandler from '../../src/input/inputHandler.js';
import ValidatedEventDispatcher from '../../src/events/validatedEventDispatcher.js';

jest.mock('../../src/events/validatedEventDispatcher.js');

describe('InputHandler', () => {
  let document;
  let inputEl;
  let ved;
  let callback;
  let handler;

  beforeEach(() => {
    document = global.document;
    document.body.innerHTML = '<form id="f"><input id="cmd" /></form>';
    inputEl = document.getElementById('cmd');
    ved = new ValidatedEventDispatcher();
    ved.dispatch = jest.fn();
    ved.subscribe = jest.fn(() => ({ unsubscribe: jest.fn() }));
    callback = jest.fn();
    handler = new InputHandler(inputEl, callback, ved);
    jest.spyOn(inputEl, 'focus').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  test('constructor requires HTMLInputElement', () => {
    expect(() => new InputHandler(null, callback, ved)).toThrow(
      'InputHandler requires a valid HTMLInputElement.'
    );
  });

  test('constructor warns and defaults callback when invalid', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const h = new InputHandler(inputEl, 123, ved);
    inputEl.value = 'cmd';
    h.enable();
    inputEl.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Enter' })
    );
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  test('constructor requires dispatcher with dispatch and subscribe', () => {
    expect(() => new InputHandler(inputEl, callback, {})).toThrow(
      'InputHandler requires a valid IValidatedEventDispatcher instance.'
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
    inputEl.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Enter' })
    );
    expect(callback).toHaveBeenCalledWith('look');
    expect(inputEl.value).toBe('');
  });

  test('dispatching enter when disabled does not invoke callback', () => {
    inputEl.value = 'look';
    inputEl.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Enter' })
    );
    expect(callback).not.toHaveBeenCalled();
  });

  test('setCommandCallback updates callback', () => {
    const newCb = jest.fn();
    handler.setCommandCallback(newCb);
    handler.enable();
    inputEl.value = 'go';
    inputEl.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Enter' })
    );
    expect(newCb).toHaveBeenCalledWith('go');
  });

  test('setCommandCallback rejects non-function', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    handler.setCommandCallback('bad');
    handler.enable();
    inputEl.value = 'go';
    inputEl.dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'Enter' })
    );
    expect(callback).toHaveBeenCalledWith('go');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  test('enable focuses the input element', () => {
    handler.enable();
    expect(inputEl.focus).toHaveBeenCalled();
  });
});
