/**
 * @file ServiceRegistry.test.js - Unit tests for ServiceRegistry
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ServiceRegistry } from '../../../../../src/actions/pipeline/services/ServiceRegistry.js';
import {
  ServiceError,
  ServiceErrorCodes,
} from '../../../../../src/actions/pipeline/services/base/ServiceError.js';
import { InvalidArgumentError } from '../../../../../src/errors/invalidArgumentError.js';

describe('ServiceRegistry', () => {
  let mockLogger;
  let registry;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    registry = new ServiceRegistry({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should create instance with valid logger', () => {
      expect(registry).toBeInstanceOf(ServiceRegistry);
    });

    it('should throw error when logger is missing', () => {
      expect(() => new ServiceRegistry({})).toThrow(InvalidArgumentError);
    });

    it('should throw error when logger missing required methods', () => {
      const invalidLogger = { debug: jest.fn() }; // Missing other methods
      expect(() => new ServiceRegistry({ logger: invalidLogger })).toThrow(
        InvalidArgumentError
      );
    });
  });

  describe('register', () => {
    it('should register service successfully', () => {
      const service = { name: 'TestService' };
      const metadata = { version: '1.0.0', dependencies: ['Dep1'] };

      registry.register('TestToken', service, metadata);

      expect(registry.has('TestToken')).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Registering service'),
        metadata
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Service registered successfully')
      );
    });

    it('should register service without metadata', () => {
      const service = { name: 'TestService' };

      registry.register('TestToken', service);

      expect(registry.has('TestToken')).toBe(true);
      const metadata = registry.getMetadata('TestToken');
      expect(metadata).toHaveProperty('registeredAt');
      expect(metadata.registeredAt).toBeInstanceOf(Date);
    });

    it('should throw error when service already registered', () => {
      const service = { name: 'TestService' };
      registry.register('TestToken', service);

      expect(() => registry.register('TestToken', service)).toThrow(
        ServiceError
      );

      try {
        registry.register('TestToken', service);
      } catch (error) {
        expect(error.code).toBe(ServiceErrorCodes.INVALID_STATE);
        expect(error.message).toContain('already registered');
      }
    });
  });

  describe('get', () => {
    it('should return registered service', () => {
      const service = { name: 'TestService' };
      registry.register('TestToken', service);

      const result = registry.get('TestToken');

      expect(result).toBe(service);
    });

    it('should throw error for unregistered service', () => {
      expect(() => registry.get('UnknownToken')).toThrow(ServiceError);

      try {
        registry.get('UnknownToken');
      } catch (error) {
        expect(error.code).toBe(ServiceErrorCodes.DEPENDENCY_ERROR);
        expect(error.message).toContain('Service not found');
      }
    });
  });

  describe('has', () => {
    it('should return true for registered service', () => {
      registry.register('TestToken', { name: 'TestService' });

      expect(registry.has('TestToken')).toBe(true);
    });

    it('should return false for unregistered service', () => {
      expect(registry.has('UnknownToken')).toBe(false);
    });
  });

  describe('getMetadata', () => {
    it('should return metadata for registered service', () => {
      const metadata = { version: '1.0.0', description: 'Test service' };
      registry.register('TestToken', { name: 'TestService' }, metadata);

      const result = registry.getMetadata('TestToken');

      expect(result).toMatchObject(metadata);
      expect(result).toHaveProperty('registeredAt');
    });

    it('should return null for unregistered service', () => {
      expect(registry.getMetadata('UnknownToken')).toBeNull();
    });
  });

  describe('getAll', () => {
    it('should return all registered services', () => {
      const service1 = { name: 'Service1' };
      const service2 = { name: 'Service2' };

      registry.register('Token1', service1);
      registry.register('Token2', service2);

      const result = registry.getAll();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(2);
      expect(result.get('Token1')).toBe(service1);
      expect(result.get('Token2')).toBe(service2);
    });

    it('should return empty map when no services registered', () => {
      const result = registry.getAll();

      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });
  });

  describe('getTokens', () => {
    it('should return all service tokens', () => {
      registry.register('Token1', { name: 'Service1' });
      registry.register('Token2', { name: 'Service2' });

      const result = registry.getTokens();

      expect(result).toEqual(['Token1', 'Token2']);
    });

    it('should return empty array when no services registered', () => {
      const result = registry.getTokens();

      expect(result).toEqual([]);
    });
  });

  describe('unregister', () => {
    it('should unregister service successfully', () => {
      registry.register('TestToken', { name: 'TestService' });

      const result = registry.unregister('TestToken');

      expect(result).toBe(true);
      expect(registry.has('TestToken')).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Service unregistered')
      );
    });

    it('should return false for unregistered service', () => {
      const result = registry.unregister('UnknownToken');

      expect(result).toBe(false);
    });

    it('should remove metadata when unregistering', () => {
      registry.register(
        'TestToken',
        { name: 'TestService' },
        { version: '1.0.0' }
      );
      registry.unregister('TestToken');

      expect(registry.getMetadata('TestToken')).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all services', () => {
      registry.register('Token1', { name: 'Service1' });
      registry.register('Token2', { name: 'Service2' });

      registry.clear();

      expect(registry.getTokens()).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Clearing all services')
      );
    });
  });

  describe('getStats', () => {
    it('should return registry statistics', () => {
      const now = new Date();
      jest.useFakeTimers();
      jest.setSystemTime(now);

      registry.register(
        'Token1',
        { name: 'Service1' },
        {
          version: '1.0.0',
          dependencies: ['Dep1'],
        }
      );
      registry.register('Token2', { name: 'Service2' });

      const stats = registry.getStats();

      expect(stats).toEqual({
        totalServices: 2,
        services: {
          Token1: {
            registeredAt: now,
            dependencies: ['Dep1'],
            version: '1.0.0',
          },
          Token2: {
            registeredAt: now,
            dependencies: [],
            version: 'unknown',
          },
        },
      });

      jest.useRealTimers();
    });
  });

  describe('validateDependencies', () => {
    it('should validate dependencies successfully', () => {
      registry.register('Dep1', { name: 'Dependency1' });
      registry.register('Dep2', { name: 'Dependency2' });
      registry.register(
        'TestToken',
        { name: 'TestService' },
        {
          dependencies: ['Dep1', 'Dep2'],
        }
      );

      const result = registry.validateDependencies('TestToken');

      expect(result).toEqual({
        valid: true,
        missing: [],
      });
    });

    it('should detect missing dependencies', () => {
      registry.register('Dep1', { name: 'Dependency1' });
      registry.register(
        'TestToken',
        { name: 'TestService' },
        {
          dependencies: ['Dep1', 'Dep2', 'Dep3'],
        }
      );

      const result = registry.validateDependencies('TestToken');

      expect(result).toEqual({
        valid: false,
        missing: ['Dep2', 'Dep3'],
      });
    });

    it('should handle service without dependencies', () => {
      registry.register('TestToken', { name: 'TestService' });

      const result = registry.validateDependencies('TestToken');

      expect(result).toEqual({
        valid: true,
        missing: [],
      });
    });

    it('should handle unregistered service', () => {
      const result = registry.validateDependencies('UnknownToken');

      expect(result).toEqual({
        valid: true,
        missing: [],
      });
    });
  });
});
