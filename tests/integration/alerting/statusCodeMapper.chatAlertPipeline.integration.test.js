import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ChatAlertRenderer } from '../../../src/domUI/index.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import DomElementFactory from '../../../src/domUI/domElementFactory.js';
import AlertRouter from '../../../src/alerting/alertRouter.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('Status code mapper integration through alert pipeline', () => {
  let logger;
  let eventBus;
  let safeEventDispatcher;
  let alertRouter;

  const dispatchSystemError = async (payload) => {
    await safeEventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, payload);
    await Promise.resolve();
  };

  const getLatestBubble = () => {
    const bubbles = document.querySelectorAll('.chat-alert');
    expect(bubbles.length).toBeGreaterThan(0);
    return bubbles[bubbles.length - 1];
  };

  beforeEach(() => {
    logger = createLogger();

    document.body.innerHTML = `
      <div id="outputDiv">
        <ul id="message-list"></ul>
      </div>
    `;

    const documentContext = new DocumentContext(document, logger);
    const domElementFactory = new DomElementFactory(documentContext);

    eventBus = new EventBus({ logger });
    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: eventBus,
      logger,
    });
    alertRouter = new AlertRouter({ safeEventDispatcher });

    new ChatAlertRenderer({
      logger,
      documentContext,
      safeEventDispatcher,
      domElementFactory,
      alertRouter,
    });

    expect(alertRouter.uiReady).toBe(true);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  it('renders friendly message and developer details when status code includes url and raw data', async () => {
    await dispatchSystemError({
      message: '',
      details: {
        statusCode: 503,
        url: '/system/api',
        raw: 'Service down',
      },
    });

    const bubble = getLatestBubble();
    const messageText = bubble
      .querySelector('.chat-alert-message')
      .textContent.trim();
    expect(messageText).toBe(
      'Service temporarily unavailable. Please retry in a moment.'
    );

    const detailsText = bubble.querySelector(
      '.chat-alert-details-content code'
    ).textContent;
    expect(detailsText).toContain('Status Code: 503');
    expect(detailsText).toContain('URL: /system/api');
    expect(detailsText).toContain('Details: Service down');
  });

  it('falls back to default friendly message when status code is unknown', async () => {
    await dispatchSystemError({
      message: '',
      details: {
        statusCode: 418,
      },
    });

    const bubble = getLatestBubble();
    const messageText = bubble
      .querySelector('.chat-alert-message')
      .textContent.trim();
    expect(messageText).toBe('An unexpected error occurred.');

    const detailsText = bubble
      .querySelector('.chat-alert-details-content code')
      .textContent.trim();
    expect(detailsText).toBe('Status Code: 418');
  });

  it('uses original message when no status code is provided', async () => {
    await dispatchSystemError({
      message: 'Original system error',
      details: {
        raw: 'Detailed failure for debugging',
      },
    });

    const bubble = getLatestBubble();
    const messageText = bubble
      .querySelector('.chat-alert-message')
      .textContent.trim();
    expect(messageText).toBe('Original system error');

    const detailsText = bubble.querySelector(
      '.chat-alert-details-content code'
    ).textContent;
    expect(detailsText).toContain('"raw": "Detailed failure for debugging"');
  });

  it('omits developer details when the payload has no supplemental information', async () => {
    await dispatchSystemError({
      message: 'Simple routed error',
      details: null,
    });

    const bubble = getLatestBubble();
    const messageText = bubble
      .querySelector('.chat-alert-message')
      .textContent.trim();
    expect(messageText).toBe('Simple routed error');

    expect(bubble.querySelector('.chat-alert-details-content')).toBeNull();
  });
});
