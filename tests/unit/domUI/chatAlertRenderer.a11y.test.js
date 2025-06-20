// tests/domUI/chatAlertRenderer.a11y.test.js
/**
 * @jest-environment jsdom
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ChatAlertRenderer } from '../../../src/domUI';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';

/** Utility to set up ChatAlertRenderer in a real DOM environment */
function setupRenderer() {
  const listeners = new Map();
  const dispatcher = {
    dispatch: jest.fn((evt, payload) => {
      if (listeners.has(evt)) listeners.get(evt)({ payload });
    }),
    subscribe: jest.fn((evt, handler) => {
      listeners.set(evt, handler);
      return () => listeners.delete(evt);
    }),
  };
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const docCtx = {
    query: (sel) => document.querySelector(sel),
    create: (tag) => document.createElement(tag),
  };
  const factory = new DomElementFactory(docCtx);
  new ChatAlertRenderer({
    logger,
    documentContext: docCtx,
    safeEventDispatcher: dispatcher,
    domElementFactory: factory,
    alertRouter: { notifyUIReady: jest.fn() },
  });
  return { dispatcher, chatPanel: document.getElementById('message-list') };
}

/**
 *
 * @param dispatcher
 * @param name
 * @param payload
 */
function fire(dispatcher, name, payload) {
  const call = dispatcher.subscribe.mock.calls.find((c) => c[0] === name);
  if (call) {
    call[1]({ payload });
  }
}

describe('ChatAlertRenderer ARIA behavior', () => {
  let dispatcher;
  let chatPanel;
  beforeEach(() => {
    document.body.innerHTML =
      '<div id="message-list"></div><input id="chat-input">';
    ({ dispatcher, chatPanel } = setupRenderer());
  });

  it('renders warning bubble with proper aria attributes and icon label', () => {
    fire(dispatcher, 'core:display_warning', {
      message: 'Heads up',
      details: {},
    });
    const bubble = chatPanel.firstElementChild;
    expect(bubble.getAttribute('role')).toBe('status');
    expect(bubble.getAttribute('aria-live')).toBe('polite');
    const icon = bubble.querySelector('.chat-alert-icon');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    const label = icon.nextElementSibling;
    expect(label.textContent).toBe('Warning');
  });

  it('renders error bubble with proper aria attributes and icon label', () => {
    fire(dispatcher, 'core:display_error', {
      message: 'Boom',
      details: {},
    });
    const bubble = chatPanel.firstElementChild;
    expect(bubble.getAttribute('role')).toBe('alert');
    expect(bubble.getAttribute('aria-live')).toBe('assertive');
    const icon = bubble.querySelector('.chat-alert-icon');
    expect(icon.getAttribute('aria-hidden')).toBe('true');
    const label = icon.nextElementSibling;
    expect(label.textContent).toBe('Error');
  });

  it('keeps focus on input and toggle buttons receive focus sequentially', () => {
    const input = document.getElementById('chat-input');
    input.focus();
    const longMsg = 'x'.repeat(250);
    fire(dispatcher, 'core:display_error', {
      message: longMsg,
      details: { statusCode: 500, url: '/foo' },
    });
    const bubble = chatPanel.firstElementChild;
    expect(document.activeElement).toBe(input);
    const buttons = bubble.querySelectorAll('button.chat-alert-toggle');
    expect(buttons.length).toBe(2);
    buttons[0].focus();
    expect(document.activeElement).toBe(buttons[0]);
    buttons[1].focus();
    expect(document.activeElement).toBe(buttons[1]);
  });
});
