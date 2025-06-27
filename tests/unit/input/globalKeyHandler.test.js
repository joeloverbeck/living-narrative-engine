import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import GlobalKeyHandler from '../../../src/input/globalKeyHandler.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';

jest.mock('../../../src/events/validatedEventDispatcher.js');

describe('GlobalKeyHandler', () => {
  let document;
  let ved;
  let handler;

  beforeEach(() => {
    document = global.document;
    document.body.innerHTML = '<div id="root"></div><input id="txt" />';
    ved = new ValidatedEventDispatcher();
    ved.dispatch = jest.fn(() => Promise.resolve(true));
    handler = new GlobalKeyHandler(document, ved);
  });

  afterEach(() => {
    handler.dispose();
    jest.clearAllMocks();
    document.body.innerHTML = '';
  });

  test('constructor validates dependencies', () => {
    expect(() => new GlobalKeyHandler(null, ved)).toThrow(
      'GlobalKeyHandler requires a valid Document.'
    );
    expect(() => new GlobalKeyHandler(document, {})).toThrow(
      'GlobalKeyHandler requires a valid IValidatedEventDispatcher instance.'
    );
  });

  test("pressing 'i' outside inputs dispatches toggle event", () => {
    const event = new window.KeyboardEvent('keydown', { key: 'i' });
    Object.defineProperty(event, 'target', {
      value: document.getElementById('root'),
    });
    document.dispatchEvent(event);
    expect(ved.dispatch).toHaveBeenCalledWith('ui:toggle_inventory', {});
  });

  test("pressing 'i' inside input does not dispatch", () => {
    const event = new window.KeyboardEvent('keydown', { key: 'i' });
    Object.defineProperty(event, 'target', {
      value: document.getElementById('txt'),
    });
    document.dispatchEvent(event);
    expect(ved.dispatch).not.toHaveBeenCalled();
  });
});
