import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
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
    let finalValue = value;
    if (prop === 'ctrlKey' || prop === 'shiftKey' || prop === 'altKey' || prop === 'metaKey') {
      finalValue = Boolean(value);
    }

    Object.defineProperty(event, prop, {
      value: finalValue,
      configurable: true,
    });
  }

  return event;
}

describe('KeyboardShortcutsManager integration', () => {
  let logger;

  beforeEach(() => {
    logger = new NoOpLogger();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('enables shortcuts and triggers actions for registered defaults', () => {
    const panel = document.createElement('div');
    panel.className = 'lne-critical-log-panel';
    document.body.appendChild(panel);

    const manager = new KeyboardShortcutsManager({
      logger,
      documentContext: document,
    });

    const actionCallback = jest.fn();
    manager.setActionCallback(actionCallback);

    manager.enable();

    const event = createKeydownEvent(document.body, {
      key: 'L',
      ctrlKey: true,
      shiftKey: true,
    });
    document.body.dispatchEvent(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(actionCallback).toHaveBeenCalledTimes(1);
    expect(actionCallback).toHaveBeenCalledWith('toggle-panel', event);

    manager.destroy();
  });

  it('requires the critical log panel to be present and visible for navigation shortcuts', () => {
    const panel = document.createElement('div');
    panel.className = 'lne-critical-log-panel';
    panel.hidden = true;
    document.body.appendChild(panel);

    const manager = new KeyboardShortcutsManager({
      logger,
      documentContext: document,
    });
    const actionCallback = jest.fn();
    manager.setActionCallback(actionCallback);
    manager.enable();

    const hiddenEvent = createKeydownEvent(document.body, { key: 'ArrowDown' });
    document.body.dispatchEvent(hiddenEvent);
    expect(actionCallback).not.toHaveBeenCalled();

    panel.hidden = false;
    const activeEvent = createKeydownEvent(document.body, { key: 'ArrowDown' });
    document.body.dispatchEvent(activeEvent);

    expect(actionCallback).toHaveBeenCalledTimes(1);
    expect(actionCallback).toHaveBeenCalledWith('next-log', activeEvent);

    manager.destroy();
  });

  it('ignores shortcuts when focus is on inputs', () => {
    const panel = document.createElement('div');
    panel.className = 'lne-critical-log-panel';
    document.body.appendChild(panel);

    const manager = new KeyboardShortcutsManager({
      logger,
      documentContext: document,
    });
    const actionCallback = jest.fn();
    manager.setActionCallback(actionCallback);
    manager.enable();

    const input = document.createElement('input');
    document.body.appendChild(input);
    const inputEvent = createKeydownEvent(input, {
      key: 'L',
      ctrlKey: true,
      shiftKey: true,
    });
    input.dispatchEvent(inputEvent);
    expect(actionCallback).not.toHaveBeenCalled();

    manager.destroy();
  });

  it('avoids duplicate listener registration and safely handles lifecycle without active listeners', () => {
    const listeners = new Map();
    const fakeDocument = {
      addEventListener: jest.fn((type, handler) => {
        listeners.set(type, handler);
      }),
      removeEventListener: jest.fn((type) => {
        listeners.delete(type);
      }),
      querySelector: jest.fn().mockReturnValue(null),
    };

    const manager = new KeyboardShortcutsManager({
      logger,
      documentContext: fakeDocument,
    });
    const actionCallback = jest.fn();
    manager.setActionCallback(actionCallback);

    manager.enable();
    manager.enable();
    expect(fakeDocument.addEventListener).toHaveBeenCalledTimes(1);

    const handler = listeners.get('keydown');
    expect(typeof handler).toBe('function');

    handler({
      key: 'D',
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
      target: { tagName: 'DIV', isContentEditable: true },
      preventDefault: jest.fn(),
    });
    expect(actionCallback).not.toHaveBeenCalled();

    handler({
      key: 'Escape',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      target: null,
      preventDefault: jest.fn(),
    });
    expect(actionCallback).not.toHaveBeenCalled();

    manager.disable();
    manager.disable();
    expect(fakeDocument.removeEventListener).toHaveBeenCalledTimes(1);

    manager.destroy();
  });

  it('formats help text for registered shortcuts and clears entries on destroy', () => {
    const manager = new KeyboardShortcutsManager({
      logger,
      documentContext: document,
    });

    manager.register('Shift+Ctrl+Z', {
      description: 'Undo critical action',
      action: 'undo-last',
      preventDefault: true,
    });

    const helpText = manager.getHelpText();
    expect(helpText).toContain('Keyboard Shortcuts:');
    expect(helpText).toContain('Ctrl+Shift+L');
    expect(helpText).toContain('Toggle panel');
    expect(helpText).toContain('Ctrl+Shift+Z');
    expect(helpText).toContain('Undo critical action');

    manager.destroy();

    expect(manager.getHelpText()).toBe('Keyboard Shortcuts:');
  });

  it('gracefully skips lifecycle operations when no document context is provided', () => {
    const manager = new KeyboardShortcutsManager({
      logger,
      documentContext: null,
    });

    expect(() => manager.enable()).not.toThrow();
    expect(() => manager.disable()).not.toThrow();
    expect(() => manager.destroy()).not.toThrow();
  });
});
