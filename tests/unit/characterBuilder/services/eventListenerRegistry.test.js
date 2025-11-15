import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EventListenerRegistry } from '../../../../src/characterBuilder/services/eventListenerRegistry.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createAsyncUtilities = () => ({
  debounce: jest.fn((fn) => {
    const wrapped = jest.fn((...args) => fn(...args));
    wrapped.cancel = jest.fn();
    return wrapped;
  }),
  throttle: jest.fn((fn) => {
    const wrapped = jest.fn((...args) => fn(...args));
    wrapped.cancel = jest.fn();
    return wrapped;
  }),
});

const createElementStub = () => {
  const listeners = new Map();
  const element = {
    id: 'fixture',
    tagName: 'BUTTON',
    disabled: false,
    textContent: 'Submit',
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
    },
    addEventListener: jest.fn((event, handler) => {
      listeners.set(event, handler);
    }),
    removeEventListener: jest.fn((event, handler) => {
      if (listeners.get(event) === handler) {
        listeners.delete(event);
      }
    }),
    contains: jest.fn(() => true),
    trigger(event, payload = {}) {
      if (listeners.has(event)) {
        listeners.get(event)({
          currentTarget: element,
          target: element,
          ...payload,
        });
      }
    },
  };
  return element;
};

describe('EventListenerRegistry', () => {
  let logger;
  let asyncUtilities;
  let registry;
  let element;

  beforeEach(() => {
    logger = createLogger();
    asyncUtilities = createAsyncUtilities();
    registry = new EventListenerRegistry({
      logger,
      asyncUtilities,
      contextName: 'TestController',
    });
    element = createElementStub();
  });

  it('requires async utilities to expose debounce and throttle helpers', () => {
    expect(
      () =>
        new EventListenerRegistry({
          logger,
          asyncUtilities: /** @type {any} */ (null),
        })
    ).toThrow(
      'EventListenerRegistry requires asyncUtilities with debounce and throttle functions'
    );
  });

  it('registers DOM listeners and removes them deterministically', () => {
    const handler = jest.fn();
    const listenerId = registry.addEventListener(element, 'click', handler);

    expect(listenerId).toMatch(/listener-/);
    expect(element.addEventListener).toHaveBeenCalledWith(
      'click',
      handler,
      expect.objectContaining({ passive: true })
    );

    expect(registry.removeEventListener(listenerId)).toBe(true);
    expect(element.removeEventListener).toHaveBeenCalledWith(
      'click',
      handler,
      expect.objectContaining({ passive: true })
    );
  });

  it('warns when attempting to register a listener on an invalid target', () => {
    const handler = jest.fn();
    const result = registry.addEventListener(null, 'click', handler);

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      "TestController: Cannot add click listener - invalid target provided"
    );
  });

  it('logs constructor names for non-element targets', () => {
    class CustomTarget {}
    const customTarget = new CustomTarget();
    customTarget.addEventListener = jest.fn();
    customTarget.removeEventListener = jest.fn();

    const id = registry.addEventListener(customTarget, 'hover', jest.fn());

    const debugMessage = logger.debug.mock.calls
      .map(([message]) => message)
      .find((message) => message.includes('hover'));

    expect(id).toBeTruthy();
    expect(debugMessage).toContain('CustomTarget');
  });

  it('subscribes to the event bus and unsubscribes on cleanup', () => {
    const unsubscribe = jest.fn();
    const eventBus = {
      subscribe: jest.fn(() => unsubscribe),
    };
    const handler = jest.fn();

    const subscriptionId = registry.subscribeToEvent(
      eventBus,
      'sample:event',
      handler
    );

    expect(subscriptionId).toMatch(/sub-/);
    expect(eventBus.subscribe).toHaveBeenCalledWith('sample:event', handler);

    registry.removeAllEventListeners();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('warns when attempting to subscribe without a valid event bus', () => {
    const handler = jest.fn();
    const result = registry.subscribeToEvent(null, 'broken:event', handler);

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      "TestController: Cannot subscribe to 'broken:event' - eventBus not available"
    );
  });

  it('logs errors when the event bus does not return an unsubscribe function', () => {
    const eventBus = { subscribe: jest.fn(() => null) };
    const handler = jest.fn();

    const result = registry.subscribeToEvent(eventBus, 'incomplete:event', handler);

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      "TestController: Failed to subscribe to event 'incomplete:event'"
    );
  });

  it('filters delegated listeners so only matching children trigger handler', () => {
    const container = {
      ...createElementStub(),
      contains: jest.fn((node) => node && node.allowed),
    };
    const handler = jest.fn();

    registry.addDelegatedListener(container, '.child', 'click', handler);
    const delegatedHandler = container.addEventListener.mock.calls[0][1];

    const insideElement = { allowed: true, closest: () => ({ allowed: true }) };
    const outsideElement = {
      allowed: false,
      closest: () => ({ allowed: false }),
    };

    delegatedHandler({ target: insideElement });
    delegatedHandler({ target: outsideElement });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ target: insideElement }),
      expect.objectContaining({ allowed: true })
    );
  });

  it('warns when attempting to delegate from an invalid container', () => {
    const handler = jest.fn();
    const result = registry.addDelegatedListener(null, '.child', 'click', handler);

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'TestController: Cannot add delegated listener - invalid container'
    );
  });

  it('wraps debounced listeners with async utilities and cancels wrappers on cleanup', () => {
    const handler = jest.fn();
    const listenerId = registry.addDebouncedListener(
      element,
      'input',
      handler,
      200
    );

    expect(listenerId).toEqual('debounced-input-200');
    expect(asyncUtilities.debounce).toHaveBeenCalledWith(handler, 200);

    registry.removeAllEventListeners();
    const wrapped = asyncUtilities.debounce.mock.results[0].value;
    expect(wrapped.cancel).toHaveBeenCalled();
  });

  it('throws when attempting to create a debounced listener without a numeric delay', () => {
    expect(() =>
      registry.addDebouncedListener(element, 'input', jest.fn(), Number.NaN)
    ).toThrow(new TypeError('addDebouncedListener requires a numeric delay'));
  });

  it('cleans up cached debounced handlers when registration fails', () => {
    const handler = jest.fn();
    const addSpy = jest
      .spyOn(registry, 'addEventListener')
      .mockReturnValue(null);

    const result = registry.addDebouncedListener(element, 'input', handler, 125);

    expect(result).toBeNull();
    const debounced = asyncUtilities.debounce.mock.results[0].value;
    expect(debounced.cancel).toHaveBeenCalled();
    addSpy.mockRestore();
  });

  it('wraps throttled listeners with async utilities and cancels on cleanup', () => {
    const handler = jest.fn();
    const listenerId = registry.addThrottledListener(
      element,
      'scroll',
      handler,
      100
    );

    expect(listenerId).toEqual('throttled-scroll-100');
    expect(asyncUtilities.throttle).toHaveBeenCalledWith(handler, 100);

    registry.removeAllEventListeners();
    const wrapped = asyncUtilities.throttle.mock.results[0].value;
    expect(wrapped.cancel).toHaveBeenCalled();
  });

  it('throws when attempting to create a throttled listener without a numeric limit', () => {
    expect(() =>
      registry.addThrottledListener(element, 'scroll', jest.fn(), Number.NaN)
    ).toThrow(new TypeError('addThrottledListener requires a numeric limit'));
  });

  it('exposes memoized debounced and throttled handlers by key', () => {
    const debouncedA = registry.getDebouncedHandler('search', jest.fn(), 50);
    const debouncedB = registry.getDebouncedHandler('search', jest.fn(), 50);
    expect(debouncedA).toBe(debouncedB);

    const throttledA = registry.getThrottledHandler('scroll', jest.fn(), 75);
    const throttledB = registry.getThrottledHandler('scroll', jest.fn(), 75);
    expect(throttledA).toBe(throttledB);
  });

  it('provides aggregated listener statistics', () => {
    registry.addEventListener(element, 'click', jest.fn());
    const unsubscribe = jest.fn();
    registry.subscribeToEvent(
      { subscribe: () => unsubscribe },
      'event',
      jest.fn()
    );

    const stats = registry.getEventListenerStats();
    expect(stats).toEqual(
      expect.objectContaining({ total: 2, dom: 1, eventBus: 1 })
    );
    expect(stats.byEvent['dom:click']).toBe(1);
    expect(stats.byEvent['eventBus:event']).toBe(1);
  });

  it('prevents default event flow before invoking handler', () => {
    const event = {
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    };
    const handler = jest.fn();

    registry.preventDefault(event, handler);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('manages async click handlers with loading state and error reporting', async () => {
    const onError = jest.fn();
    const asyncHandler = jest.fn().mockResolvedValue(true);

    registry.addAsyncClickHandler(element, asyncHandler, {
      loadingText: 'Saving',
      onError,
    });

    const clickHandler = element.addEventListener.mock.calls[0][1];
    await clickHandler({ currentTarget: element, target: element });

    expect(element.classList.add).toHaveBeenCalledWith('is-loading');
    expect(element.classList.remove).toHaveBeenCalledWith('is-loading');
    expect(asyncHandler).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    const failingHandler = jest.fn().mockRejectedValue(new Error('boom'));
    registry.addAsyncClickHandler(element, failingHandler, { onError });
    const failingClickHandler = element.addEventListener.mock.calls[1][1];
    await failingClickHandler({ currentTarget: element, target: element });
    expect(logger.error).toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });

  it('falls back to executing the async handler when no target can be resolved', async () => {
    const asyncHandler = jest.fn().mockResolvedValue(true);
    let capturedHandler;
    const addSpy = jest
      .spyOn(registry, 'addEventListener')
      .mockImplementation((_, __, handler) => {
        capturedHandler = handler;
        return 'async-click';
      });

    registry.addAsyncClickHandler(null, asyncHandler);
    await capturedHandler({});

    expect(asyncHandler).toHaveBeenCalledWith({});
    addSpy.mockRestore();
  });

  it('warns when a listener removal is attempted for an unknown id', () => {
    expect(registry.removeEventListener('missing')).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      "TestController: Listener 'missing' not found"
    );
  });

  it('ignores preventDefault calls when no event is supplied', () => {
    const handler = jest.fn();
    registry.preventDefault(null, handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it('handles unexpected undefined listeners during cleanup without throwing', () => {
    registry.addEventListener(element, 'click', jest.fn());

    const originalPop = Array.prototype.pop;
    const popSpy = jest
      .spyOn(Array.prototype, 'pop')
      .mockImplementation(function (...args) {
        originalPop.apply(this, args);
        return undefined;
      });

    try {
      registry.removeAllEventListeners();
      expect(element.removeEventListener).not.toHaveBeenCalled();
    } finally {
      popSpy.mockRestore();
    }
  });
});
