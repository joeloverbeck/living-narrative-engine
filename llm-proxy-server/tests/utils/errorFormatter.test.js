import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  sanitizeErrorForClient,
  createSecureErrorDetails,
  formatErrorForLogging,
  createSecureHttpErrorResponse,
} from '../../src/utils/errorFormatter.js';

describe('errorFormatter', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe('sanitizeErrorForClient', () => {
    test('should expose full error details in development environment', () => {
      process.env.NODE_ENV = 'development';

      const error = new Error('Database connection failed');
      const result = sanitizeErrorForClient(error, 'database_error');

      expect(result).toEqual({
        message: 'Database connection failed',
        stage: 'database_error',
        details: {
          originalErrorMessage: 'Database connection failed',
          errorName: 'Error',
        },
      });
    });

    test('should sanitize error details in production environment', () => {
      process.env.NODE_ENV = 'production';

      const error = new Error('Internal database password mismatch');
      const result = sanitizeErrorForClient(error, 'database_error');

      expect(result).toEqual({
        message: 'Internal server error occurred',
        stage: 'database_error',
        details: {
          originalErrorMessage: 'Internal error occurred',
          errorName: 'Error',
        },
      });
    });

    test('should handle custom error messages for production', () => {
      process.env.NODE_ENV = 'production';

      const error = new Error('Internal details');
      const result = sanitizeErrorForClient(
        error,
        'api_error',
        'Service temporarily unavailable'
      );

      expect(result).toEqual({
        message: 'Service temporarily unavailable',
        stage: 'api_error',
        details: {
          originalErrorMessage: 'Internal error occurred',
          errorName: 'Error',
        },
      });
    });

    test('should default to development behavior when NODE_ENV not set', () => {
      delete process.env.NODE_ENV;

      const error = new Error('Test error');
      const result = sanitizeErrorForClient(error, 'test_error');

      expect(result).toEqual({
        message: 'Test error',
        stage: 'test_error',
        details: {
          originalErrorMessage: 'Test error',
          errorName: 'Error',
        },
      });
    });
  });

  describe('createSecureErrorDetails', () => {
    test('should create detailed error object in development', () => {
      process.env.NODE_ENV = 'development';

      const result = createSecureErrorDetails(
        'Validation failed',
        'validation_error',
        { field: 'email', value: 'invalid' },
        new Error('Schema validation error')
      );

      expect(result).toEqual({
        message: 'Validation failed',
        stage: 'validation_error',
        details: {
          field: 'email',
          value: 'invalid',
          originalErrorMessage: 'Schema validation error',
        },
      });
    });

    test('should sanitize error details in production', () => {
      process.env.NODE_ENV = 'production';

      const result = createSecureErrorDetails(
        'Validation failed',
        'validation_error',
        { field: 'email', internalPath: '/secret/path' },
        new Error('Internal schema details')
      );

      expect(result).toEqual({
        message: 'Validation failed',
        stage: 'validation_error',
        details: {
          field: 'email',
          // internalPath should be filtered out in production
          originalErrorMessage: 'Internal error occurred',
        },
      });
    });

    test('should filter sensitive fields from details in production', () => {
      process.env.NODE_ENV = 'production';

      const sensitiveDetails = {
        userId: '123',
        apiKey: 'sk-secret',
        password: 'secret123',
        internalPath: '/internal/path',
        stackTrace: 'Error at line 123...',
      };

      const result = createSecureErrorDetails(
        'Operation failed',
        'operation_error',
        sensitiveDetails
      );

      expect(result.details).toEqual({
        userId: '123',
        // sensitive fields should be filtered out
        originalErrorMessage: 'Internal error occurred',
      });
      expect(result.details.apiKey).toBeUndefined();
      expect(result.details.password).toBeUndefined();
      expect(result.details.internalPath).toBeUndefined();
      expect(result.details.stackTrace).toBeUndefined();
    });

    test('should preserve existing originalErrorMessage details', () => {
      process.env.NODE_ENV = 'production';

      const detailsWithOriginalMessage = {
        originalErrorMessage: 'Pre-sanitized message',
        context: 'important',
      };

      const result = createSecureErrorDetails(
        'Operation failed',
        'operation_error',
        detailsWithOriginalMessage
      );

      expect(result.details.originalErrorMessage).toBe('Pre-sanitized message');
      expect(result.details.context).toBe('important');
    });

    test('should handle null details gracefully in production', () => {
      process.env.NODE_ENV = 'production';

      const result = createSecureErrorDetails(
        'Operation failed',
        'operation_error',
        null
      );

      expect(result).toEqual({
        message: 'Operation failed',
        stage: 'operation_error',
        details: {
          originalErrorMessage: 'Internal error occurred',
        },
      });
    });

    test('should default details to empty object when not provided', () => {
      process.env.NODE_ENV = 'development';

      const result = createSecureErrorDetails(
        'Simple failure',
        'simple_stage',
        undefined,
        new Error('Root cause failure')
      );

      expect(result).toEqual({
        message: 'Simple failure',
        stage: 'simple_stage',
        details: {
          originalErrorMessage: 'Root cause failure',
        },
      });
    });
  });

  describe('sanitizeErrorForClient - additional coverage', () => {
    test('should handle string error input in development', () => {
      process.env.NODE_ENV = 'development';

      const result = sanitizeErrorForClient(
        'Database connection timeout',
        'database_error'
      );

      expect(result).toEqual({
        message: 'Database connection timeout',
        stage: 'database_error',
        details: {
          originalErrorMessage: 'Database connection timeout',
          errorName: 'Error',
        },
      });
    });

    test('should handle string error input in production', () => {
      process.env.NODE_ENV = 'production';

      const result = sanitizeErrorForClient(
        'Internal database error',
        'database_error'
      );

      expect(result).toEqual({
        message: 'Internal server error occurred',
        stage: 'database_error',
        details: {
          originalErrorMessage: 'Internal error occurred',
          errorName: 'Error',
        },
      });
    });

    test('should handle string error input with custom message in production', () => {
      process.env.NODE_ENV = 'production';

      const result = sanitizeErrorForClient(
        'Internal details',
        'api_error',
        'Service unavailable'
      );

      expect(result).toEqual({
        message: 'Service unavailable',
        stage: 'api_error',
        details: {
          originalErrorMessage: 'Internal error occurred',
          errorName: 'Error',
        },
      });
    });

    test('should handle non-Error/non-string input in development', () => {
      process.env.NODE_ENV = 'development';

      const result = sanitizeErrorForClient({ code: 500 }, 'unknown_error');

      expect(result).toEqual({
        message: 'Unknown error occurred',
        stage: 'unknown_error',
        details: {
          originalErrorMessage: 'Unknown error',
          errorName: 'Error',
        },
      });
    });

    test('should handle non-Error/non-string input in production', () => {
      process.env.NODE_ENV = 'production';

      const result = sanitizeErrorForClient({ code: 500 }, 'unknown_error');

      expect(result).toEqual({
        message: 'Unknown error occurred',
        stage: 'unknown_error',
        details: {
          originalErrorMessage: 'Internal error occurred',
          errorName: 'Error',
        },
      });
    });

    test('should handle non-Error/non-string input with custom message in production', () => {
      process.env.NODE_ENV = 'production';

      const result = sanitizeErrorForClient(
        null,
        'null_error',
        'Custom error message'
      );

      expect(result).toEqual({
        message: 'Custom error message',
        stage: 'null_error',
        details: {
          originalErrorMessage: 'Internal error occurred',
          errorName: 'Error',
        },
      });
    });
  });

  describe('formatErrorForLogging', () => {
    test('should format error for logging in development with stack trace', () => {
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');
      error.name = 'TestError';
      error.stack = 'TestError: Test error\n    at test.js:1:1';

      const context = { userId: '123', operation: 'test' };
      const result = formatErrorForLogging(error, context);

      expect(result).toEqual({
        message: 'Test error',
        name: 'TestError',
        userId: '123',
        operation: 'test',
        stack: 'TestError: Test error\n    at test.js:1:1',
      });
    });

    test('should format error for logging in production without stack trace', () => {
      process.env.NODE_ENV = 'production';

      const error = new Error('Test error');
      error.name = 'TestError';
      error.stack = 'TestError: Test error\n    at test.js:1:1';

      const context = { userId: '123', operation: 'test' };
      const result = formatErrorForLogging(error, context);

      expect(result).toEqual({
        message: 'Test error',
        name: 'TestError',
        userId: '123',
        operation: 'test',
        // stack should not be included in production
      });
      expect(result.stack).toBeUndefined();
    });

    test('should filter sensitive fields from context in production', () => {
      process.env.NODE_ENV = 'production';

      const error = new Error('Test error');
      const context = {
        userId: '123',
        apiKey: 'sk-secret',
        password: 'secret123',
        operation: 'test',
      };

      const result = formatErrorForLogging(error, context);

      expect(result).toEqual({
        message: 'Test error',
        name: 'Error',
        userId: '123',
        operation: 'test',
        // sensitive fields should be filtered out
      });
      expect(result.apiKey).toBeUndefined();
      expect(result.password).toBeUndefined();
    });

    test('should filter sensitive field names regardless of case', () => {
      process.env.NODE_ENV = 'production';

      const error = new Error('Test error');
      const context = {
        Authorization: 'Bearer token',
        Token: 'sensitive',
        requestId: 'abc-123',
      };

      const result = formatErrorForLogging(error, context);

      expect(result).toEqual({
        message: 'Test error',
        name: 'Error',
        requestId: 'abc-123',
      });
      expect(result.Authorization).toBeUndefined();
      expect(result.Token).toBeUndefined();
    });

    test('should handle empty context', () => {
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');
      const result = formatErrorForLogging(error);

      expect(result).toEqual({
        message: 'Test error',
        name: 'Error',
        stack: expect.any(String), // Stack trace should be present in development
      });
    });

    test('should handle error without stack trace', () => {
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');
      delete error.stack; // Remove stack property

      const result = formatErrorForLogging(error, { context: 'test' });

      expect(result).toEqual({
        message: 'Test error',
        name: 'Error',
        context: 'test',
        // stack should not be present
      });
      expect(result.stack).toBeUndefined();
    });

    test('should handle non-object context values gracefully', () => {
      process.env.NODE_ENV = 'production';

      const error = new Error('Test error');
      const result = formatErrorForLogging(error, 123);

      expect(result).toEqual({ message: 'Test error', name: 'Error' });
    });
  });

  describe('createSecureHttpErrorResponse', () => {
    test('should create HTTP error response with all parameters', () => {
      process.env.NODE_ENV = 'development';

      const originalError = new Error('Original validation error');
      const details = { field: 'email', value: 'invalid@' };

      const result = createSecureHttpErrorResponse(
        400,
        'validation_error',
        'Validation failed',
        details,
        originalError
      );

      expect(result).toEqual({
        error: {
          message: 'Validation failed',
          code: 'validation_error',
          details: {
            field: 'email',
            value: 'invalid@',
            originalErrorMessage: 'Original validation error',
          },
        },
      });
    });

    test('should create HTTP error response in production', () => {
      process.env.NODE_ENV = 'production';

      const originalError = new Error('Internal database error');
      const details = {
        userId: '123',
        apiKey: 'sk-secret',
        internalPath: '/secret',
      };

      const result = createSecureHttpErrorResponse(
        500,
        'database_error',
        'Database operation failed',
        details,
        originalError
      );

      expect(result).toEqual({
        error: {
          message: 'Database operation failed',
          code: 'database_error',
          details: {
            userId: '123',
            // sensitive fields should be filtered
            originalErrorMessage: 'Internal error occurred',
          },
        },
      });
      expect(result.error.details.apiKey).toBeUndefined();
      expect(result.error.details.internalPath).toBeUndefined();
    });

    test('should create HTTP error response without original error', () => {
      process.env.NODE_ENV = 'development';

      const details = { operation: 'create_user' };

      const result = createSecureHttpErrorResponse(
        403,
        'authorization_error',
        'Access denied',
        details
      );

      expect(result).toEqual({
        error: {
          message: 'Access denied',
          code: 'authorization_error',
          details: {
            operation: 'create_user',
            originalErrorMessage: 'Access denied',
          },
        },
      });
    });

    test('should create HTTP error response with empty details', () => {
      process.env.NODE_ENV = 'development';

      const result = createSecureHttpErrorResponse(
        404,
        'not_found',
        'Resource not found'
      );

      expect(result).toEqual({
        error: {
          message: 'Resource not found',
          code: 'not_found',
          details: {
            originalErrorMessage: 'Resource not found',
          },
        },
      });
    });

    test('should handle undefined details parameter', () => {
      process.env.NODE_ENV = 'development';

      const result = createSecureHttpErrorResponse(
        500,
        'server_error',
        'Internal server error',
        undefined
      );

      expect(result).toEqual({
        error: {
          message: 'Internal server error',
          code: 'server_error',
          details: {
            originalErrorMessage: 'Internal server error',
          },
        },
      });
    });

    test('should handle null details without throwing in production', () => {
      process.env.NODE_ENV = 'production';

      const result = createSecureHttpErrorResponse(
        500,
        'server_error',
        'Internal server error',
        null
      );

      expect(result).toEqual({
        error: {
          message: 'Internal server error',
          code: 'server_error',
          details: {
            originalErrorMessage: 'Internal error occurred',
          },
        },
      });
    });
  });
});
