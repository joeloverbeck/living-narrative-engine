// tests/unit/services/inMemoryDataRegistry.parameterValidation.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';

describe('InMemoryDataRegistry Parameter Validation', () => {
  let registry;

  beforeEach(() => {
    registry = new InMemoryDataRegistry();
    // Store some test data for valid scenarios
    registry.store('testType', 'testId', { name: 'test object' });
  });

  describe('get method parameter validation', () => {
    describe('should throw errors for invalid type parameter', () => {
      it('should throw error when type is undefined', () => {
        expect(() => {
          registry.get(undefined, 'someId');
        }).toThrow('InMemoryDataRegistry.get: type parameter must be a non-empty string');
      });

      it('should throw error when type is null', () => {
        expect(() => {
          registry.get(null, 'someId');
        }).toThrow('InMemoryDataRegistry.get: type parameter must be a non-empty string');
      });

      it('should throw error when type is empty string', () => {
        expect(() => {
          registry.get('', 'someId');
        }).toThrow('InMemoryDataRegistry.get: type parameter must be a non-empty string');
      });

      it('should throw error when type is whitespace only', () => {
        expect(() => {
          registry.get('   ', 'someId');
        }).toThrow('InMemoryDataRegistry.get: type parameter must be a non-empty string');
      });

      it('should throw error when type is a number', () => {
        expect(() => {
          registry.get(123, 'someId');
        }).toThrow('InMemoryDataRegistry.get: type parameter must be a non-empty string');
      });

      it('should throw error when type is a boolean', () => {
        expect(() => {
          registry.get(true, 'someId');
        }).toThrow('InMemoryDataRegistry.get: type parameter must be a non-empty string');
      });

      it('should throw error when type is an object', () => {
        expect(() => {
          registry.get({}, 'someId');
        }).toThrow('InMemoryDataRegistry.get: type parameter must be a non-empty string');
      });

      it('should throw error when type is an array', () => {
        expect(() => {
          registry.get([], 'someId');
        }).toThrow('InMemoryDataRegistry.get: type parameter must be a non-empty string');
      });
    });

    describe('should throw errors for invalid id parameter', () => {
      it('should throw error when id is undefined', () => {
        expect(() => {
          registry.get('testType', undefined);
        }).toThrow('InMemoryDataRegistry.get: id parameter must be a non-empty string');
      });

      it('should throw error when id is null', () => {
        expect(() => {
          registry.get('testType', null);
        }).toThrow('InMemoryDataRegistry.get: id parameter must be a non-empty string');
      });

      it('should throw error when id is empty string', () => {
        expect(() => {
          registry.get('testType', '');
        }).toThrow('InMemoryDataRegistry.get: id parameter must be a non-empty string');
      });

      it('should throw error when id is whitespace only', () => {
        expect(() => {
          registry.get('testType', '   ');
        }).toThrow('InMemoryDataRegistry.get: id parameter must be a non-empty string');
      });

      it('should throw error when id is a number', () => {
        expect(() => {
          registry.get('testType', 123);
        }).toThrow('InMemoryDataRegistry.get: id parameter must be a non-empty string');
      });

      it('should throw error when id is a boolean', () => {
        expect(() => {
          registry.get('testType', false);
        }).toThrow('InMemoryDataRegistry.get: id parameter must be a non-empty string');
      });

      it('should throw error when id is an object', () => {
        expect(() => {
          registry.get('testType', {});
        }).toThrow('InMemoryDataRegistry.get: id parameter must be a non-empty string');
      });

      it('should throw error when id is an array', () => {
        expect(() => {
          registry.get('testType', []);
        }).toThrow('InMemoryDataRegistry.get: id parameter must be a non-empty string');
      });
    });

    describe('should throw errors for missing parameters', () => {
      it('should throw error when called with no arguments', () => {
        expect(() => {
          registry.get();
        }).toThrow('InMemoryDataRegistry.get: type parameter must be a non-empty string');
      });

      it('should throw error when called with only type argument', () => {
        expect(() => {
          registry.get('testType');
        }).toThrow('InMemoryDataRegistry.get: id parameter must be a non-empty string');
      });
    });

    describe('should work correctly with valid parameters', () => {
      it('should return stored data for valid type and id', () => {
        const result = registry.get('testType', 'testId');
        expect(result).toEqual({ name: 'test object' });
      });

      it('should return undefined for valid parameters but non-existent data', () => {
        const result = registry.get('validType', 'validId');
        expect(result).toBeUndefined();
      });

      it('should return undefined for valid parameters but non-existent type', () => {
        const result = registry.get('nonExistentType', 'testId');
        expect(result).toBeUndefined();
      });

      it('should return undefined for valid parameters but non-existent id', () => {
        const result = registry.get('testType', 'nonExistentId');
        expect(result).toBeUndefined();
      });
    });
  });

  describe('getAll method parameter validation', () => {
    describe('should throw errors for invalid type parameter', () => {
      it('should throw error when type is undefined', () => {
        expect(() => {
          registry.getAll(undefined);
        }).toThrow('InMemoryDataRegistry.getAll: type parameter must be a non-empty string');
      });

      it('should throw error when type is null', () => {
        expect(() => {
          registry.getAll(null);
        }).toThrow('InMemoryDataRegistry.getAll: type parameter must be a non-empty string');
      });

      it('should throw error when type is empty string', () => {
        expect(() => {
          registry.getAll('');
        }).toThrow('InMemoryDataRegistry.getAll: type parameter must be a non-empty string');
      });

      it('should throw error when type is whitespace only', () => {
        expect(() => {
          registry.getAll('   ');
        }).toThrow('InMemoryDataRegistry.getAll: type parameter must be a non-empty string');
      });

      it('should throw error when type is a number', () => {
        expect(() => {
          registry.getAll(123);
        }).toThrow('InMemoryDataRegistry.getAll: type parameter must be a non-empty string');
      });

      it('should throw error when type is a boolean', () => {
        expect(() => {
          registry.getAll(true);
        }).toThrow('InMemoryDataRegistry.getAll: type parameter must be a non-empty string');
      });

      it('should throw error when type is an object', () => {
        expect(() => {
          registry.getAll({});
        }).toThrow('InMemoryDataRegistry.getAll: type parameter must be a non-empty string');
      });

      it('should throw error when type is an array', () => {
        expect(() => {
          registry.getAll([]);
        }).toThrow('InMemoryDataRegistry.getAll: type parameter must be a non-empty string');
      });
    });

    describe('should throw errors for missing parameters', () => {
      it('should throw error when called with no arguments', () => {
        expect(() => {
          registry.getAll();
        }).toThrow('InMemoryDataRegistry.getAll: type parameter must be a non-empty string');
      });
    });

    describe('should work correctly with valid parameters', () => {
      it('should return array for valid type with data', () => {
        const result = registry.getAll('testType');
        expect(result).toEqual([{ name: 'test object' }]);
      });

      it('should return empty array for valid type with no data', () => {
        const result = registry.getAll('validType');
        expect(result).toEqual([]);
      });
    });
  });

  describe('getContentSource method parameter validation', () => {
    beforeEach(() => {
      // Store data with mod info for content source testing
      registry.store('testType', 'testId', { name: 'test object', modId: 'testMod' });
    });

    describe('should throw errors for invalid type parameter', () => {
      it('should throw error when type is undefined', () => {
        expect(() => {
          registry.getContentSource(undefined, 'testId');
        }).toThrow('InMemoryDataRegistry.getContentSource: type parameter must be a non-empty string');
      });

      it('should throw error when type is null', () => {
        expect(() => {
          registry.getContentSource(null, 'testId');
        }).toThrow('InMemoryDataRegistry.getContentSource: type parameter must be a non-empty string');
      });

      it('should throw error when type is empty string', () => {
        expect(() => {
          registry.getContentSource('', 'testId');
        }).toThrow('InMemoryDataRegistry.getContentSource: type parameter must be a non-empty string');
      });
    });

    describe('should throw errors for invalid id parameter', () => {
      it('should throw error when id is undefined', () => {
        expect(() => {
          registry.getContentSource('testType', undefined);
        }).toThrow('InMemoryDataRegistry.getContentSource: id parameter must be a non-empty string');
      });

      it('should throw error when id is null', () => {
        expect(() => {
          registry.getContentSource('testType', null);
        }).toThrow('InMemoryDataRegistry.getContentSource: id parameter must be a non-empty string');
      });

      it('should throw error when id is empty string', () => {
        expect(() => {
          registry.getContentSource('testType', '');
        }).toThrow('InMemoryDataRegistry.getContentSource: id parameter must be a non-empty string');
      });
    });

    describe('should work correctly with valid parameters', () => {
      it('should return content source for valid parameters', () => {
        const result = registry.getContentSource('testType', 'testId');
        expect(result).toBe('testMod');
      });

      it('should return null for valid parameters but non-existent data', () => {
        const result = registry.getContentSource('validType', 'validId');
        expect(result).toBeNull();
      });
    });
  });
});