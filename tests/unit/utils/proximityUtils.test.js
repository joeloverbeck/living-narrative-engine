/**
 * @file Unit tests for proximity utility functions
 * @see src/utils/proximityUtils.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  getAdjacentSpots,
  findAdjacentOccupants,
  validateProximityParameters,
} from '../../../src/utils/proximityUtils.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

describe('proximityUtils', () => {
  describe('getAdjacentSpots', () => {
    describe('valid inputs', () => {
      it('should return both adjacent spots for middle position', () => {
        const result = getAdjacentSpots(1, 3);
        expect(result).toEqual([0, 2]);
      });

      it('should return only right adjacent for first spot', () => {
        const result = getAdjacentSpots(0, 3);
        expect(result).toEqual([1]);
      });

      it('should return only left adjacent for last spot', () => {
        const result = getAdjacentSpots(2, 3);
        expect(result).toEqual([1]);
      });

      it('should return empty array for single-spot furniture', () => {
        const result = getAdjacentSpots(0, 1);
        expect(result).toEqual([]);
      });

      it('should handle two-spot furniture correctly', () => {
        expect(getAdjacentSpots(0, 2)).toEqual([1]);
        expect(getAdjacentSpots(1, 2)).toEqual([0]);
      });

      it('should handle large furniture with many spots', () => {
        const result = getAdjacentSpots(5, 10);
        expect(result).toEqual([4, 6]);
      });
    });

    describe('edge cases', () => {
      it('should throw error for negative spot index', () => {
        expect(() => getAdjacentSpots(-1, 3)).toThrow(InvalidArgumentError);
        expect(() => getAdjacentSpots(-1, 3)).toThrow(
          'spotIndex must be a non-negative integer'
        );
      });

      it('should throw error for non-integer spot index', () => {
        expect(() => getAdjacentSpots(1.5, 3)).toThrow(InvalidArgumentError);
        expect(() => getAdjacentSpots('1', 3)).toThrow(InvalidArgumentError);
        expect(() => getAdjacentSpots(null, 3)).toThrow(InvalidArgumentError);
        expect(() => getAdjacentSpots(undefined, 3)).toThrow(InvalidArgumentError);
      });

      it('should throw error for invalid total spots', () => {
        expect(() => getAdjacentSpots(0, 0)).toThrow(InvalidArgumentError);
        expect(() => getAdjacentSpots(0, -1)).toThrow(InvalidArgumentError);
        expect(() => getAdjacentSpots(0, 1.5)).toThrow(InvalidArgumentError);
        expect(() => getAdjacentSpots(0, '3')).toThrow(InvalidArgumentError);
      });

      it('should throw error when spot index is out of bounds', () => {
        expect(() => getAdjacentSpots(3, 3)).toThrow(InvalidArgumentError);
        expect(() => getAdjacentSpots(3, 3)).toThrow('out of bounds');
        expect(() => getAdjacentSpots(10, 5)).toThrow(InvalidArgumentError);
      });
    });
  });

  describe('findAdjacentOccupants', () => {
    describe('valid inputs', () => {
      it('should find occupants in adjacent spots', () => {
        const furniture = { spots: ['alice', 'bob', 'charlie'] };
        const result = findAdjacentOccupants(furniture, 1);
        expect(result).toEqual(['alice', 'charlie']);
      });

      it('should filter out null values from adjacent spots', () => {
        const furniture = { spots: [null, 'bob', 'charlie'] };
        const result = findAdjacentOccupants(furniture, 1);
        expect(result).toEqual(['charlie']);
      });

      it('should return empty array when all adjacent spots are null', () => {
        const furniture = { spots: [null, 'bob', null] };
        const result = findAdjacentOccupants(furniture, 1);
        expect(result).toEqual([]);
      });

      it('should handle edge positions correctly', () => {
        const furniture = { spots: ['alice', 'bob', null, 'david'] };
        
        // First position - only right neighbor
        expect(findAdjacentOccupants(furniture, 0)).toEqual(['bob']);
        
        // Last position - only left neighbor (which is null)
        expect(findAdjacentOccupants(furniture, 3)).toEqual([]);
      });

      it('should handle single-spot furniture', () => {
        const furniture = { spots: ['alice'] };
        const result = findAdjacentOccupants(furniture, 0);
        expect(result).toEqual([]);
      });

      it('should handle entity IDs with namespace format', () => {
        const furniture = { spots: ['core:actor_1', null, 'mod:npc_2'] };
        const result = findAdjacentOccupants(furniture, 1);
        expect(result).toEqual(['core:actor_1', 'mod:npc_2']);
      });
    });

    describe('edge cases', () => {
      it('should throw error when furnitureComponent is null or undefined', () => {
        expect(() => findAdjacentOccupants(null, 0)).toThrow(
          'furnitureComponent is required'
        );
        expect(() => findAdjacentOccupants(undefined, 0)).toThrow(
          'furnitureComponent is required'
        );
      });

      it('should throw error when spots property is missing', () => {
        expect(() => findAdjacentOccupants({}, 0)).toThrow(
          'furnitureComponent.spots is required'
        );
      });

      it('should throw error when spots is not an array', () => {
        expect(() => findAdjacentOccupants({ spots: 'not-array' }, 0)).toThrow(
          InvalidArgumentError
        );
        expect(() => findAdjacentOccupants({ spots: 123 }, 0)).toThrow(
          'must be an array'
        );
      });

      it('should throw error when spots array is empty', () => {
        expect(() => findAdjacentOccupants({ spots: [] }, 0)).toThrow(
          'cannot be empty'
        );
      });

      it('should handle spots with undefined values same as null', () => {
        const furniture = { spots: [undefined, 'bob', undefined] };
        const result = findAdjacentOccupants(furniture, 1);
        expect(result).toEqual([]);
      });

      it('should propagate errors from getAdjacentSpots', () => {
        const furniture = { spots: ['alice', 'bob'] };
        // Out of bounds index
        expect(() => findAdjacentOccupants(furniture, 2)).toThrow(
          InvalidArgumentError
        );
      });
    });
  });

  describe('validateProximityParameters', () => {
    let mockLogger;

    beforeEach(() => {
      mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
    });

    describe('valid inputs', () => {
      it('should return true for valid parameters', () => {
        const result = validateProximityParameters(
          'furniture_1',
          'actor_1',
          0,
          mockLogger
        );
        expect(result).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should accept namespaced IDs', () => {
        const result = validateProximityParameters(
          'core:furniture_1',
          'mod:actor_1',
          5,
          mockLogger
        );
        expect(result).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
      });

      it('should accept zero as valid spot index', () => {
        const result = validateProximityParameters(
          'furniture_1',
          'actor_1',
          0,
          mockLogger
        );
        expect(result).toBe(true);
      });
    });

    describe('invalid furniture ID', () => {
      it('should throw error for null furniture ID', () => {
        expect(() =>
          validateProximityParameters(null, 'actor_1', 0, mockLogger)
        ).toThrow(InvalidArgumentError);
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should throw error for empty string furniture ID', () => {
        expect(() =>
          validateProximityParameters('', 'actor_1', 0, mockLogger)
        ).toThrow(InvalidArgumentError);
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should throw error for whitespace-only furniture ID', () => {
        expect(() =>
          validateProximityParameters('   ', 'actor_1', 0, mockLogger)
        ).toThrow(InvalidArgumentError);
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('invalid actor ID', () => {
      it('should throw error for null actor ID', () => {
        expect(() =>
          validateProximityParameters('furniture_1', null, 0, mockLogger)
        ).toThrow(InvalidArgumentError);
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should throw error for empty string actor ID', () => {
        expect(() =>
          validateProximityParameters('furniture_1', '', 0, mockLogger)
        ).toThrow(InvalidArgumentError);
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should throw error for undefined actor ID', () => {
        expect(() =>
          validateProximityParameters('furniture_1', undefined, 0, mockLogger)
        ).toThrow(InvalidArgumentError);
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('invalid spot index', () => {
      it('should throw error for negative spot index', () => {
        expect(() =>
          validateProximityParameters('furniture_1', 'actor_1', -1, mockLogger)
        ).toThrow(InvalidArgumentError);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('must be a non-negative integer')
        );
      });

      it('should throw error for non-integer spot index', () => {
        expect(() =>
          validateProximityParameters('furniture_1', 'actor_1', 1.5, mockLogger)
        ).toThrow(InvalidArgumentError);
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should throw error for string spot index', () => {
        expect(() =>
          validateProximityParameters('furniture_1', 'actor_1', '2', mockLogger)
        ).toThrow(InvalidArgumentError);
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should throw error for null spot index', () => {
        expect(() =>
          validateProximityParameters('furniture_1', 'actor_1', null, mockLogger)
        ).toThrow(InvalidArgumentError);
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    describe('invalid logger', () => {
      it('should throw error when logger is null', () => {
        expect(() =>
          validateProximityParameters('furniture_1', 'actor_1', 0, null)
        ).toThrow('logger is required');
      });

      it('should throw error when logger is undefined', () => {
        expect(() =>
          validateProximityParameters('furniture_1', 'actor_1', 0, undefined)
        ).toThrow('logger is required');
      });
    });

    describe('error logging', () => {
      it('should log descriptive error messages', () => {
        expect(() =>
          validateProximityParameters('furniture_1', 'actor_1', -1, mockLogger)
        ).toThrow();
        
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('validateProximityParameters')
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('spotIndex')
        );
      });
    });
  });

  describe('default export', () => {
    it('should export all functions as default object', async () => {
      const proximityUtils = await import('../../../src/utils/proximityUtils.js');
      const defaultExport = proximityUtils.default;
      
      expect(defaultExport).toHaveProperty('getAdjacentSpots');
      expect(defaultExport).toHaveProperty('findAdjacentOccupants');
      expect(defaultExport).toHaveProperty('validateProximityParameters');
      
      expect(typeof defaultExport.getAdjacentSpots).toBe('function');
      expect(typeof defaultExport.findAdjacentOccupants).toBe('function');
      expect(typeof defaultExport.validateProximityParameters).toBe('function');
    });
  });
});