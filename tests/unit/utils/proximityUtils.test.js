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
        expect(() => getAdjacentSpots(undefined, 3)).toThrow(
          InvalidArgumentError
        );
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
      it('should return true for valid namespaced parameters', () => {
        const result = validateProximityParameters(
          'core:furniture_1',
          'mod:actor_1',
          5,
          mockLogger
        );
        expect(result).toBe(true);
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Proximity parameters validated successfully',
          expect.objectContaining({
            furnitureId: 'core:furniture_1',
            actorId: 'mod:actor_1',
            spotIndex: 5,
          })
        );
      });

      it('should accept zero as valid spot index', () => {
        const result = validateProximityParameters(
          'core:furniture_1',
          'mod:actor_1',
          0,
          mockLogger
        );
        expect(result).toBe(true);
      });

      it('should accept maximum spot index (9)', () => {
        const result = validateProximityParameters(
          'core:furniture_1',
          'mod:actor_1',
          9,
          mockLogger
        );
        expect(result).toBe(true);
      });

      it('should accept IDs with underscores and hyphens', () => {
        const result = validateProximityParameters(
          'test-mod_1:furniture_item-2',
          'my_mod-3:actor-item_4',
          3,
          mockLogger
        );
        expect(result).toBe(true);
      });

      it('should accept alphanumeric characters in IDs', () => {
        const result = validateProximityParameters(
          'mod123:item456',
          'test789:actor012',
          7,
          mockLogger
        );
        expect(result).toBe(true);
      });
    });

    describe('invalid furniture ID', () => {
      it('should throw error for null furniture ID', () => {
        expect(() =>
          validateProximityParameters(null, 'core:actor_1', 0, mockLogger)
        ).toThrow(InvalidArgumentError);
        expect(() =>
          validateProximityParameters(null, 'core:actor_1', 0, mockLogger)
        ).toThrow('Furniture ID is required');
      });

      it('should throw error for undefined furniture ID', () => {
        expect(() =>
          validateProximityParameters(undefined, 'core:actor_1', 0, mockLogger)
        ).toThrow('Furniture ID is required');
      });

      it('should throw error for non-string furniture ID', () => {
        expect(() =>
          validateProximityParameters(123, 'core:actor_1', 0, mockLogger)
        ).toThrow('Furniture ID must be a string');

        expect(() =>
          validateProximityParameters({}, 'core:actor_1', 0, mockLogger)
        ).toThrow('Furniture ID must be a string');

        expect(() =>
          validateProximityParameters([], 'core:actor_1', 0, mockLogger)
        ).toThrow('Furniture ID must be a string');
      });

      it('should throw error for empty string furniture ID', () => {
        expect(() =>
          validateProximityParameters('', 'core:actor_1', 0, mockLogger)
        ).toThrow('Furniture ID cannot be empty or whitespace only');
      });

      it('should throw error for whitespace-only furniture ID', () => {
        expect(() =>
          validateProximityParameters('   ', 'core:actor_1', 0, mockLogger)
        ).toThrow('Furniture ID cannot be empty or whitespace only');
      });

      it('should throw error for furniture ID without namespace', () => {
        expect(() =>
          validateProximityParameters('no-colon', 'core:actor_1', 0, mockLogger)
        ).toThrow(
          'Furniture ID must be in namespaced format (modId:identifier)'
        );
      });

      it('should throw error for furniture ID with multiple colons', () => {
        expect(() =>
          validateProximityParameters(
            'mod:double:colon',
            'core:actor_1',
            0,
            mockLogger
          )
        ).toThrow(
          'Furniture ID must have exactly one colon separating mod ID and identifier'
        );
      });

      it('should throw error for furniture ID missing mod ID', () => {
        expect(() =>
          validateProximityParameters(
            ':missing-mod',
            'core:actor_1',
            0,
            mockLogger
          )
        ).toThrow('Furniture ID must have a valid mod ID before the colon');
      });

      it('should throw error for furniture ID missing identifier', () => {
        expect(() =>
          validateProximityParameters(
            'missing-id:',
            'core:actor_1',
            0,
            mockLogger
          )
        ).toThrow('Furniture ID must have a valid identifier after the colon');
      });

      it('should throw error for invalid characters in mod ID', () => {
        expect(() =>
          validateProximityParameters(
            'mod@special:furniture',
            'core:actor_1',
            0,
            mockLogger
          )
        ).toThrow(
          'Mod ID must contain only alphanumeric characters, underscores, and hyphens'
        );
      });

      it('should throw error for invalid characters in identifier', () => {
        expect(() =>
          validateProximityParameters(
            'mod:furniture@special',
            'core:actor_1',
            0,
            mockLogger
          )
        ).toThrow(
          'Identifier must contain only alphanumeric characters, underscores, and hyphens'
        );
      });
    });

    describe('invalid actor ID', () => {
      it('should throw error for null actor ID', () => {
        expect(() =>
          validateProximityParameters('core:furniture_1', null, 0, mockLogger)
        ).toThrow('Actor ID is required');
      });

      it('should throw error for undefined actor ID', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            undefined,
            0,
            mockLogger
          )
        ).toThrow('Actor ID is required');
      });

      it('should throw error for non-string actor ID', () => {
        expect(() =>
          validateProximityParameters('core:furniture_1', 123, 0, mockLogger)
        ).toThrow('Actor ID must be a string');
      });

      it('should throw error for empty string actor ID', () => {
        expect(() =>
          validateProximityParameters('core:furniture_1', '', 0, mockLogger)
        ).toThrow('Actor ID cannot be empty or whitespace only');
      });

      it('should throw error for whitespace-only actor ID', () => {
        expect(() =>
          validateProximityParameters('core:furniture_1', '   ', 0, mockLogger)
        ).toThrow('Actor ID cannot be empty or whitespace only');
      });

      it('should throw error for actor ID without namespace', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'no-colon',
            0,
            mockLogger
          )
        ).toThrow('Actor ID must be in namespaced format (modId:identifier)');
      });

      it('should throw error for actor ID with multiple colons', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:double:colon',
            0,
            mockLogger
          )
        ).toThrow(
          'Actor ID must have exactly one colon separating mod ID and identifier'
        );
      });

      it('should throw error for actor ID missing mod ID', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            ':missing-mod',
            0,
            mockLogger
          )
        ).toThrow('Actor ID must have a valid mod ID before the colon');
      });

      it('should throw error for actor ID missing identifier', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'missing-id:',
            0,
            mockLogger
          )
        ).toThrow('Actor ID must have a valid identifier after the colon');
      });

      it('should throw error for invalid characters in actor mod ID', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod@special:actor',
            0,
            mockLogger
          )
        ).toThrow(
          'Actor ID mod ID must contain only alphanumeric characters, underscores, and hyphens'
        );
      });

      it('should throw error for invalid characters in actor identifier', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor@special',
            0,
            mockLogger
          )
        ).toThrow(
          'Actor ID identifier must contain only alphanumeric characters, underscores, and hyphens'
        );
      });
    });

    describe('invalid spot index', () => {
      it('should throw error for null spot index', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor_1',
            null,
            mockLogger
          )
        ).toThrow('Spot index is required');
      });

      it('should throw error for undefined spot index', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor_1',
            undefined,
            mockLogger
          )
        ).toThrow('Spot index is required');
      });

      it('should throw error for non-number spot index', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor_1',
            'spot',
            mockLogger
          )
        ).toThrow('Spot index must be a number');
      });

      it('should throw error for string number spot index', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor_1',
            '2',
            mockLogger
          )
        ).toThrow('Spot index must be a number');
      });

      it('should throw error for non-integer spot index', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor_1',
            1.5,
            mockLogger
          )
        ).toThrow('Spot index must be an integer');
      });

      it('should throw error for NaN spot index', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor_1',
            NaN,
            mockLogger
          )
        ).toThrow('Spot index must be an integer');
      });

      it('should throw error for Infinity spot index', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor_1',
            Infinity,
            mockLogger
          )
        ).toThrow('Spot index must be an integer');
      });

      it('should throw error for negative spot index', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor_1',
            -1,
            mockLogger
          )
        ).toThrow('Spot index must be non-negative');

        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor_1',
            -999,
            mockLogger
          )
        ).toThrow('Spot index must be non-negative');
      });

      it('should throw error for spot index above maximum', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor_1',
            10,
            mockLogger
          )
        ).toThrow(
          'Spot index must be between 0 and 9 (maximum furniture capacity)'
        );

        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor_1',
            100,
            mockLogger
          )
        ).toThrow(
          'Spot index must be between 0 and 9 (maximum furniture capacity)'
        );
      });
    });

    describe('invalid logger', () => {
      it('should throw error when logger is null', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor_1',
            0,
            null
          )
        ).toThrow('Logger is required');
      });

      it('should throw error when logger is undefined', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor_1',
            0,
            undefined
          )
        ).toThrow('Logger is required');
      });

      it('should throw error when logger is not an object', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor_1',
            0,
            'not-object'
          )
        ).toThrow('Logger must be an object');

        expect(() =>
          validateProximityParameters('core:furniture_1', 'mod:actor_1', 0, 123)
        ).toThrow('Logger must be an object');
      });

      it('should throw error when logger is missing required methods', () => {
        expect(() =>
          validateProximityParameters('core:furniture_1', 'mod:actor_1', 0, {})
        ).toThrow('Logger must have info method');

        expect(() =>
          validateProximityParameters('core:furniture_1', 'mod:actor_1', 0, {
            info: jest.fn(),
          })
        ).toThrow('Logger must have warn method');

        expect(() =>
          validateProximityParameters('core:furniture_1', 'mod:actor_1', 0, {
            info: jest.fn(),
            warn: jest.fn(),
          })
        ).toThrow('Logger must have error method');

        expect(() =>
          validateProximityParameters('core:furniture_1', 'mod:actor_1', 0, {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          })
        ).toThrow('Logger must have debug method');
      });

      it('should throw error when logger methods are not functions', () => {
        expect(() =>
          validateProximityParameters('core:furniture_1', 'mod:actor_1', 0, {
            info: 'not-function',
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          })
        ).toThrow('Logger info must be a function');

        expect(() =>
          validateProximityParameters('core:furniture_1', 'mod:actor_1', 0, {
            info: jest.fn(),
            warn: null,
            error: jest.fn(),
            debug: jest.fn(),
          })
        ).toThrow('Logger warn must be a function');
      });
    });

    describe('error accumulation and reporting', () => {
      it('should accumulate and report multiple validation errors', () => {
        expect(() => validateProximityParameters(null, '', 10, null)).toThrow(
          InvalidArgumentError
        );

        expect(() => validateProximityParameters(null, '', 10, null)).toThrow(
          /Parameter validation failed.*Furniture ID is required.*Actor ID cannot be empty or whitespace only.*Spot index must be between 0 and 9.*Logger is required/
        );
      });

      it('should report furniture and actor ID errors together', () => {
        expect(() =>
          validateProximityParameters(
            'invalid-no-colon',
            'also:invalid:double',
            0,
            mockLogger
          )
        ).toThrow(
          /Furniture ID must be in namespaced format.*Actor ID must have exactly one colon separating/
        );
      });

      it('should include all parameters in error log context', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture',
            'mod:actor',
            -1,
            mockLogger
          )
        ).toThrow();

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Proximity parameter validation failed',
          expect.objectContaining({
            furnitureId: 'core:furniture',
            actorId: 'mod:actor',
            spotIndex: -1,
            errors: expect.arrayContaining(['Spot index must be non-negative']),
            timestamp: expect.any(String),
          })
        );
      });

      it('should include ISO timestamp in error log', () => {
        expect(() =>
          validateProximityParameters(
            'core:furniture',
            'mod:actor',
            -1,
            mockLogger
          )
        ).toThrow();

        const errorCall = mockLogger.error.mock.calls[0][1];
        expect(errorCall.timestamp).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        );
      });

      it('should handle logger failure gracefully during error reporting', () => {
        const faultyLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(() => {
            throw new Error('Logger failed');
          }),
          debug: jest.fn(),
        };

        expect(() =>
          validateProximityParameters(
            'core:furniture',
            'mod:actor',
            -1,
            faultyLogger
          )
        ).toThrow('Spot index must be non-negative');
      });
    });

    describe('successful validation logging', () => {
      it('should log successful validation at debug level', () => {
        validateProximityParameters(
          'core:furniture_1',
          'mod:actor_1',
          5,
          mockLogger
        );

        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Proximity parameters validated successfully',
          {
            furnitureId: 'core:furniture_1',
            actorId: 'mod:actor_1',
            spotIndex: 5,
          }
        );
      });

      it('should handle debug logging failure gracefully', () => {
        const faultyLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(() => {
            throw new Error('Debug logging failed');
          }),
        };

        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor_1',
            5,
            faultyLogger
          )
        ).not.toThrow();
      });

      it('should skip debug logging if the method becomes unavailable after validation', () => {
        const debugSpy = jest.fn();
        let debugAccessCount = 0;
        const dynamicLogger = {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          get debug() {
            debugAccessCount += 1;
            if (debugAccessCount <= 2) {
              return debugSpy;
            }
            return undefined;
          },
        };

        const result = validateProximityParameters(
          'core:furniture_1',
          'mod:actor_1',
          5,
          dynamicLogger
        );

        expect(result).toBe(true);
        expect(debugSpy).not.toHaveBeenCalled();
      });
    });

    describe('unexpected error handling', () => {
      it('should catch and wrap unexpected errors during validation', () => {
        const runtimeFailure = new Error('info getter failure');
        const throwingLogger = {
          get info() {
            throw runtimeFailure;
          },
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn(),
        };

        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor_1',
            0,
            throwingLogger
          )
        ).toThrow(
          `Unexpected error during parameter validation: ${runtimeFailure.message}`
        );

        expect(throwingLogger.error).toHaveBeenCalledWith(
          'Unexpected validation error',
          expect.objectContaining({
            originalError: runtimeFailure.message,
            stack: expect.any(String),
          })
        );
      });

      it('should handle unexpected errors when logger error method becomes unavailable', () => {
        const runtimeFailure = new Error('info getter failure');
        const errorSpy = jest.fn();
        const throwingLogger = {
          get info() {
            delete this.error;
            throw runtimeFailure;
          },
          warn: jest.fn(),
          error: errorSpy,
          debug: jest.fn(),
        };

        expect(() =>
          validateProximityParameters(
            'core:furniture_1',
            'mod:actor_1',
            0,
            throwingLogger
          )
        ).toThrow(
          `Unexpected error during parameter validation: ${runtimeFailure.message}`
        );

        expect(errorSpy).not.toHaveBeenCalled();
      });

      it('should re-throw InvalidArgumentError without wrapping', () => {
        expect(() =>
          validateProximityParameters('', 'mod:actor', 0, mockLogger)
        ).toThrow(InvalidArgumentError);
      });
    });
  });

  describe('default export', () => {
    it('should export all functions as default object', async () => {
      const proximityUtils = await import(
        '../../../src/utils/proximityUtils.js'
      );
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
