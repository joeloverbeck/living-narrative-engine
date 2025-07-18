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

      expect(config.json).toMatchObject({
        limit: '1mb',
        strict: true,
        type: 'application/json',
      });
      expect(config.json).toHaveProperty('verify');
      expect(typeof config.json.verify).toBe('function');
    });

    test('uses custom jsonLimit when provided', () => {
      const config = createSizeLimitConfig({ jsonLimit: '5mb' });

      expect(config.json).toMatchObject({
        limit: '5mb',
        strict: true,
        type: 'application/json',
      });
      expect(config.json).toHaveProperty('verify');
      expect(typeof config.json.verify).toBe('function');
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

    test('enforces maximum security limit by default', () => {
      const config = createSizeLimitConfig({ jsonLimit: '50mb' });

      // Should be capped at security maximum (10mb)
      expect(config.json.limit).toBe('10mb');
    });

    test('allows disabling maximum security limit enforcement', () => {
      const config = createSizeLimitConfig({
        jsonLimit: '50mb',
        enforceMaxLimit: false,
      });

      // Should allow the custom limit when enforcement is disabled
      expect(config.json.limit).toBe('50mb');
    });

    test('includes verify function for size validation', () => {
      const config = createSizeLimitConfig();

      expect(config.json).toHaveProperty('verify');
      expect(typeof config.json.verify).toBe('function');
    });

    test('verify function throws error for oversized payloads', () => {
      const config = createSizeLimitConfig();
      const verifyFunction = config.json.verify;

      // Create a buffer larger than 10MB (security max)
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB

      expect(() => {
        verifyFunction({}, {}, largeBuffer);
      }).toThrow('Request payload too large');
    });

    test('verify function allows payloads within size limit', () => {
      const config = createSizeLimitConfig();
      const verifyFunction = config.json.verify;

      // Create a buffer smaller than 10MB
      const smallBuffer = Buffer.alloc(1024); // 1KB

      expect(() => {
        verifyFunction({}, {}, smallBuffer);
      }).not.toThrow();
    });

    test('error thrown by verify function has correct properties', () => {
      const config = createSizeLimitConfig();
      const verifyFunction = config.json.verify;

      const largeBuffer = Buffer.alloc(11 * 1024 * 1024);

      expect(() => {
        verifyFunction({}, {}, largeBuffer);
      }).toThrow();

      let thrownError;
      try {
        verifyFunction({}, {}, largeBuffer);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError.message).toBe('Request payload too large');
      expect(thrownError.status).toBe(413);
      expect(thrownError.code).toBe('LIMIT_FILE_SIZE');
    });

    test('parseSize helper function works correctly', () => {
      // Since parseSize is not exported, we test it indirectly through the config
      const testCases = [
        { input: '1mb', shouldEnforce: true },
        { input: '5mb', shouldEnforce: true },
        { input: '10mb', shouldEnforce: true },
        { input: '15mb', shouldEnforce: false }, // Should be capped
      ];

      testCases.forEach(({ input, shouldEnforce }) => {
        const config = createSizeLimitConfig({ jsonLimit: input });
        const expectedLimit = shouldEnforce ? input : '10mb';
        expect(config.json.limit).toBe(expectedLimit);
      });
    });

    test('handles edge case size values', () => {
      const edgeCases = [
        { input: '10240kb', expected: '10240kb' }, // Exactly 10MB in KB - should pass through
        { input: '10mb', expected: '10mb' }, // Exactly the limit
        { input: '10.1mb', expected: '10mb' }, // Just over the limit - should be capped
      ];

      edgeCases.forEach(({ input, expected }) => {
        const config = createSizeLimitConfig({ jsonLimit: input });
        expect(config.json.limit).toBe(expected);
      });
    });
  });

  describe('Security-focused size limit tests', () => {
    test('prevents DoS attacks via oversized payloads', () => {
      const config = createSizeLimitConfig();
      const verifyFunction = config.json.verify;

      // Simulate various attack payload sizes
      const attackSizes = [
        50 * 1024 * 1024, // 50MB
        100 * 1024 * 1024, // 100MB
        500 * 1024 * 1024, // 500MB
      ];

      attackSizes.forEach((size) => {
        const attackBuffer = Buffer.alloc(size);
        expect(() => {
          verifyFunction({}, {}, attackBuffer);
        }).toThrow('Request payload too large');
      });
    });

    test('allows legitimate payloads up to security limit', () => {
      const config = createSizeLimitConfig();
      const verifyFunction = config.json.verify;

      // Test payloads at various legitimate sizes
      const legitimateSizes = [
        1024, // 1KB
        1024 * 1024, // 1MB
        5 * 1024 * 1024, // 5MB
        10 * 1024 * 1024 - 1, // Just under 10MB
      ];

      legitimateSizes.forEach((size) => {
        const buffer = Buffer.alloc(size);
        expect(() => {
          verifyFunction({}, {}, buffer);
        }).not.toThrow();
      });
    });

    test('security configuration is consistent with constants', () => {
      const config = createSizeLimitConfig();

      // Default should be 1MB
      expect(config.json.limit).toBe('1mb');

      // Max should be enforced at 10MB
      const maxConfig = createSizeLimitConfig({ jsonLimit: '50mb' });
      expect(maxConfig.json.limit).toBe('10mb');
    });

    test('verify function correctly calculates buffer size', () => {
      const config = createSizeLimitConfig();
      const verifyFunction = config.json.verify;

      // Test exact size limits
      const exactLimit = Buffer.alloc(10 * 1024 * 1024); // Exactly 10MB
      const overLimit = Buffer.alloc(10 * 1024 * 1024 + 1); // 1 byte over

      expect(() => {
        verifyFunction({}, {}, exactLimit);
      }).not.toThrow();

      expect(() => {
        verifyFunction({}, {}, overLimit);
      }).toThrow();
    });
  });
});
