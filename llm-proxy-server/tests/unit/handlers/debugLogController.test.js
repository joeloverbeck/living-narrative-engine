import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import DebugLogController from '../../../src/handlers/debugLogController.js';

jest.mock('../../../src/utils/responseUtils.js', () => ({
  sendProxyError: jest.fn(),
}));
import { sendProxyError } from '../../../src/utils/responseUtils.js';

jest.mock('../../../src/utils/loggerUtils.js', () => ({
  ensureValidLogger: jest.fn(
    (logger) =>
      logger || {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }
  ),
}));

jest.mock('../../../src/services/logStorageService.js', () => {
  return jest.fn().mockImplementation(() => ({
    writeLogs: jest.fn(),
    shutdown: jest.fn(),
  }));
});

// Test utilities
const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockStorageService = () => ({
  writeLogs: jest.fn(),
  shutdown: jest.fn(),
});

const createMockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const createMockRequest = (body = {}) => ({
  body,
});

// Valid debug log entries for testing
const validLogEntry = {
  level: 'info',
  message: 'Test log message',
  timestamp: '2024-01-01T12:00:00.000Z',
  category: 'test',
  source: 'test.js:123',
  sessionId: '550e8400-e29b-41d4-a716-446655440000',
  metadata: { userId: 'test-user' },
};

const minimalLogEntry = {
  level: 'error',
  message: 'Error message',
  timestamp: '2024-01-01T12:00:00.000Z',
};

describe('DebugLogController', () => {
  let controller;
  let logger;

  beforeEach(() => {
    logger = createLogger();
    controller = new DebugLogController(logger);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should create instance with valid logger', () => {
      expect(controller).toBeDefined();
      expect(controller instanceof DebugLogController).toBe(true);
    });

    test('should handle null logger gracefully', () => {
      expect(() => new DebugLogController(null)).not.toThrow();
    });
  });

  describe('handleDebugLog', () => {
    test('should process valid debug logs successfully', async () => {
      const req = createMockRequest({
        logs: [validLogEntry, minimalLogEntry],
      });
      const res = createMockResponse();

      await controller.handleDebugLog(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        processed: 2,
        timestamp: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
        ),
      });
      expect(logger.info).toHaveBeenCalledWith(
        'Debug logs processed successfully',
        expect.objectContaining({
          processedCount: 2,
          totalLogs: 2,
          processingTimeMs: expect.any(Number),
          endpoint: '/api/debug-log',
        })
      );
    });

    test('should handle empty logs array gracefully', async () => {
      const req = createMockRequest({
        logs: [],
      });
      const res = createMockResponse();

      await controller.handleDebugLog(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        processed: 0,
        timestamp: expect.any(String),
      });
    });

    test('should reject non-array logs with error', async () => {
      const req = createMockRequest({
        logs: 'not-an-array',
      });
      const res = createMockResponse();

      await controller.handleDebugLog(req, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        400,
        'request_validation',
        'logs must be an array',
        {
          providedType: 'string',
          expectedType: 'array',
        },
        'debug-log-validation-failed',
        logger
      );
    });

    test('should reject null logs with error', async () => {
      const req = createMockRequest({
        logs: null,
      });
      const res = createMockResponse();

      await controller.handleDebugLog(req, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        400,
        'request_validation',
        'logs must be an array',
        {
          providedType: 'object',
          expectedType: 'array',
        },
        'debug-log-validation-failed',
        logger
      );
    });

    test('should handle processing errors gracefully', async () => {
      // Mock logger to throw an error during processing
      const faultyLogger = {
        ...createLogger(),
        info: jest.fn().mockImplementation(() => {
          throw new Error('Logger failure');
        }),
      };

      const faultyController = new DebugLogController(faultyLogger);
      const req = createMockRequest({
        logs: [validLogEntry],
      });
      const res = createMockResponse();

      await faultyController.handleDebugLog(req, res);

      expect(sendProxyError).toHaveBeenCalledWith(
        res,
        500,
        'debug_log_processing',
        'Failed to process debug logs',
        {
          originalErrorMessage: 'Logger failure',
        },
        'debug-log-processing-failed',
        expect.any(Object)
      );
    });

    test('should log client messages with appropriate server log levels', async () => {
      const debugLog = { ...validLogEntry, level: 'debug' };
      const infoLog = { ...validLogEntry, level: 'info' };
      const warnLog = { ...validLogEntry, level: 'warn' };
      const errorLog = { ...validLogEntry, level: 'error' };

      const req = createMockRequest({
        logs: [debugLog, infoLog, warnLog, errorLog],
      });
      const res = createMockResponse();

      await controller.handleDebugLog(req, res);

      expect(logger.debug).toHaveBeenCalledWith(
        '[CLIENT] [TEST] (test.js:123) Test log message',
        expect.objectContaining({
          clientLog: true,
          category: 'test',
          source: 'test.js:123',
        })
      );

      expect(logger.info).toHaveBeenCalledWith(
        '[CLIENT] [TEST] (test.js:123) Test log message',
        expect.objectContaining({
          clientLog: true,
        })
      );

      expect(logger.warn).toHaveBeenCalledWith(
        '[CLIENT] [TEST] (test.js:123) Test log message',
        expect.objectContaining({
          clientLog: true,
        })
      );

      expect(logger.error).toHaveBeenCalledWith(
        '[CLIENT] [TEST] (test.js:123) Test log message',
        expect.objectContaining({
          clientLog: true,
        })
      );
    });

    test('should handle malformed log entries gracefully', async () => {
      const malformedLog = {
        level: 'info',
        message: null, // This will be converted to "null" string
        timestamp: '2024-01-01T12:00:00.000Z',
      };

      const req = createMockRequest({
        logs: [validLogEntry, malformedLog],
      });
      const res = createMockResponse();

      await controller.handleDebugLog(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        processed: 2, // Both logs should be processed (null becomes "null")
        timestamp: expect.any(String),
      });
    });

    test('should format log messages correctly with optional fields', async () => {
      const logWithoutOptionals = {
        level: 'info',
        message: 'Simple message',
        timestamp: '2024-01-01T12:00:00.000Z',
      };

      const logWithCategory = {
        level: 'info',
        message: 'Category message',
        timestamp: '2024-01-01T12:00:00.000Z',
        category: 'ui',
      };

      const logWithSource = {
        level: 'info',
        message: 'Source message',
        timestamp: '2024-01-01T12:00:00.000Z',
        source: 'component.js:45',
      };

      const req = createMockRequest({
        logs: [logWithoutOptionals, logWithCategory, logWithSource],
      });
      const res = createMockResponse();

      await controller.handleDebugLog(req, res);

      expect(logger.info).toHaveBeenCalledWith(
        '[CLIENT] Simple message',
        expect.any(Object)
      );

      expect(logger.info).toHaveBeenCalledWith(
        '[CLIENT] [UI] Category message',
        expect.any(Object)
      );

      expect(logger.info).toHaveBeenCalledWith(
        '[CLIENT] (component.js:45) Source message',
        expect.any(Object)
      );
    });

    test('should include all metadata in server log context', async () => {
      const req = createMockRequest({
        logs: [validLogEntry],
      });
      const res = createMockResponse();

      await controller.handleDebugLog(req, res);

      expect(logger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          clientLog: true,
          category: 'test',
          source: 'test.js:123',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          timestamp: '2024-01-01T12:00:00.000Z',
          metadata: { userId: 'test-user' },
        })
      );
    });

    test('should handle large batch of logs efficiently', async () => {
      const largeBatch = Array(500).fill(validLogEntry);
      const req = createMockRequest({
        logs: largeBatch,
      });
      const res = createMockResponse();

      const startTime = Date.now();
      await controller.handleDebugLog(req, res);
      const endTime = Date.now();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        processed: 500,
        timestamp: expect.any(String),
      });

      // Should process reasonably quickly (under 5 seconds even for large batches)
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('LogStorageService Integration', () => {
    let mockStorageService;
    let controllerWithStorage;

    beforeEach(() => {
      mockStorageService = createMockStorageService();
      controllerWithStorage = new DebugLogController(
        logger,
        mockStorageService
      );
      jest.clearAllMocks();
    });

    test('should initialize with storage service', () => {
      expect(controllerWithStorage).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith(
        'DebugLogController: Initialized with log storage service'
      );
    });

    test('should initialize without storage service', () => {
      new DebugLogController(logger);
      expect(logger.info).toHaveBeenCalledWith(
        'DebugLogController: Initialized with console-only logging'
      );
    });

    test('should use storage service for log processing', async () => {
      mockStorageService.writeLogs.mockResolvedValueOnce(2);

      const req = createMockRequest({
        logs: [validLogEntry, minimalLogEntry],
      });
      const res = createMockResponse();

      await controllerWithStorage.handleDebugLog(req, res);

      expect(mockStorageService.writeLogs).toHaveBeenCalledWith([
        validLogEntry,
        minimalLogEntry,
      ]);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        processed: 2,
        timestamp: expect.any(String),
      });
      expect(logger.debug).toHaveBeenCalledWith(
        'DebugLogController.#processLogs: Logs written to storage service',
        expect.objectContaining({
          storedCount: 2,
          totalLogs: 2,
        })
      );
    });

    test('should fallback to console logging when storage service fails', async () => {
      const storageError = new Error('Storage service unavailable');
      mockStorageService.writeLogs.mockRejectedValueOnce(storageError);

      const req = createMockRequest({
        logs: [validLogEntry],
      });
      const res = createMockResponse();

      await controllerWithStorage.handleDebugLog(req, res);

      expect(mockStorageService.writeLogs).toHaveBeenCalledWith([
        validLogEntry,
      ]);
      expect(logger.warn).toHaveBeenCalledWith(
        'DebugLogController.#processLogs: Storage service failed, falling back to console logging',
        expect.objectContaining({
          error: 'Storage service unavailable',
          logsCount: 1,
        })
      );

      // Should fallback to console logging
      expect(logger.info).toHaveBeenCalledWith(
        '[CLIENT] [TEST] (test.js:123) Test log message',
        expect.objectContaining({
          clientLog: true,
        })
      );

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        processed: 1,
        timestamp: expect.any(String),
      });
    });

    test('should handle partial storage service failures', async () => {
      mockStorageService.writeLogs.mockResolvedValueOnce(1); // Only 1 out of 2 processed

      const req = createMockRequest({
        logs: [validLogEntry, minimalLogEntry],
      });
      const res = createMockResponse();

      await controllerWithStorage.handleDebugLog(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        processed: 1, // Partial success
        timestamp: expect.any(String),
      });
    });

    test('should handle storage service returning zero logs processed', async () => {
      mockStorageService.writeLogs.mockResolvedValueOnce(0);

      const req = createMockRequest({
        logs: [validLogEntry],
      });
      const res = createMockResponse();

      await controllerWithStorage.handleDebugLog(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        processed: 0,
        timestamp: expect.any(String),
      });
    });

    test('should maintain performance with storage service integration', async () => {
      // Mock fast storage service response
      mockStorageService.writeLogs.mockImplementation(
        async (logs) => logs.length
      );

      const largeBatch = Array(1000).fill(validLogEntry);
      const req = createMockRequest({ logs: largeBatch });
      const res = createMockResponse();

      const startTime = Date.now();
      await controllerWithStorage.handleDebugLog(req, res);
      const endTime = Date.now();

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        processed: 1000,
        timestamp: expect.any(String),
      });

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
      expect(mockStorageService.writeLogs).toHaveBeenCalledWith(largeBatch);
    });
  });
});
