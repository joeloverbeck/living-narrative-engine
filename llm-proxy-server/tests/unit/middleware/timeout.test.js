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
      requestId: 'test-request-id',
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
          requestId: 'test-request-id',
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

    test('logs warning when timeout cannot commit due to existing response', () => {
      const logger = {
        warn: jest.fn(),
        debug: jest.fn(),
      };

      res.commitResponse = jest.fn().mockReturnValue(false);
      res.getCommitmentSource = jest.fn().mockReturnValue('success');
      res.isResponseCommitted = jest.fn().mockReturnValue(true);

      const middleware = createTimeoutMiddleware(1000, { logger });
      middleware(req, res, next);

      jest.advanceTimersByTime(1000);

      expect(res.status).not.toHaveBeenCalled();
      expect(res.isResponseCommitted).toHaveBeenCalled();
      expect(res.getCommitmentSource).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Request test-request-id: Timeout cannot commit response - already committed to 'success'",
        expect.objectContaining({ existingCommitment: 'success' })
      );
    });

    test('uses fallback metadata when commitment source is unavailable', () => {
      const logger = {
        warn: jest.fn(),
        debug: jest.fn(),
      };

      res.commitResponse = jest.fn().mockReturnValue(false);
      res.getCommitmentSource = jest.fn().mockImplementation(() => {
        // Simulate the tracker becoming unavailable between invocations so the
        // branch that falls back to "unknown" is exercised.
        res.getCommitmentSource = null;
        return 'preexisting-response';
      });
      res.isResponseCommitted = jest.fn().mockReturnValue(true);

      const middleware = createTimeoutMiddleware(750, { logger });
      middleware(req, res, next);

      jest.advanceTimersByTime(750);

      expect(res.status).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        "Request test-request-id: Timeout cannot commit response - already committed to 'preexisting-response'",
        expect.objectContaining({
          requestId: 'test-request-id',
          existingCommitment: 'unknown',
        })
      );
    });

    test('handles commit conflicts gracefully when logger is not provided', () => {
      res.commitResponse = jest.fn().mockReturnValue(false);
      res.getCommitmentSource = jest.fn().mockReturnValue('another-handler');

      const middleware = createTimeoutMiddleware(400);
      middleware(req, res, next);

      expect(() => {
        jest.advanceTimersByTime(400);
      }).not.toThrow();

      expect(res.commitResponse).toHaveBeenCalledWith('timeout');
      expect(res.status).not.toHaveBeenCalled();
    });

    test('respects grace period before dispatching timeout response', () => {
      const logger = {
        warn: jest.fn(),
        debug: jest.fn(),
      };

      res.commitResponse = jest.fn().mockReturnValue(true);
      res.getCommitmentSource = jest.fn();
      res.isResponseCommitted = jest.fn().mockReturnValue(false);
      req.transitionState = jest.fn();

      const middleware = createTimeoutMiddleware(1000, {
        logger,
        gracePeriod: 200,
      });

      middleware(req, res, next);

      jest.advanceTimersByTime(1000);
      expect(res.status).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'Request test-request-id: Entering grace period of 200ms',
        expect.objectContaining({ requestId: 'test-request-id' })
      );

      jest.advanceTimersByTime(200);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(logger.warn).toHaveBeenCalledWith(
        'Request test-request-id: Timeout response sent',
        { requestId: 'test-request-id' }
      );
      expect(req.transitionState).toHaveBeenCalledWith('timeout', {
        timeoutMs: 1000,
      });
    });

    test('logs timeout metadata with default commitment state when tracker missing', () => {
      const logger = {
        warn: jest.fn(),
        debug: jest.fn(),
      };

      res.commitResponse = jest.fn().mockReturnValue(true);
      delete res.isResponseCommitted;
      delete res.getCommitmentSource;

      const middleware = createTimeoutMiddleware(1000, { logger });
      middleware(req, res, next);

      jest.advanceTimersByTime(1000);

      const timeoutWarn = logger.warn.mock.calls.find((call) =>
        call[0].includes('Timeout fired after')
      );

      expect(timeoutWarn).toBeDefined();
      expect(timeoutWarn[1]).toMatchObject({
        responseCommitted: false,
        headersSent: false,
      });
    });

    test('clears grace period timer on finish events when configured', () => {
      const logger = {
        warn: jest.fn(),
        debug: jest.fn(),
      };

      res.commitResponse = jest.fn().mockReturnValue(true);
      res.getCommitmentSource = jest.fn();
      res.isResponseCommitted = jest.fn().mockReturnValue(false);

      const middleware = createTimeoutMiddleware(1000, {
        logger,
        gracePeriod: 250,
      });

      middleware(req, res, next);

      // Trigger the main timeout so the grace period timer is created
      jest.advanceTimersByTime(1000);

      // Capture the grace period timer id from the setTimeout spy
      const graceTimerId = setTimeout.mock.results
        .slice(1)
        .find(
          (call, index) => setTimeout.mock.calls[index + 1]?.[1] === 250
        )?.value;

      expect(graceTimerId).toBeDefined();

      // Reset clearTimeout calls to focus on the finish handler behaviour
      clearTimeout.mockClear();

      const finishHandler = res.on.mock.calls.find(
        (call) => call[0] === 'finish'
      )[1];
      finishHandler();

      expect(clearTimeout).toHaveBeenCalledWith(graceTimerId);
    });

    test('warns when headers already sent during timeout response', () => {
      const logger = {
        warn: jest.fn(),
        debug: jest.fn(),
      };

      res.headersSent = true;
      res.commitResponse = jest.fn().mockReturnValue(true);
      res.isResponseCommitted = jest.fn().mockReturnValue(false);
      res.getCommitmentSource = jest.fn();

      const middleware = createTimeoutMiddleware(1000, { logger });
      middleware(req, res, next);

      jest.advanceTimersByTime(1000);

      expect(logger.warn).toHaveBeenCalledWith(
        'Request test-request-id: Cannot send timeout response - headers already sent',
        { requestId: 'test-request-id' }
      );
      expect(res.status).not.toHaveBeenCalled();
    });

    test('logs connection closure after timeout and clears grace period timer', () => {
      const logger = {
        warn: jest.fn(),
        debug: jest.fn(),
      };

      res.commitResponse = jest.fn().mockReturnValue(true);
      res.getCommitmentSource = jest.fn();
      res.isResponseCommitted = jest.fn().mockReturnValue(false);

      const middleware = createTimeoutMiddleware(1000, {
        logger,
        gracePeriod: 200,
      });

      middleware(req, res, next);

      jest.advanceTimersByTime(1000);

      const graceTimerId = setTimeout.mock.results
        .slice(1)
        .find(
          (call, index) => setTimeout.mock.calls[index + 1]?.[1] === 200
        )?.value;

      expect(graceTimerId).toBeDefined();

      clearTimeout.mockClear();

      const closeHandler = res.on.mock.calls.find(
        (call) => call[0] === 'close'
      )[1];
      closeHandler();

      expect(logger.debug).toHaveBeenCalledWith(
        'Request test-request-id: Connection closed after timeout',
        { requestId: 'test-request-id' }
      );
      expect(clearTimeout).toHaveBeenCalledWith(graceTimerId);
    });

    test('logs debug details when response methods run post-timeout', () => {
      const logger = {
        warn: jest.fn(),
        debug: jest.fn(),
      };

      res.commitResponse = jest.fn().mockReturnValue(true);
      res.isResponseCommitted = jest.fn().mockReturnValue(false);
      res.getCommitmentSource = jest.fn();

      const middleware = createTimeoutMiddleware(1000, { logger });
      middleware(req, res, next);

      jest.advanceTimersByTime(1000);
      res.send('payload');

      expect(logger.debug).toHaveBeenCalledWith(
        "Request test-request-id: Response method 'send' called after timeout",
        expect.objectContaining({ method: 'send', timeElapsed: 1000 })
      );
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

    test('supports size strings without explicit units using bytes fallback', () => {
      const config = createSizeLimitConfig({ jsonLimit: '2048' });

      expect(config.json.limit).toBe('2048');

      const verifyFunction = config.json.verify;
      expect(() => verifyFunction({}, {}, Buffer.alloc(1024))).not.toThrow();
    });

    test('handles gigabyte inputs by enforcing maximum security limit', () => {
      const config = createSizeLimitConfig({ jsonLimit: '0.5gb' });

      expect(config.json.limit).toBe('10mb');
    });

    test('falls back to byte multiplier when unit parsing yields unsupported value', () => {
      const originalMatch = String.prototype.match;

      String.prototype.match = function (pattern) {
        if (
          typeof this === 'string' &&
          this === '11000000tb' &&
          pattern instanceof RegExp &&
          pattern.source === '^(\\d+(?:\\.\\d+)?)\\s*(b|kb|mb|gb)?$'
        ) {
          return ['11000000tb', '11000000', 'tb'];
        }

        return originalMatch.call(this, pattern);
      };

      try {
        const config = createSizeLimitConfig({ jsonLimit: '11000000tb' });

        expect(config.json.limit).toBe('10mb');
      } finally {
        String.prototype.match = originalMatch;
      }
    });

    test('supports numeric jsonLimit values', () => {
      const config = createSizeLimitConfig({ jsonLimit: 5120 });

      expect(config.json.limit).toBe(5120);

      const verifyFunction = config.json.verify;
      expect(() => verifyFunction({}, {}, Buffer.alloc(5120))).not.toThrow();
    });

    test('gracefully handles malformed size strings', () => {
      const config = createSizeLimitConfig({ jsonLimit: 'five megabytes' });

      expect(config.json.limit).toBe('five megabytes');
    });

    test('grace period flow works without logger instrumentation', () => {
      res.commitResponse = jest.fn().mockReturnValue(true);
      req.transitionState = jest.fn();

      const middleware = createTimeoutMiddleware(1000, { gracePeriod: 100 });
      middleware(req, res, next);

      jest.advanceTimersByTime(1000);
      jest.advanceTimersByTime(100);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(req.transitionState).toHaveBeenCalledWith('timeout', {
        timeoutMs: 1000,
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

  describe('Route-specific timeout configuration for LLM requests', () => {
    let req, res, next;

    beforeEach(() => {
      jest.useFakeTimers();
      jest.spyOn(global, 'setTimeout');
      jest.spyOn(global, 'clearTimeout');

      req = {
        path: '/',
        method: 'GET',
      };

      res = {
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
      };

      next = jest.fn();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    test('should apply 90 second timeout for LLM requests', () => {
      // Simulate the actual route configuration for LLM requests
      const llmTimeout = 90000; // 90 seconds
      const middleware = createTimeoutMiddleware(llmTimeout);

      // Store the original json method before middleware wraps it
      const originalJsonMethod = jest.fn().mockReturnThis();
      res.json = originalJsonMethod;

      req.path = '/api/llm-request';
      middleware(req, res, next);

      // Advance time less than timeout - should not trigger
      jest.advanceTimersByTime(80000);
      expect(res.status).not.toHaveBeenCalled();

      // Advance past timeout - should trigger
      jest.advanceTimersByTime(11000);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(originalJsonMethod).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          message: 'Request timeout - the server took too long to respond.',
          stage: 'request_timeout',
          details: expect.objectContaining({
            timeoutMs: llmTimeout,
            path: '/api/llm-request',
          }),
        })
      );
    });

    test('should handle route-specific timeout logic from server.js', () => {
      // This simulates the server.js logic for skipping general timeout on /api/llm-request
      const routeSpecificMiddleware = (req, res, next) => {
        if (req.path === '/api/llm-request') {
          // Skip general timeout for LLM routes
          return next();
        }
        // Apply 30 second timeout for all other routes
        return createTimeoutMiddleware(30000)(req, res, next);
      };

      // Test with LLM request path - should skip timeout
      req.path = '/api/llm-request';
      routeSpecificMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      // No timeout should be set when we skip it
      jest.advanceTimersByTime(35000);
      expect(res.status).not.toHaveBeenCalled();
    });

    test('should handle concurrent requests with different timeout configurations', () => {
      const generalTimeout = createTimeoutMiddleware(30000);
      const llmTimeout = createTimeoutMiddleware(90000);

      // Create separate response objects for concurrent requests
      const generalRes = {
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
      };

      const llmRes = {
        headersSent: false,
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
      };

      // Start both requests
      generalTimeout({ path: '/api/other', method: 'GET' }, generalRes, next);
      llmTimeout({ path: '/api/llm-request', method: 'POST' }, llmRes, next);

      // After 30 seconds, only the general request should timeout
      jest.advanceTimersByTime(30000);
      expect(generalRes.status).toHaveBeenCalledWith(503);
      expect(llmRes.status).not.toHaveBeenCalled();

      // After 90 seconds total, both should have timed out
      jest.advanceTimersByTime(60000);
      expect(llmRes.status).toHaveBeenCalledWith(503);
    });
  });
});
