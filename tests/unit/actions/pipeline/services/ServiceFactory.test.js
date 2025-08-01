/**
 * @file ServiceFactory.test.js - Unit tests for ServiceFactory
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ServiceFactory } from '../../../../../src/actions/pipeline/services/ServiceFactory.js';
import {
  ServiceError,
  ServiceErrorCodes,
} from '../../../../../src/actions/pipeline/services/base/ServiceError.js';
import { InvalidArgumentError } from '../../../../../src/errors/invalidArgumentError.js';

describe('ServiceFactory', () => {
  let mockContainer;
  let mockLogger;
  let factory;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create mock container
    mockContainer = {
      resolve: jest.fn(),
      register: jest.fn(),
    };

    factory = new ServiceFactory({
      container: mockContainer,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(factory).toBeInstanceOf(ServiceFactory);
    });

    it('should throw error when container is missing', () => {
      expect(() => new ServiceFactory({ logger: mockLogger })).toThrow(
        InvalidArgumentError
      );
    });

    it('should throw error when logger is missing', () => {
      expect(() => new ServiceFactory({ container: mockContainer })).toThrow(
        InvalidArgumentError
      );
    });

    it('should throw error when container missing required methods', () => {
      const invalidContainer = { resolve: jest.fn() }; // Missing register method
      expect(
        () =>
          new ServiceFactory({
            container: invalidContainer,
            logger: mockLogger,
          })
      ).toThrow(InvalidArgumentError);
    });
  });

  describe('createService', () => {
    it('should create service successfully', () => {
      const mockService = { test: 'service' };
      mockContainer.resolve.mockReturnValue(mockService);

      const result = factory.createService('TestToken');

      expect(result).toBe(mockService);
      expect(mockContainer.resolve).toHaveBeenCalledWith('TestToken');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ServiceFactory: Creating service for token: TestToken'
      );
    });

    it('should throw error when service not registered', () => {
      mockContainer.resolve.mockImplementation(() => {
        throw new Error('Service not found');
      });

      expect(() => factory.createService('UnknownToken')).toThrow(ServiceError);

      try {
        factory.createService('UnknownToken');
      } catch (error) {
        expect(error.code).toBe(ServiceErrorCodes.DEPENDENCY_ERROR);
        expect(error.message).toContain('UnknownToken');
      }
    });

    it('should throw error when container resolve fails', () => {
      mockContainer.resolve.mockImplementation(() => {
        throw new Error('Resolve failed');
      });

      expect(() => factory.createService('TestToken')).toThrow(ServiceError);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should re-throw ServiceErrors as-is', () => {
      const originalError = new ServiceError('Original', 'ORIGINAL_CODE');
      mockContainer.resolve.mockImplementation(() => {
        throw originalError;
      });

      expect(() => factory.createService('TestToken')).toThrow(originalError);
    });
  });

  describe('createServices', () => {
    it('should create multiple services successfully', () => {
      const service1 = { name: 'service1' };
      const service2 = { name: 'service2' };

      mockContainer.resolve
        .mockReturnValueOnce(service1)
        .mockReturnValueOnce(service2);

      const result = factory.createServices(['Token1', 'Token2']);

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get('Token1')).toBe(service1);
      expect(result.get('Token2')).toBe(service2);
    });

    it('should throw error if any service creation fails', () => {
      mockContainer.resolve
        .mockReturnValueOnce({ name: 'service1' })
        .mockImplementationOnce(() => {
          throw new Error('Service not found');
        });

      expect(() => factory.createServices(['Token1', 'Token2'])).toThrow(
        ServiceError
      );

      try {
        factory.createServices(['Token1', 'Token2']);
      } catch (error) {
        expect(error.code).toBe(ServiceErrorCodes.DEPENDENCY_ERROR);
        expect(error.message).toContain('Failed to create');
      }
    });
  });

  describe('registerService', () => {
    it('should register service as singleton by default', () => {
      factory.registerService('TestToken', TestService);

      expect(mockContainer.register).toHaveBeenCalledWith(
        'TestToken',
        TestService,
        expect.objectContaining({
          singleton: true,
          dependencies: [],
        })
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Registering service'),
        expect.objectContaining({ singleton: true })
      );
    });

    it('should register service as transient when specified', () => {
      factory.registerService('TestToken', TestService, { singleton: false });

      expect(mockContainer.register).toHaveBeenCalledWith(
        'TestToken',
        TestService,
        expect.objectContaining({ singleton: false })
      );
    });

    it('should register service with dependencies', () => {
      const deps = ['Dep1', 'Dep2'];
      factory.registerService('TestToken', TestService, { dependencies: deps });

      expect(mockContainer.register).toHaveBeenCalledWith(
        'TestToken',
        TestService,
        expect.objectContaining({ dependencies: deps })
      );
    });

    it('should throw error when registration fails', () => {
      mockContainer.register.mockImplementation(() => {
        throw new Error('Registration failed');
      });

      expect(() => factory.registerService('TestToken', TestService)).toThrow(
        ServiceError
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('hasService', () => {
    it('should return true when service is registered', () => {
      mockContainer.resolve.mockReturnValue({ test: 'service' });

      expect(factory.hasService('TestToken')).toBe(true);
      expect(mockContainer.resolve).toHaveBeenCalledWith('TestToken');
    });

    it('should return false when service is not registered', () => {
      mockContainer.resolve.mockImplementation(() => {
        throw new Error('Service not found');
      });

      expect(factory.hasService('TestToken')).toBe(false);
    });
  });

  describe('getRegisteredServices', () => {
    it('should return filtered list of registered services', () => {
      // Mock resolve to succeed for some services and fail for others
      mockContainer.resolve
        .mockImplementationOnce(() => ({ service: 'resolver' })) // ITargetDependencyResolver - success
        .mockImplementationOnce(() => {
          throw new Error('Not found');
        }) // ILegacyTargetCompatibilityLayer - fail
        .mockImplementationOnce(() => ({ service: 'context' })) // IScopeContextBuilder - success
        .mockImplementationOnce(() => ({ service: 'display' })); // ITargetDisplayNameResolver - success

      const result = factory.getRegisteredServices();

      expect(result).toEqual([
        'ITargetDependencyResolver',
        'IScopeContextBuilder',
        'ITargetDisplayNameResolver',
      ]);
    });

    it('should return empty array when no services registered', () => {
      // Mock resolve to always throw (no services registered)
      mockContainer.resolve.mockImplementation(() => {
        throw new Error('Service not found');
      });

      const result = factory.getRegisteredServices();

      expect(result).toEqual([]);
    });
  });
});

// Test service class for registration tests
class TestService {
  constructor() {
    this.name = 'TestService';
  }
}
