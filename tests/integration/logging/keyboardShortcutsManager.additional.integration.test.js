import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import KeyboardShortcutsManager from '../../../src/logging/keyboardShortcutsManager.js';
import NoOpLogger from '../../../src/logging/noOpLogger.js';

/**
 *
 * @param target
 * @param overrides
 */
function createKeydownEvent(target, overrides = {}) {
  const event = new window.CustomEvent('keydown', {
    bubbles: true,
    cancelable: true,
  });

  const baseValues = {
    key: '',
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    target,
    preventDefault: jest.fn(),
  };

  for (const [prop, base] of Object.entries(baseValues)) {
    const value = overrides[prop] ?? base;
    Object.defineProperty(event, prop, {
      value,
      configurable: true,
    });
  }

  return event;
}

describe('KeyboardShortcutsManager integration edge coverage', () => {
  let logger;

  beforeEach(() => {
    logger = new NoOpLogger();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('handles modifier shortcuts and fires callbacks with preventDefault applied', () => {
    const manager = new KeyboardShortcutsManager({
      logger,
      documentContext: document,
    });
    const actionCallback = jest.fn();
    manager.setActionCallback(actionCallback);

    manager.register('Alt+J', {
      description: 'Adjust level',
      action: 'alt-action',
      preventDefault: true,
    });

    manager.register('Meta+K', {
      description: 'Launch meta action',
      action: 'meta-action',
      preventDefault: true,
    });

    manager.enable();

    const altEvent = createKeydownEvent(document.body, {
      key: 'J',
      altKey: true,
    });
    document.dispatchEvent(altEvent);
    expect(altEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(actionCallback).toHaveBeenCalledWith('alt-action', altEvent);

    const metaEvent = createKeydownEvent(document.body, {
      key: 'K',
      metaKey: true,
    });
    document.dispatchEvent(metaEvent);
    expect(metaEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(actionCallback).toHaveBeenLastCalledWith('meta-action', metaEvent);

    manager.destroy();
  });

  it('honors preventDefault flag and handles missing callbacks and unregistered shortcuts', () => {
    const manager = new KeyboardShortcutsManager({
      logger,
      documentContext: document,
    });
    const actionCallback = jest.fn();
    manager.setActionCallback(actionCallback);

    manager.register('Ctrl+Z', {
      description: 'Download logs',
      action: 'download',
      preventDefault: false,
    });

    manager.enable();

    const downloadEvent = createKeydownEvent(document.body, {
      key: 'Z',
      ctrlKey: true,
    });
    document.dispatchEvent(downloadEvent);

    expect(downloadEvent.preventDefault).not.toHaveBeenCalled();
    expect(actionCallback).toHaveBeenCalledWith('download', downloadEvent);

    const initialCalls = actionCallback.mock.calls.length;
    const unusedEvent = createKeydownEvent(document.body, {
      key: 'Y',
      ctrlKey: true,
      shiftKey: true,
    });
    document.dispatchEvent(unusedEvent);
    expect(actionCallback.mock.calls.length).toBe(initialCalls);

    manager.setActionCallback(null);
    document.dispatchEvent(downloadEvent);
    expect(actionCallback.mock.calls.length).toBe(initialCalls);

    manager.destroy();
  });

  it('skips navigation shortcuts when panel is missing or editing controls are focused', () => {
    const manager = new KeyboardShortcutsManager({
      logger,
      documentContext: document,
    });
    const actionCallback = jest.fn();
    manager.setActionCallback(actionCallback);
    manager.enable();

    let previousCalls = actionCallback.mock.calls.length;
    const navEventNoPanel = createKeydownEvent(document.body, {
      key: 'ArrowUp',
    });
    document.dispatchEvent(navEventNoPanel);
    expect(actionCallback.mock.calls.length).toBe(previousCalls);

    const panel = document.createElement('div');
    panel.className = 'lne-critical-log-panel';
    document.body.appendChild(panel);

    const inputEvent = createKeydownEvent(document.body, { key: 'ArrowDown' });
    Object.defineProperty(inputEvent, 'target', {
      value: { tagName: 'INPUT', isContentEditable: false },
      configurable: true,
    });
    previousCalls = actionCallback.mock.calls.length;
    document.dispatchEvent(inputEvent);
    expect(actionCallback.mock.calls.length).toBe(previousCalls);

    const editableEvent = createKeydownEvent(document.body, {
      key: 'ArrowDown',
    });
    Object.defineProperty(editableEvent, 'target', {
      value: { tagName: 'DIV', isContentEditable: true },
      configurable: true,
    });
    previousCalls = actionCallback.mock.calls.length;
    document.dispatchEvent(editableEvent);
    expect(actionCallback.mock.calls.length).toBe(previousCalls);

    const nullTargetEvent = createKeydownEvent(document.body, {
      key: 'ArrowDown',
    });
    Object.defineProperty(nullTargetEvent, 'target', {
      value: null,
      configurable: true,
    });
    previousCalls = actionCallback.mock.calls.length;
    document.dispatchEvent(nullTargetEvent);
    expect(actionCallback.mock.calls.length).toBe(previousCalls);

    panel.hidden = false;
    const activeEvent = createKeydownEvent(document.body, { key: 'ArrowDown' });
    document.dispatchEvent(activeEvent);
    expect(actionCallback).toHaveBeenCalledWith('next-log', activeEvent);

    manager.destroy();
  });

  it('avoids duplicate enable/disable operations on the real document context', () => {
    const addSpy = jest.spyOn(document, 'addEventListener');
    const removeSpy = jest.spyOn(document, 'removeEventListener');

    const manager = new KeyboardShortcutsManager({
      logger,
      documentContext: document,
    });

    manager.enable();
    manager.enable();
    expect(addSpy).toHaveBeenCalledTimes(1);

    manager.disable();
    manager.disable();
    expect(removeSpy).toHaveBeenCalledTimes(1);

    manager.destroy();
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('short-circuits lifecycle when document context is absent', () => {
    const manager = new KeyboardShortcutsManager({
      logger,
      documentContext: null,
    });
    expect(() => manager.enable()).not.toThrow();
    expect(() => manager.disable()).not.toThrow();
    expect(() => manager.destroy()).not.toThrow();
  });
});
