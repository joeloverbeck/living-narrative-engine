/**
 * @file Unit tests for ValidatorRegistry
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../../common/testBed.js';
import { ValidatorRegistry } from '../../../../../src/anatomy/validation/core/ValidatorRegistry.js';

describe('ValidatorRegistry', () => {
  let testBed;
  let mockLogger;
  let registry;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    registry = new ValidatorRegistry({ logger: mockLogger });
  });

  describe('Constructor', () => {
    it('should initialize with valid logger', () => {
      expect(registry).toBeInstanceOf(ValidatorRegistry);
      expect(mockLogger.info).toHaveBeenCalledWith('ValidatorRegistry initialized');
    });

    it('should throw error if logger is missing', () => {
      expect(() => new ValidatorRegistry({})).toThrow();
    });

    it('should throw error if logger lacks required methods', () => {
      const invalidLogger = { info: jest.fn() }; // Missing other methods
      expect(() => new ValidatorRegistry({ logger: invalidLogger })).toThrow();
    });
  });

  describe('register()', () => {
    it('should register a valid validator', () => {
      // Arrange
      const validator = {
        name: 'test-validator',
        priority: 10,
        failFast: false,
        validate: jest.fn(),
      };

      // Act
      registry.register(validator);

      // Assert
      expect(registry.has('test-validator')).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Registered validator 'test-validator' (priority: 10)")
      );
    });

    it('should throw error if validator is null', () => {
      expect(() => registry.register(null)).toThrow('Validator must be an object');
    });

    it('should throw error if validator is undefined', () => {
      expect(() => registry.register(undefined)).toThrow('Validator must be an object');
    });

    it('should throw error if validator is not an object', () => {
      expect(() => registry.register('not-an-object')).toThrow(
        'Validator must be an object'
      );
    });

    it('should throw error if validator lacks validate method', () => {
      const invalidValidator = {
        name: 'test',
        priority: 10,
      };
      expect(() => registry.register(invalidValidator)).toThrow(
        'Validator must implement validate() method'
      );
    });

    it('should throw error if validate is not a function', () => {
      const invalidValidator = {
        name: 'test',
        priority: 10,
        validate: 'not-a-function',
      };
      expect(() => registry.register(invalidValidator)).toThrow(
        'Validator must implement validate() method'
      );
    });

    it('should throw error if validator lacks name property', () => {
      const invalidValidator = {
        priority: 10,
        validate: jest.fn(),
      };
      expect(() => registry.register(invalidValidator)).toThrow(
        'Validator must have a non-blank name property'
      );
    });

    it('should throw error if name is not a string', () => {
      const invalidValidator = {
        name: 123,
        priority: 10,
        validate: jest.fn(),
      };
      expect(() => registry.register(invalidValidator)).toThrow(
        'Validator must have a non-blank name property'
      );
    });

    it('should throw error if name is blank', () => {
      const invalidValidator = {
        name: '   ',
        priority: 10,
        validate: jest.fn(),
      };
      expect(() => registry.register(invalidValidator)).toThrow(
        'Validator must have a non-blank name property'
      );
    });

    it('should throw error if validator lacks priority property', () => {
      const invalidValidator = {
        name: 'test',
        validate: jest.fn(),
      };
      expect(() => registry.register(invalidValidator)).toThrow(
        'Validator must have a numeric priority property'
      );
    });

    it('should throw error if priority is not a number', () => {
      const invalidValidator = {
        name: 'test',
        priority: 'high',
        validate: jest.fn(),
      };
      expect(() => registry.register(invalidValidator)).toThrow(
        'Validator must have a numeric priority property'
      );
    });

    it('should throw error if priority is NaN', () => {
      const invalidValidator = {
        name: 'test',
        priority: NaN,
        validate: jest.fn(),
      };
      expect(() => registry.register(invalidValidator)).toThrow(
        'Validator must have a numeric priority property'
      );
    });

    it('should accept negative priority values', () => {
      const validator = {
        name: 'negative-priority',
        priority: -10,
        validate: jest.fn(),
      };
      expect(() => registry.register(validator)).not.toThrow();
      expect(registry.has('negative-priority')).toBe(true);
    });

    it('should warn when overwriting existing validator', () => {
      // Arrange
      const validator1 = {
        name: 'duplicate',
        priority: 10,
        validate: jest.fn(),
      };
      const validator2 = {
        name: 'duplicate',
        priority: 20,
        validate: jest.fn(),
      };

      // Act
      registry.register(validator1);
      registry.register(validator2);

      // Assert
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Overwriting existing validator 'duplicate'")
      );
      expect(registry.get('duplicate').priority).toBe(20);
    });
  });

  describe('get()', () => {
    it('should retrieve registered validator by name', () => {
      // Arrange
      const validator = {
        name: 'test-validator',
        priority: 10,
        validate: jest.fn(),
      };
      registry.register(validator);

      // Act
      const retrieved = registry.get('test-validator');

      // Assert
      expect(retrieved).toBe(validator);
    });

    it('should return undefined for non-existent validator', () => {
      const result = registry.get('non-existent');
      expect(result).toBeUndefined();
    });

    it('should return undefined on empty registry', () => {
      const result = registry.get('anything');
      expect(result).toBeUndefined();
    });
  });

  describe('getAll()', () => {
    it('should return empty array for empty registry', () => {
      const result = registry.getAll();
      expect(result).toEqual([]);
    });

    it('should return all validators sorted by priority (ascending)', () => {
      // Arrange
      const validator1 = {
        name: 'high-priority',
        priority: 5,
        validate: jest.fn(),
      };
      const validator2 = {
        name: 'low-priority',
        priority: 50,
        validate: jest.fn(),
      };
      const validator3 = {
        name: 'medium-priority',
        priority: 25,
        validate: jest.fn(),
      };

      // Act
      registry.register(validator2); // Register out of order
      registry.register(validator1);
      registry.register(validator3);

      const result = registry.getAll();

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('high-priority'); // priority 5
      expect(result[1].name).toBe('medium-priority'); // priority 25
      expect(result[2].name).toBe('low-priority'); // priority 50
    });

    it('should handle validators with same priority', () => {
      // Arrange
      const validator1 = {
        name: 'first',
        priority: 10,
        validate: jest.fn(),
      };
      const validator2 = {
        name: 'second',
        priority: 10,
        validate: jest.fn(),
      };

      // Act
      registry.register(validator1);
      registry.register(validator2);

      const result = registry.getAll();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].priority).toBe(10);
      expect(result[1].priority).toBe(10);
      // Names should be in the array (order may vary for same priority)
      expect(result.map((v) => v.name)).toContain('first');
      expect(result.map((v) => v.name)).toContain('second');
    });

    it('should handle negative priorities correctly', () => {
      // Arrange
      const validator1 = {
        name: 'negative',
        priority: -10,
        validate: jest.fn(),
      };
      const validator2 = {
        name: 'zero',
        priority: 0,
        validate: jest.fn(),
      };
      const validator3 = {
        name: 'positive',
        priority: 10,
        validate: jest.fn(),
      };

      // Act
      registry.register(validator3);
      registry.register(validator1);
      registry.register(validator2);

      const result = registry.getAll();

      // Assert
      expect(result[0].name).toBe('negative'); // -10
      expect(result[1].name).toBe('zero'); // 0
      expect(result[2].name).toBe('positive'); // 10
    });

    it('should not mutate internal state when modifying returned array', () => {
      // Arrange
      const validator = {
        name: 'test',
        priority: 10,
        validate: jest.fn(),
      };
      registry.register(validator);

      // Act
      const result1 = registry.getAll();
      result1.push({
        name: 'fake',
        priority: 20,
        validate: jest.fn(),
      });
      const result2 = registry.getAll();

      // Assert
      expect(result2).toHaveLength(1);
      expect(result2[0].name).toBe('test');
    });
  });

  describe('has()', () => {
    it('should return true for registered validator', () => {
      // Arrange
      const validator = {
        name: 'test',
        priority: 10,
        validate: jest.fn(),
      };
      registry.register(validator);

      // Act & Assert
      expect(registry.has('test')).toBe(true);
    });

    it('should return false for non-existent validator', () => {
      expect(registry.has('non-existent')).toBe(false);
    });

    it('should return false on empty registry', () => {
      expect(registry.has('anything')).toBe(false);
    });

    it('should return false after validator is unregistered', () => {
      // Arrange
      const validator = {
        name: 'test',
        priority: 10,
        validate: jest.fn(),
      };
      registry.register(validator);

      // Act
      registry.unregister('test');

      // Assert
      expect(registry.has('test')).toBe(false);
    });
  });

  describe('unregister()', () => {
    it('should remove registered validator and return true', () => {
      // Arrange
      const validator = {
        name: 'test',
        priority: 10,
        validate: jest.fn(),
      };
      registry.register(validator);

      // Act
      const result = registry.unregister('test');

      // Assert
      expect(result).toBe(true);
      expect(registry.has('test')).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Unregistered validator 'test'")
      );
    });

    it('should return false for non-existent validator', () => {
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });

    it('should not log debug message when removing non-existent validator', () => {
      // Arrange
      mockLogger.debug.mockClear();

      // Act
      registry.unregister('non-existent');

      // Assert
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Unregistered validator')
      );
    });

    it('should handle multiple unregistrations', () => {
      // Arrange
      const validator1 = {
        name: 'first',
        priority: 10,
        validate: jest.fn(),
      };
      const validator2 = {
        name: 'second',
        priority: 20,
        validate: jest.fn(),
      };
      registry.register(validator1);
      registry.register(validator2);

      // Act
      registry.unregister('first');
      registry.unregister('second');

      // Assert
      expect(registry.has('first')).toBe(false);
      expect(registry.has('second')).toBe(false);
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe('clear()', () => {
    it('should remove all validators', () => {
      // Arrange
      const validator1 = {
        name: 'first',
        priority: 10,
        validate: jest.fn(),
      };
      const validator2 = {
        name: 'second',
        priority: 20,
        validate: jest.fn(),
      };
      registry.register(validator1);
      registry.register(validator2);

      // Act
      registry.clear();

      // Assert
      expect(registry.getAll()).toHaveLength(0);
      expect(registry.has('first')).toBe(false);
      expect(registry.has('second')).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'ValidatorRegistry: Cleared all validators'
      );
    });

    it('should work on empty registry', () => {
      expect(() => registry.clear()).not.toThrow();
      expect(registry.getAll()).toHaveLength(0);
    });

    it('should allow new registrations after clear', () => {
      // Arrange
      const validator1 = {
        name: 'first',
        priority: 10,
        validate: jest.fn(),
      };
      const validator2 = {
        name: 'second',
        priority: 20,
        validate: jest.fn(),
      };
      registry.register(validator1);
      registry.clear();

      // Act
      registry.register(validator2);

      // Assert
      expect(registry.getAll()).toHaveLength(1);
      expect(registry.has('second')).toBe(true);
    });
  });

  describe('count()', () => {
    it('reports the current validator count', () => {
      registry.register({ name: 'first', priority: 1, validate: jest.fn() });
      registry.register({ name: 'second', priority: 2, validate: jest.fn() });

      expect(registry.count()).toBe(2);
    });
  });
});
