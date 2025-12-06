import {
  AsyncUtilitiesToolkit,
  registerToolkitForOwner,
  getToolkitForOwner,
  unregisterToolkitForOwner,
} from '../../../../src/characterBuilder/services/asyncUtilitiesToolkit.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('asyncUtilitiesToolkit', () => {
  let toolkit;
  let logger;
  let originalRaf;
  let originalCancelRaf;

  beforeEach(() => {
    jest.useFakeTimers();
    logger = createLogger();
    originalRaf = global.requestAnimationFrame;
    originalCancelRaf = global.cancelAnimationFrame;
    global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
    global.cancelAnimationFrame = (id) => clearTimeout(id);
    toolkit = new AsyncUtilitiesToolkit({ logger });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    global.requestAnimationFrame = originalRaf;
    global.cancelAnimationFrame = originalCancelRaf;
  });

  it('asyncUtilitiesToolkit creates debounced handlers respecting leading/trailing options', () => {
    const fn = jest.fn();
    const debounced = toolkit.debounce(fn, 50, {
      leading: true,
      trailing: true,
    });

    debounced('one');
    debounced('two');

    expect(fn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(60);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('two');
  });

  it('asyncUtilitiesToolkit creates throttled handlers and prevents rapid firing', () => {
    const fn = jest.fn();
    const throttled = toolkit.throttle(fn, 100, {
      leading: true,
      trailing: true,
    });

    throttled('first');
    throttled('second');

    expect(fn).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('second');
  });

  it('asyncUtilitiesToolkit trailing-only throttle waits full delay on first call', () => {
    const fn = jest.fn();
    const throttled = toolkit.throttle(fn, 100, {
      leading: false,
      trailing: true,
    });

    throttled('first');
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('first');
  });

  it('asyncUtilitiesToolkit namespaces debounced handlers by key', () => {
    const fn = jest.fn();
    const handlerA = toolkit.getDebouncedHandler('search', fn, 25);
    const handlerB = toolkit.getDebouncedHandler('search', fn, 25);

    expect(handlerA).toBe(handlerB);
  });

  it('asyncUtilitiesToolkit tracks timers for stats and clearAllTimers()', () => {
    const timeout = toolkit.setTimeout(jest.fn(), 100);
    const interval = toolkit.setInterval(jest.fn(), 200);
    const frame = toolkit.requestAnimationFrame(jest.fn());

    const statsBefore = toolkit.getTimerStats();
    expect(statsBefore.timeouts.count).toBe(1);
    expect(statsBefore.intervals.count).toBe(1);
    expect(statsBefore.animationFrames.count).toBe(1);

    const summary = toolkit.clearAllTimers();
    expect(summary).toEqual({
      timers: 1,
      intervals: 1,
      animationFrames: 1,
      debouncedHandlers: 0,
      throttledHandlers: 0,
    });

    const statsAfter = toolkit.getTimerStats();
    expect(statsAfter.timeouts.count).toBe(0);
    expect(statsAfter.intervals.count).toBe(0);
    expect(statsAfter.animationFrames.count).toBe(0);

    // Ensure IDs can still be cleared without errors
    toolkit.clearTimeout(timeout);
    toolkit.clearInterval(interval);
    toolkit.cancelAnimationFrame(frame);
  });

  it('asyncUtilitiesToolkit throws helpful errors when invalid handlers supplied', () => {
    expect(() => toolkit.debounce(null, 20)).toThrow('expects a function');
    expect(() => toolkit.getThrottledHandler('key', null, 20)).toThrow(
      'expects a function'
    );
    expect(() => toolkit.getDebouncedHandler('', () => {}, 20)).toThrow(
      'requires a key'
    );
  });

  it('asyncUtilitiesToolkit clears handler wrappers when clearAllTimers() invoked', () => {
    const debounced = toolkit.getDebouncedHandler('save', jest.fn(), 40);
    const throttled = toolkit.getThrottledHandler('scroll', jest.fn(), 50);

    debounced('value');
    throttled('value');

    const summary = toolkit.clearAllTimers();
    expect(summary.debouncedHandlers).toBe(1);
    expect(summary.throttledHandlers).toBe(1);
  });

  it('asyncUtilitiesToolkit throttle helpers expose flush logic for pending and idle states', () => {
    const fn = jest.fn().mockReturnValue('executed');
    const throttled = toolkit.throttle(fn, 100, {
      leading: false,
      trailing: true,
    });

    // When no invocation is pending, flush should just return the latest result (undefined)
    expect(throttled.flush()).toBeUndefined();

    throttled('value');
    jest.advanceTimersByTime(20);
    expect(fn).not.toHaveBeenCalled();

    // Flush should execute immediately, clear timers, and forward the return value
    expect(throttled.flush()).toBe('executed');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('asyncUtilitiesToolkit validates required function arguments across helpers', () => {
    expect(() => toolkit.throttle(null, 50)).toThrow('expects a function');
    expect(() => toolkit.getDebouncedHandler('search', null, 25)).toThrow(
      'expects a function'
    );
    expect(() => toolkit.getThrottledHandler('', () => {}, 25)).toThrow(
      'requires a key'
    );
    expect(() => toolkit.setTimeout(null, 10)).toThrow('expects a function');
    expect(() => toolkit.setInterval(null, 10)).toThrow('expects a function');
    expect(() => toolkit.requestAnimationFrame(null)).toThrow(
      'expects a function'
    );
  });

  it('asyncUtilitiesToolkit instrumentation emits timer logs when enabled', () => {
    const instrumentedToolkit = new AsyncUtilitiesToolkit({
      logger,
      instrumentation: { logTimerEvents: true },
    });

    instrumentedToolkit.setTimeout(jest.fn(), 25);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('AsyncUtilitiesToolkit:timeout:scheduled'),
      expect.objectContaining({ timerId: expect.any(Number), delay: 25 })
    );

    jest.runOnlyPendingTimers();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('AsyncUtilitiesToolkit:timeout:completed'),
      expect.objectContaining({ timerId: expect.any(Number) })
    );
  });

  it('asyncUtilitiesToolkit owner registry helpers manage ownership lifecycle', () => {
    const owner = { id: 'owner-1' };
    const otherOwner = { id: 'owner-2' };

    // Guard clause coverage for missing owner/toolkit
    registerToolkitForOwner(null, toolkit);
    registerToolkitForOwner(owner, null);

    registerToolkitForOwner(owner, toolkit);
    expect(getToolkitForOwner(owner)).toBe(toolkit);
    expect(getToolkitForOwner(otherOwner)).toBeNull();

    unregisterToolkitForOwner(owner);
    expect(getToolkitForOwner(owner)).toBeNull();
  });
});
