import {
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import {
  createTimeoutMiddleware,
  createSizeLimitConfig,
} from '../../../src/middleware/timeout.js';

describe('timeout middleware', () => {
  let req, res, next;
  let originalSend, originalJson, originalEnd;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');
    jest.spyOn(global, 'clearTimeout');

    req = {
      path: '/test',
      method: 'POST',
    };

    originalSend = jest.fn().mockReturnThis();
    originalJson = jest.fn().mockReturnThis();
    originalEnd = jest.fn().mockReturnThis();

    res = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: originalJson,
      send: originalSend,
      end: originalEnd,
      on: jest.fn(),
    };

    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('createTimeoutMiddleware', () => {
    test('creates middleware with default timeout of 30000ms', () => {
      const middleware = createTimeoutMiddleware();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    test('creates middleware with custom timeout', () => {
      const customTimeout = 5000;
      const middleware = createTimeoutMiddleware(customTimeout);

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(setTimeout).toHaveBeenCalledWith(
        expect.any(Function),
        customTimeout
      );
    });

    test('sends 503 error when timeout occurs', () => {
      const middleware = createTimeoutMiddleware(1000);

      middleware(req, res, next);

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(1000);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(originalJson).toHaveBeenCalledWith({
        error: true,
        message: 'Request timeout - the server took too long to respond.',
        stage: 'request_timeout',
        details: {
          timeoutMs: 1000,
          path: '/test',
          method: 'POST',
        },
        originalStatusCode: 503,
      });
    });

    test('does not send error if headers already sent when timeout occurs', () => {
      const middleware = createTimeoutMiddleware(1000);
      res.headersSent = true;

      middleware(req, res, next);

      jest.advanceTimersByTime(1000);

      expect(res.status).not.toHaveBeenCalled();
      expect(originalJson).not.toHaveBeenCalled();
    });

    test('clears timeout when res.send is called', () => {
      const middleware = createTimeoutMiddleware(1000);

      middleware(req, res, next);

      // Call the wrapped send method
      res.send('response');

      // Advance time past timeout
      jest.advanceTimersByTime(2000);

      // Timeout should not have fired
      expect(res.status).not.toHaveBeenCalledWith(503);
    });

    test('clears timeout when res.json is called', () => {
      const middleware = createTimeoutMiddleware(1000);

      middleware(req, res, next);

      // Call the wrapped json method
      res.json({ data: 'response' });

      jest.advanceTimersByTime(2000);

      expect(res.status).not.toHaveBeenCalledWith(503);
    });

    test('clears timeout when res.end is called', () => {
      const middleware = createTimeoutMiddleware(1000);

      middleware(req, res, next);

      // Call the wrapped end method
      res.end();

      jest.advanceTimersByTime(2000);

      expect(res.status).not.toHaveBeenCalledWith(503);
    });

    test('clears timeout on response finish event', () => {
      const middleware = createTimeoutMiddleware(1000);

      middleware(req, res, next);

      // Get the finish event handler
      const finishHandler = res.on.mock.calls.find(
        (call) => call[0] === 'finish'
      )[1];

      // Trigger finish event
      finishHandler();

      jest.advanceTimersByTime(2000);

      expect(res.status).not.toHaveBeenCalledWith(503);
    });

    test('clears timeout on response close event', () => {
      const middleware = createTimeoutMiddleware(1000);

      middleware(req, res, next);

      // Get the close event handler
      const closeHandler = res.on.mock.calls.find(
        (call) => call[0] === 'close'
      )[1];

      // Trigger close event
      closeHandler();

      jest.advanceTimersByTime(2000);

      expect(res.status).not.toHaveBeenCalledWith(503);
    });

    test('wrapped response methods maintain their context and arguments', () => {
      const middleware = createTimeoutMiddleware();
      const testData = { foo: 'bar' };

      middleware(req, res, next);

      // Test that wrapped methods still work correctly
      res.json(testData);
      expect(originalJson).toHaveBeenCalledWith(testData);

      res.send('text response');
      expect(originalSend).toHaveBeenCalledWith('text response');

      res.end();
      expect(originalEnd).toHaveBeenCalled();
    });

    test('multiple calls to response methods only clear timeout once', () => {
      const middleware = createTimeoutMiddleware(1000);

      middleware(req, res, next);

      // Call multiple response methods
      res.json({ data: 'first' });
      res.json({ data: 'second' });
      res.send('third');

      jest.advanceTimersByTime(2000);

      // Should not timeout
      expect(res.status).not.toHaveBeenCalledWith(503);

      // All methods should have been called
      expect(originalJson).toHaveBeenCalledTimes(2);
      expect(originalSend).toHaveBeenCalledTimes(1);
    });
  });

  describe('createSizeLimitConfig', () => {
    test('returns default configuration when no options provided', () => {
      const config = createSizeLimitConfig();

      expect(config).toEqual({
        json: {
          limit: '1mb',
          strict: true,
          type: 'application/json',
        },
      });
    });

    test('uses custom jsonLimit when provided', () => {
      const config = createSizeLimitConfig({ jsonLimit: '5mb' });

      expect(config).toEqual({
        json: {
          limit: '5mb',
          strict: true,
          type: 'application/json',
        },
      });
    });

    test('returns correct structure for Express body parser', () => {
      const config = createSizeLimitConfig({ jsonLimit: '10mb' });

      expect(config).toHaveProperty('json');
      expect(config.json).toHaveProperty('limit', '10mb');
      expect(config.json).toHaveProperty('strict', true);
      expect(config.json).toHaveProperty('type', 'application/json');
    });

    test('handles empty options object', () => {
      const config = createSizeLimitConfig({});

      expect(config.json.limit).toBe('1mb');
    });

    test('handles various size limit formats', () => {
      const testCases = [
        { input: '100kb', expected: '100kb' },
        { input: '2mb', expected: '2mb' },
        { input: '512kb', expected: '512kb' },
      ];

      testCases.forEach(({ input, expected }) => {
        const config = createSizeLimitConfig({ jsonLimit: input });
        expect(config.json.limit).toBe(expected);
      });
    });
  });});
