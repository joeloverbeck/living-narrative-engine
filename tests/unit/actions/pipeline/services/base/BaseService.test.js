/**
 * @file BaseService.test.js - Unit tests for BaseService
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BaseService } from '../../../../../../src/actions/pipeline/services/base/BaseService.js';
import {
  ServiceError,
  ServiceErrorCodes,
} from '../../../../../../src/actions/pipeline/services/base/ServiceError.js';
import { InvalidArgumentError } from '../../../../../../src/errors/invalidArgumentError.js';

describe('BaseService', () => {
  let mockLogger;
  let TestService;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create a test service class that extends BaseService
    TestService = class extends BaseService {
      testMethod() {
        return 'test';
      }
    };
  });

  describe('constructor', () => {
    it('should create instance with valid logger', () => {
      const service = new TestService({ logger: mockLogger });
      expect(service).toBeInstanceOf(BaseService);
      expect(service.logger).toBe(mockLogger);
    });

    it('should throw error when logger is missing', () => {
      expect(() => new TestService({})).toThrow(InvalidArgumentError);
      expect(() => new TestService({ logger: null })).toThrow(
        InvalidArgumentError
      );
    });

    it('should throw error when logger is missing required methods', () => {
      const invalidLogger = { debug: jest.fn() }; // Missing other methods
      expect(() => new TestService({ logger: invalidLogger })).toThrow(
        InvalidArgumentError
      );
    });
  });

  describe('validateParams', () => {
    let service;

    beforeEach(() => {
      service = new TestService({ logger: mockLogger });
    });

    it('should pass validation for valid params', () => {
      const params = { foo: 'bar', baz: 123 };
      expect(() =>
        service.validateParams(params, ['foo', 'baz'])
      ).not.toThrow();
    });

    it('should throw error for non-object params', () => {
      expect(() => service.validateParams(null, ['foo'])).toThrow(ServiceError);
      expect(() => service.validateParams('string', ['foo'])).toThrow(
        ServiceError
      );
    });

    it('should throw error for missing required params', () => {
      const params = { foo: 'bar' };
      expect(() => service.validateParams(params, ['foo', 'baz'])).toThrow(
        ServiceError
      );

      try {
        service.validateParams(params, ['foo', 'baz']);
      } catch (error) {
        expect(error.code).toBe(ServiceErrorCodes.MISSING_PARAMETER);
        expect(error.message).toContain('baz');
      }
    });

    it('should treat null and undefined as missing', () => {
      const params = { foo: null, bar: undefined, baz: '' };
      expect(() => service.validateParams(params, ['foo', 'bar'])).toThrow(
        ServiceError
      );
      expect(() => service.validateParams(params, ['baz'])).not.toThrow();
    });
  });

  describe('validateNonBlankString', () => {
    let service;

    beforeEach(() => {
      service = new TestService({ logger: mockLogger });
    });

    it('should pass validation for non-blank strings', () => {
      expect(() =>
        service.validateNonBlankString('test', 'param')
      ).not.toThrow();
      expect(() =>
        service.validateNonBlankString('  test  ', 'param')
      ).not.toThrow();
    });

    it('should throw error for blank strings', () => {
      expect(() => service.validateNonBlankString('', 'param')).toThrow(
        ServiceError
      );
      expect(() => service.validateNonBlankString('   ', 'param')).toThrow(
        ServiceError
      );
    });

    it('should throw error for non-string values', () => {
      expect(() => service.validateNonBlankString(null, 'param')).toThrow(
        ServiceError
      );
      expect(() => service.validateNonBlankString(undefined, 'param')).toThrow(
        ServiceError
      );
      expect(() => service.validateNonBlankString(123, 'param')).toThrow(
        ServiceError
      );
    });
  });

  describe('validatePresent', () => {
    let service;

    beforeEach(() => {
      service = new TestService({ logger: mockLogger });
    });

    it('should pass validation for present values', () => {
      expect(() => service.validatePresent('test', 'param')).not.toThrow();
      expect(() => service.validatePresent(0, 'param')).not.toThrow();
      expect(() => service.validatePresent(false, 'param')).not.toThrow();
      expect(() => service.validatePresent('', 'param')).not.toThrow();
    });

    it('should throw error for null or undefined', () => {
      expect(() => service.validatePresent(null, 'param')).toThrow(
        ServiceError
      );
      expect(() => service.validatePresent(undefined, 'param')).toThrow(
        ServiceError
      );

      try {
        service.validatePresent(null, 'testParam');
      } catch (error) {
        expect(error.code).toBe(ServiceErrorCodes.MISSING_PARAMETER);
        expect(error.message).toContain('testParam');
      }
    });
  });

  describe('logOperation', () => {
    let service;

    beforeEach(() => {
      service = new TestService({ logger: mockLogger });
    });

    it('should log operation with default debug level', () => {
      service.logOperation('testOp', { foo: 'bar' });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TestService: testOp',
        expect.objectContaining({
          service: 'TestService',
          operation: 'testOp',
          foo: 'bar',
        })
      );
    });

    it('should log operation with specified level', () => {
      service.logOperation('testOp', { foo: 'bar' }, 'info');

      expect(mockLogger.info).toHaveBeenCalledWith(
        'TestService: testOp',
        expect.objectContaining({
          service: 'TestService',
          operation: 'testOp',
          foo: 'bar',
        })
      );
    });
  });

  describe('throwError', () => {
    let service;

    beforeEach(() => {
      service = new TestService({ logger: mockLogger });
    });

    it('should log error and throw ServiceError', () => {
      const context = { foo: 'bar' };

      expect(() =>
        service.throwError('Test error', 'TEST_CODE', context)
      ).toThrow(ServiceError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'TestService: Test error',
        expect.objectContaining({
          code: 'TEST_CODE',
          foo: 'bar',
        })
      );

      try {
        service.throwError('Test error', 'TEST_CODE', context);
      } catch (error) {
        expect(error.message).toBe('TestService: Test error');
        expect(error.code).toBe('TEST_CODE');
      }
    });
  });

  describe('executeOperation', () => {
    let service;

    beforeEach(() => {
      service = new TestService({ logger: mockLogger });
    });

    it('should execute successful operation', async () => {
      const operation = jest.fn().mockResolvedValue('result');

      const result = await service.executeOperation('testOp', operation, {
        foo: 'bar',
      });

      expect(result).toBe('result');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TestService: testOp',
        expect.objectContaining({ status: 'started', foo: 'bar' })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TestService: testOp',
        expect.objectContaining({ status: 'completed', foo: 'bar' })
      );
    });

    it('should handle operation failure', async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error('Operation failed'));

      await expect(
        service.executeOperation('testOp', operation)
      ).rejects.toThrow(ServiceError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'TestService: testOp',
        expect.objectContaining({
          status: 'failed',
          error: 'Operation failed',
        })
      );
    });

    it('should re-throw ServiceErrors as-is', async () => {
      const originalError = new ServiceError('Original error', 'ORIGINAL_CODE');
      const operation = jest.fn().mockRejectedValue(originalError);

      await expect(service.executeOperation('testOp', operation)).rejects.toBe(
        originalError
      );
    });

    it('should wrap non-ServiceErrors', async () => {
      const originalError = new Error('Regular error');
      const operation = jest.fn().mockRejectedValue(originalError);

      try {
        await service.executeOperation('testOp', operation);
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceError);
        expect(error.code).toBe(ServiceErrorCodes.OPERATION_FAILED);
        expect(error.message).toContain('testOp');
        expect(error.message).toContain('Regular error');
      }
    });
  });

  describe('isInitialized', () => {
    it('should return true when properly initialized', () => {
      const service = new TestService({ logger: mockLogger });
      expect(service.isInitialized()).toBe(true);
    });
  });
});
