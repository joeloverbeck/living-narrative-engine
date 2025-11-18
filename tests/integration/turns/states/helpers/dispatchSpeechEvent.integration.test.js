/**
 * @file Integration tests for dispatchSpeechEvent interacting with SafeEventDispatcher resolution.
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { dispatchSpeechEvent } from '../../../../../src/turns/states/helpers/dispatchSpeechEvent.js';
import { SafeEventDispatcher } from '../../../../../src/events/safeEventDispatcher.js';
import { ENTITY_SPOKE_ID } from '../../../../../src/constants/eventIds.js';

class RecordingValidatedEventDispatcher {
  constructor() {
    /** @type {{ eventName: string, payload: any, options: object }[]} */
    this.dispatched = [];
    /** @type {Map<string, Function>} */
    this.subscriptions = new Map();
  }

  /**
   * @param {string} eventName
   * @param {any} payload
   * @param {object} options
   * @returns {Promise<boolean>}
   */
  async dispatch(eventName, payload, options = {}) {
    this.dispatched.push({ eventName, payload, options });
    return true;
  }

  /**
   * @param {string} eventName
   * @param {Function} handler
   * @returns {Function}
   */
  subscribe(eventName, handler) {
    this.subscriptions.set(eventName, handler);
    return () => this.unsubscribe(eventName, handler);
  }

  /**
   * @param {string} eventName
   * @param {Function} handler
   * @returns {boolean}
   */
  unsubscribe(eventName, handler) {
    if (this.subscriptions.get(eventName) === handler) {
      this.subscriptions.delete(eventName);
    }
    return true;
  }
}

/**
 *
 */
function createLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

describe('dispatchSpeechEvent integration', () => {
  /** @type {RecordingValidatedEventDispatcher} */
  let validatedDispatcher;
  /** @type {ReturnType<typeof createLogger>} */
  let logger;
  /** @type {SafeEventDispatcher} */
  let safeDispatcher;

  beforeEach(() => {
    validatedDispatcher = new RecordingValidatedEventDispatcher();
    logger = createLogger();
    safeDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });
  });

  it('dispatches ENTITY_SPOKE_ID when context exposes a dispatcher', async () => {
    const turnContext = {
      getSafeEventDispatcher: () => safeDispatcher,
      getLogger: () => logger,
    };
    const handler = {
      getLogger: () => logger,
    };

    await dispatchSpeechEvent(turnContext, handler, 'actor-123', {
      speechContent: 'Hello world',
      tone: 'cheerful',
    });

    expect(validatedDispatcher.dispatched).toEqual([
      {
        eventName: ENTITY_SPOKE_ID,
        payload: {
          entityId: 'actor-123',
          speechContent: 'Hello world',
          tone: 'cheerful',
        },
        options: {},
      },
    ]);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('falls back to handler dispatcher when context lacks one', async () => {
    const fallbackDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: validatedDispatcher,
      logger,
    });
    const turnContext = {
      getSafeEventDispatcher: () => null,
      getLogger: () => logger,
    };
    const handler = {
      getSafeEventDispatcher: () => fallbackDispatcher,
      getLogger: () => logger,
    };

    await dispatchSpeechEvent(turnContext, handler, 'actor-456', {
      speechContent: 'Fallback path engaged',
    });

    expect(validatedDispatcher.dispatched).toHaveLength(1);
    expect(validatedDispatcher.dispatched[0]).toEqual({
      eventName: ENTITY_SPOKE_ID,
      payload: {
        entityId: 'actor-456',
        speechContent: 'Fallback path engaged',
      },
      options: {},
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'ContextUtils.getSafeEventDispatcher: SafeEventDispatcher not found on ITurnContext. Falling back to handler.getSafeEventDispatcher().'
      )
    );
  });

  it('completes gracefully when no dispatcher is available', async () => {
    const turnContext = {
      getSafeEventDispatcher: () => null,
      getLogger: () => logger,
    };
    const handler = {
      getSafeEventDispatcher: () => undefined,
      getLogger: () => logger,
    };

    await dispatchSpeechEvent(turnContext, handler, 'actor-789', {
      speechContent: 'No listeners',
    });

    expect(validatedDispatcher.dispatched).toHaveLength(0);
    expect(logger.warn).toHaveBeenLastCalledWith(
      'ContextUtils.getSafeEventDispatcher: SafeEventDispatcher unavailable.'
    );
  });
});
