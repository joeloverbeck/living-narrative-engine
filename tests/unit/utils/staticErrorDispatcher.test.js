import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  StaticErrorDispatcher,
  safeDispatchError,
  dispatchSystemErrorEvent,
  dispatchValidationError,
} from '../../../src/utils/staticErrorDispatcher.js';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import { ensureValidLogger } from '../../../src/utils/loggerUtils.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

jest.mock('../../../src/utils/eventDispatchService.js');
jest.mock('../../../src/utils/loggerUtils.js');

describe('StaticErrorDispatcher', () => {
  let mockDispatcher;
  let mockLogger;
  let mockEventDispatchService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDispatcher = {
      dispatch: jest.fn(),
    };

    mockLogger = createMockLogger();

    mockEventDispatchService = {
      dispatchSystemError: jest.fn(),
      dispatchValidationError: jest.fn().mockReturnValue({
        ok: false,
        error: 'Test error',
        details: { test: 'details' },
      }),
    };

    EventDispatchService.mockImplementation(() => mockEventDispatchService);
    ensureValidLogger.mockReturnValue(mockLogger);
  });

  describe('dispatchError', () => {
    it('should dispatch system error with all parameters', () => {
      const message = 'Test error message';
      const details = { test: 'details' };
      const customLogger = createMockLogger();

      StaticErrorDispatcher.dispatchError(
        mockDispatcher,
        message,
        details,
        customLogger
      );

      expect(ensureValidLogger).toHaveBeenCalledWith(
        customLogger,
        'StaticErrorDispatcher.dispatchError'
      );
      expect(EventDispatchService).toHaveBeenCalledWith({
        safeEventDispatcher: mockDispatcher,
        logger: mockLogger,
      });
      expect(mockEventDispatchService.dispatchSystemError).toHaveBeenCalledWith(
        message,
        details,
        { throwOnInvalidDispatcher: true }
      );
    });

    it('should dispatch system error with minimal parameters', () => {
      const message = 'Test error message';

      StaticErrorDispatcher.dispatchError(mockDispatcher, message);

      expect(ensureValidLogger).toHaveBeenCalledWith(
        undefined,
        'StaticErrorDispatcher.dispatchError'
      );
      expect(EventDispatchService).toHaveBeenCalledWith({
        safeEventDispatcher: mockDispatcher,
        logger: mockLogger,
      });
      expect(mockEventDispatchService.dispatchSystemError).toHaveBeenCalledWith(
        message,
        {},
        { throwOnInvalidDispatcher: true }
      );
    });

    it('should use ensureValidLogger with undefined logger', () => {
      const message = 'Test error message';

      StaticErrorDispatcher.dispatchError(mockDispatcher, message);

      expect(ensureValidLogger).toHaveBeenCalledWith(
        undefined,
        'StaticErrorDispatcher.dispatchError'
      );
    });

    it('should create EventDispatchService with correct parameters', () => {
      const message = 'Test error message';
      const details = { test: 'details' };
      const customLogger = createMockLogger();

      StaticErrorDispatcher.dispatchError(
        mockDispatcher,
        message,
        details,
        customLogger
      );

      expect(EventDispatchService).toHaveBeenCalledWith({
        safeEventDispatcher: mockDispatcher,
        logger: mockLogger,
      });
    });
  });

  describe('dispatchErrorAsync', () => {
    it('should dispatch system error asynchronously with all parameters', async () => {
      const message = 'Test async error message';
      const details = { test: 'async details' };
      const customLogger = createMockLogger();
      const expectedResult = { success: true };

      mockEventDispatchService.dispatchSystemError.mockResolvedValue(
        expectedResult
      );

      const result = await StaticErrorDispatcher.dispatchErrorAsync(
        mockDispatcher,
        message,
        details,
        customLogger
      );

      expect(ensureValidLogger).toHaveBeenCalledWith(
        customLogger,
        'StaticErrorDispatcher.dispatchErrorAsync'
      );
      expect(EventDispatchService).toHaveBeenCalledWith({
        safeEventDispatcher: mockDispatcher,
        logger: mockLogger,
      });
      expect(mockEventDispatchService.dispatchSystemError).toHaveBeenCalledWith(
        message,
        details,
        {
          async: true,
          throwOnInvalidDispatcher: false,
        }
      );
      expect(result).toBe(expectedResult);
    });

    it('should dispatch system error asynchronously with minimal parameters', async () => {
      const message = 'Test async error message';
      const details = { test: 'async details' };
      const customLogger = createMockLogger();

      await StaticErrorDispatcher.dispatchErrorAsync(
        mockDispatcher,
        message,
        details,
        customLogger
      );

      expect(ensureValidLogger).toHaveBeenCalledWith(
        customLogger,
        'StaticErrorDispatcher.dispatchErrorAsync'
      );
      expect(mockEventDispatchService.dispatchSystemError).toHaveBeenCalledWith(
        message,
        details,
        {
          async: true,
          throwOnInvalidDispatcher: false,
        }
      );
    });

    it('should return the result from dispatchSystemError', async () => {
      const message = 'Test async error message';
      const details = { test: 'async details' };
      const customLogger = createMockLogger();
      const expectedResult = { success: true, data: 'test' };

      mockEventDispatchService.dispatchSystemError.mockResolvedValue(
        expectedResult
      );

      const result = await StaticErrorDispatcher.dispatchErrorAsync(
        mockDispatcher,
        message,
        details,
        customLogger
      );

      expect(result).toBe(expectedResult);
    });

    it('should use ensureValidLogger with provided logger', async () => {
      const message = 'Test async error message';
      const details = { test: 'async details' };
      const customLogger = createMockLogger();

      await StaticErrorDispatcher.dispatchErrorAsync(
        mockDispatcher,
        message,
        details,
        customLogger
      );

      expect(ensureValidLogger).toHaveBeenCalledWith(
        customLogger,
        'StaticErrorDispatcher.dispatchErrorAsync'
      );
    });
  });

  describe('dispatchValidationError', () => {
    it('should dispatch validation error with all parameters', () => {
      const message = 'Test validation error';
      const details = { validation: 'failed' };
      const customLogger = createMockLogger();
      const expectedResult = {
        ok: false,
        error: 'Test validation error',
        details: { validation: 'failed' },
      };

      mockEventDispatchService.dispatchValidationError.mockReturnValue(
        expectedResult
      );

      const result = StaticErrorDispatcher.dispatchValidationError(
        mockDispatcher,
        message,
        details,
        customLogger
      );

      expect(ensureValidLogger).toHaveBeenCalledWith(
        customLogger,
        'StaticErrorDispatcher.dispatchValidationError'
      );
      expect(EventDispatchService).toHaveBeenCalledWith({
        safeEventDispatcher: mockDispatcher,
        logger: mockLogger,
      });
      expect(
        mockEventDispatchService.dispatchValidationError
      ).toHaveBeenCalledWith(message, details);
      expect(result).toBe(expectedResult);
    });

    it('should dispatch validation error with minimal parameters', () => {
      const message = 'Test validation error';
      const details = { validation: 'failed' };
      const customLogger = createMockLogger();

      StaticErrorDispatcher.dispatchValidationError(
        mockDispatcher,
        message,
        details,
        customLogger
      );

      expect(ensureValidLogger).toHaveBeenCalledWith(
        customLogger,
        'StaticErrorDispatcher.dispatchValidationError'
      );
      expect(
        mockEventDispatchService.dispatchValidationError
      ).toHaveBeenCalledWith(message, details);
    });

    it('should return the result from dispatchValidationError', () => {
      const message = 'Test validation error';
      const details = { validation: 'failed' };
      const customLogger = createMockLogger();
      const expectedResult = {
        ok: false,
        error: 'Validation failed',
        details: { field: 'required' },
      };

      mockEventDispatchService.dispatchValidationError.mockReturnValue(
        expectedResult
      );

      const result = StaticErrorDispatcher.dispatchValidationError(
        mockDispatcher,
        message,
        details,
        customLogger
      );

      expect(result).toBe(expectedResult);
    });

    it('should use ensureValidLogger with provided logger', () => {
      const message = 'Test validation error';
      const details = { validation: 'failed' };
      const customLogger = createMockLogger();

      StaticErrorDispatcher.dispatchValidationError(
        mockDispatcher,
        message,
        details,
        customLogger
      );

      expect(ensureValidLogger).toHaveBeenCalledWith(
        customLogger,
        'StaticErrorDispatcher.dispatchValidationError'
      );
    });
  });
});

describe('Legacy wrapper functions', () => {
  let mockDispatcher;
  let mockLogger;
  let mockEventDispatchService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDispatcher = {
      dispatch: jest.fn(),
    };

    mockLogger = createMockLogger();

    mockEventDispatchService = {
      dispatchSystemError: jest.fn(),
      dispatchValidationError: jest.fn().mockReturnValue({
        ok: false,
        error: 'Test error',
        details: { test: 'details' },
      }),
    };

    EventDispatchService.mockImplementation(() => mockEventDispatchService);
    ensureValidLogger.mockReturnValue(mockLogger);
  });

  describe('safeDispatchError', () => {
    it('should call StaticErrorDispatcher.dispatchError with all parameters', () => {
      const message = 'Test error message';
      const details = { test: 'details' };
      const customLogger = createMockLogger();

      safeDispatchError(mockDispatcher, message, details, customLogger);

      expect(ensureValidLogger).toHaveBeenCalledWith(
        customLogger,
        'StaticErrorDispatcher.dispatchError'
      );
      expect(EventDispatchService).toHaveBeenCalledWith({
        safeEventDispatcher: mockDispatcher,
        logger: mockLogger,
      });
      expect(mockEventDispatchService.dispatchSystemError).toHaveBeenCalledWith(
        message,
        details,
        { throwOnInvalidDispatcher: true }
      );
    });

    it('should call StaticErrorDispatcher.dispatchError with default details', () => {
      const message = 'Test error message';

      safeDispatchError(mockDispatcher, message);

      expect(mockEventDispatchService.dispatchSystemError).toHaveBeenCalledWith(
        message,
        {},
        { throwOnInvalidDispatcher: true }
      );
    });

    it('should handle undefined logger parameter', () => {
      const message = 'Test error message';

      safeDispatchError(mockDispatcher, message);

      expect(ensureValidLogger).toHaveBeenCalledWith(
        undefined,
        'StaticErrorDispatcher.dispatchError'
      );
    });
  });

  describe('dispatchSystemErrorEvent', () => {
    it('should call StaticErrorDispatcher.dispatchErrorAsync with all parameters', async () => {
      const message = 'Test async error message';
      const details = { test: 'async details' };
      const customLogger = createMockLogger();
      const expectedResult = { success: true };

      mockEventDispatchService.dispatchSystemError.mockResolvedValue(
        expectedResult
      );

      const result = await dispatchSystemErrorEvent(
        mockDispatcher,
        message,
        details,
        customLogger
      );

      expect(ensureValidLogger).toHaveBeenCalledWith(
        customLogger,
        'StaticErrorDispatcher.dispatchErrorAsync'
      );
      expect(EventDispatchService).toHaveBeenCalledWith({
        safeEventDispatcher: mockDispatcher,
        logger: mockLogger,
      });
      expect(mockEventDispatchService.dispatchSystemError).toHaveBeenCalledWith(
        message,
        details,
        {
          async: true,
          throwOnInvalidDispatcher: false,
        }
      );
      expect(result).toBe(expectedResult);
    });

    it('should return the result from StaticErrorDispatcher.dispatchErrorAsync', async () => {
      const message = 'Test async error message';
      const details = { test: 'async details' };
      const customLogger = createMockLogger();
      const expectedResult = { success: true, data: 'test' };

      mockEventDispatchService.dispatchSystemError.mockResolvedValue(
        expectedResult
      );

      const result = await dispatchSystemErrorEvent(
        mockDispatcher,
        message,
        details,
        customLogger
      );

      expect(result).toBe(expectedResult);
    });
  });

  describe('dispatchValidationError', () => {
    it('should call StaticErrorDispatcher.dispatchValidationError with all parameters', () => {
      const message = 'Test validation error';
      const details = { validation: 'failed' };
      const customLogger = createMockLogger();
      const expectedResult = {
        ok: false,
        error: 'Test validation error',
        details: { validation: 'failed' },
      };

      mockEventDispatchService.dispatchValidationError.mockReturnValue(
        expectedResult
      );

      const result = dispatchValidationError(
        mockDispatcher,
        message,
        details,
        customLogger
      );

      expect(ensureValidLogger).toHaveBeenCalledWith(
        customLogger,
        'StaticErrorDispatcher.dispatchValidationError'
      );
      expect(EventDispatchService).toHaveBeenCalledWith({
        safeEventDispatcher: mockDispatcher,
        logger: mockLogger,
      });
      expect(
        mockEventDispatchService.dispatchValidationError
      ).toHaveBeenCalledWith(message, details);
      expect(result).toBe(expectedResult);
    });

    it('should return the result from StaticErrorDispatcher.dispatchValidationError', () => {
      const message = 'Test validation error';
      const details = { validation: 'failed' };
      const customLogger = createMockLogger();
      const expectedResult = {
        ok: false,
        error: 'Validation failed',
        details: { field: 'required' },
      };

      mockEventDispatchService.dispatchValidationError.mockReturnValue(
        expectedResult
      );

      const result = dispatchValidationError(
        mockDispatcher,
        message,
        details,
        customLogger
      );

      expect(result).toBe(expectedResult);
    });
  });
});
