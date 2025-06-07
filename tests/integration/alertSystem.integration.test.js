import { RetryHttpClient } from '../../src/llms/retryHttpClient.js';
import AlertRouter from '../../src/alerting/alertRouter.js';
import DomElementFactory from '../../src/domUI/domElementFactory.js';
import { ChatAlertRenderer } from '../../src/domUI/index.js';
import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';

const createDispatcher = () => {
  const listeners = new Map();
  return {
    dispatch: jest.fn((name, payload) => {
      if (listeners.has(name)) listeners.get(name)(name, payload);
      return Promise.resolve(true);
    }),
    subscribe: jest.fn((name, cb) => {
      listeners.set(name, cb);
      return () => listeners.delete(name);
    }),
    unsubscribe: jest.fn(),
  };
};

const createLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe.skip('Alert system end-to-end', () => {
  let dispatcher;
  let logger;
  let chatPanel;

  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '<ul id="message-list"></ul>';
    chatPanel = document.getElementById('message-list');
    dispatcher = createDispatcher();
    logger = createLogger();
    global.fetch = jest.fn();

    const alertRouter = new AlertRouter(dispatcher);
    const docCtx = {
      query: (sel) => document.querySelector(sel),
      create: (tag) => document.createElement(tag),
    };
    new ChatAlertRenderer({
      logger,
      documentContext: docCtx,
      safeEventDispatcher: dispatcher,
      domElementFactory: new DomElementFactory(docCtx),
      alertRouter,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('renders a bubble for a retry warning dispatched via RetryHttpClient', async () => {
    jest.useRealTimers();
    global.fetch
      .mockResolvedValueOnce(new Response('unavail', { status: 503 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

    const client = new RetryHttpClient({
      logger,
      dispatcher,
      defaultMaxRetries: 1,
      defaultBaseDelayMs: 0,
      defaultMaxDelayMs: 0,
    });

    await client.request('https://api.example.com', { method: 'GET' });
    jest.useFakeTimers();

    expect(chatPanel.children.length).toBe(1);
    const bubble = chatPanel.firstElementChild;
    expect(bubble.classList.contains('chat-warningBubble')).toBe(true);
  });

  it('coalesces duplicate warnings into a summary bubble', () => {
    const payload = {
      message: 'Timeout',
      details: { statusCode: 503, url: '/api/x', raw: 'fail' },
    };
    dispatcher.dispatch('core:system_warning_occurred', payload);
    dispatcher.dispatch('core:system_warning_occurred', payload);
    dispatcher.dispatch('core:system_warning_occurred', payload);

    expect(chatPanel.children.length).toBe(1);
    jest.advanceTimersByTime(10000);
    expect(chatPanel.children.length).toBe(2);
    const summary = chatPanel.lastElementChild;
    expect(summary.textContent).toContain('occurred 2 more times');
  });
});
