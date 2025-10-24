import { describe, it, expect, jest } from '@jest/globals';
import {
  getAdjacentSpots,
  findAdjacentOccupants,
  validateProximityParameters,
} from '../../../src/utils/proximityUtils.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';

const createValidLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('proximityUtils integration coverage', () => {
  describe('getAdjacentSpots real usage', () => {
    it('calculates adjacency across multiple seating layouts', () => {
      expect(getAdjacentSpots(0, 2)).toEqual([1]);
      expect(getAdjacentSpots(1, 3)).toEqual([0, 2]);
      expect(getAdjacentSpots(3, 5)).toEqual([2, 4]);
      expect(getAdjacentSpots(0, 1)).toEqual([]);
    });

    it('surfaces InvalidArgumentError metadata for invalid inputs', () => {
      expect(() => getAdjacentSpots(-1, 3)).toThrow(InvalidArgumentError);
      expect(() => getAdjacentSpots(1.5, 3)).toThrow(
        'spotIndex must be a non-negative integer'
      );
      expect(() => getAdjacentSpots(0, 0)).toThrow(
        'totalSpots must be a positive integer'
      );
      expect(() => getAdjacentSpots(4, 4)).toThrow('out of bounds');
    });
  });

  describe('findAdjacentOccupants with dependency assertions', () => {
    it('returns adjacent occupant identifiers ignoring empty slots', () => {
      const furniture = {
        spots: ['core:alice', undefined, 'core:bob', 'mod:charlie', null],
      };

      expect(findAdjacentOccupants(furniture, 1)).toEqual([
        'core:alice',
        'core:bob',
      ]);
      expect(findAdjacentOccupants(furniture, 2)).toEqual(['mod:charlie']);
      expect(findAdjacentOccupants(furniture, 3)).toEqual(['core:bob']);
      expect(findAdjacentOccupants({ spots: ['only'] }, 0)).toEqual([]);
    });

    it('relies on dependency guards for invalid furniture data', () => {
      expect(() => findAdjacentOccupants(null, 0)).toThrow(
        'furnitureComponent is required'
      );
      expect(() => findAdjacentOccupants({}, 0)).toThrow(
        'furnitureComponent.spots is required'
      );
      expect(() => findAdjacentOccupants({ spots: [] }, 0)).toThrow(
        'cannot be empty'
      );
      expect(() => findAdjacentOccupants({ spots: 'nope' }, 0)).toThrow(
        'must be an array'
      );
      expect(() => findAdjacentOccupants({ spots: ['solo'] }, 5)).toThrow(
        'out of bounds'
      );
    });
  });

  describe('validateProximityParameters end-to-end validation', () => {
    const validFurnitureId = 'core:sofa';
    const validActorId = 'core:alice';

    it('returns true with structured debug logging even when logger debug fails gracefully', () => {
      const logger = createValidLogger();
      logger.debug.mockImplementation(() => {
        throw new Error('debug transport unavailable');
      });

      const result = validateProximityParameters(
        validFurnitureId,
        validActorId,
        2,
        logger
      );

      expect(result).toBe(true);
      expect(logger.debug).toHaveBeenCalledWith(
        'Proximity parameters validated successfully',
        {
          furnitureId: validFurnitureId,
          actorId: validActorId,
          spotIndex: 2,
        }
      );
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('aggregates multiple validation failures and logs them before throwing', () => {
      const logger = {
        warn: 'not-a-function',
        error: jest.fn(() => {
          throw new Error('logger backend down');
        }),
        debug: 'also-invalid',
      };

      let capturedError;
      try {
        validateProximityParameters('', 'actorWithoutNamespace', 12, logger);
      } catch (error) {
        capturedError = error;
      }

      expect(capturedError).toBeInstanceOf(InvalidArgumentError);
      expect(capturedError.message).toContain('Parameter validation failed');
      expect(capturedError.message).toContain('Furniture ID cannot be empty');
      expect(capturedError.message).toContain(
        'Actor ID must be in namespaced format (modId:identifier)'
      );
      expect(capturedError.message).toContain(
        'Spot index must be between 0 and 9 (maximum furniture capacity)'
      );
      expect(capturedError.message).toContain('Logger must have info method');
      expect(capturedError.message).toContain('Logger warn must be a function');
      expect(capturedError.message).toContain('Logger debug must be a function');

      expect(logger.error).toHaveBeenCalledWith(
        'Proximity parameter validation failed',
        expect.objectContaining({ errors: expect.any(Array) })
      );
    });

    it('reports specific logger contract violations', () => {
      const cases = [
        {
          logger: {},
          expected: 'Logger must have info method',
        },
        {
          logger: {
            info: 'bad',
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
          expected: 'Logger info must be a function',
        },
        {
          logger: {
            info: jest.fn(),
            warn: undefined,
            error: jest.fn(),
            debug: jest.fn(),
          },
          expected: 'Logger must have warn method',
        },
        {
          logger: {
            info: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
          expected: 'Logger must have error method',
        },
        {
          logger: {
            info: jest.fn(),
            warn: jest.fn(),
            error: 'bad',
            debug: jest.fn(),
          },
          expected: 'Logger error must be a function',
        },
        {
          logger: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: undefined,
          },
          expected: 'Logger must have debug method',
        },
      ];

      for (const { logger, expected } of cases) {
        expect(() =>
          validateProximityParameters(validFurnitureId, validActorId, 1, logger)
        ).toThrow(expected);
      }
    });

    it('flags malformed furniture identifiers with specific guidance', () => {
      const logger = createValidLogger();

      expect(() =>
        validateProximityParameters(null, validActorId, 1, logger)
      ).toThrow('Furniture ID is required');
      expect(() =>
        validateProximityParameters(42, validActorId, 1, logger)
      ).toThrow('Furniture ID must be a string');
      expect(() =>
        validateProximityParameters('   ', validActorId, 1, logger)
      ).toThrow('Furniture ID cannot be empty');
      expect(() =>
        validateProximityParameters('invalid', validActorId, 1, logger)
      ).toThrow('namespaced format');
      expect(() =>
        validateProximityParameters('too:many:colons', validActorId, 1, logger)
      ).toThrow('exactly one colon');
      expect(() =>
        validateProximityParameters(':chair', validActorId, 1, logger)
      ).toThrow('valid mod ID');
      expect(() =>
        validateProximityParameters('core:', validActorId, 1, logger)
      ).toThrow('valid identifier');
      expect(() =>
        validateProximityParameters('core:invalid id', validActorId, 1, logger)
      ).toThrow('Identifier must contain only');
      expect(() =>
        validateProximityParameters('c!re:chair', validActorId, 1, logger)
      ).toThrow('Mod ID must contain only');
    });

    it('validates actor identifiers independently from furniture IDs', () => {
      const logger = createValidLogger();

      expect(() =>
        validateProximityParameters(validFurnitureId, null, 1, logger)
      ).toThrow('Actor ID is required');
      expect(() =>
        validateProximityParameters(validFurnitureId, 42, 1, logger)
      ).toThrow('Actor ID must be a string');
      expect(() =>
        validateProximityParameters(validFurnitureId, '   ', 1, logger)
      ).toThrow('Actor ID cannot be empty');
      expect(() =>
        validateProximityParameters(validFurnitureId, 'actor', 1, logger)
      ).toThrow('Actor ID must be in namespaced format');
      expect(() =>
        validateProximityParameters(validFurnitureId, 'mod:npc extra', 1, logger)
      ).toThrow('Actor ID identifier must contain only');
      expect(() =>
        validateProximityParameters(validFurnitureId, 'mod%:npc', 1, logger)
      ).toThrow('Actor ID mod ID must contain only');
      expect(() =>
        validateProximityParameters(validFurnitureId, ':npc', 1, logger)
      ).toThrow('Actor ID must have a valid mod ID');
      expect(() =>
        validateProximityParameters(validFurnitureId, 'mod:', 1, logger)
      ).toThrow('Actor ID must have a valid identifier');
      expect(() =>
        validateProximityParameters(validFurnitureId, 'mod:npc:extra', 1, logger)
      ).toThrow('exactly one colon');
    });

    it('validates spot index variations', () => {
      const logger = createValidLogger();

      expect(() =>
        validateProximityParameters(validFurnitureId, validActorId, null, logger)
      ).toThrow('Spot index is required');
      expect(() =>
        validateProximityParameters(
          validFurnitureId,
          validActorId,
          '1',
          logger
        )
      ).toThrow('Spot index must be a number');
      expect(() =>
        validateProximityParameters(validFurnitureId, validActorId, 1.2, logger)
      ).toThrow('Spot index must be an integer');
      expect(() =>
        validateProximityParameters(validFurnitureId, validActorId, -1, logger)
      ).toThrow('Spot index must be non-negative');
      expect(() =>
        validateProximityParameters(validFurnitureId, validActorId, 11, logger)
      ).toThrow('Spot index must be between 0 and 9');
    });

    it('requires a structured logger object', () => {
      expect(() =>
        validateProximityParameters(validFurnitureId, validActorId, 1, null)
      ).toThrow('Logger is required');
      expect(() =>
        validateProximityParameters(validFurnitureId, validActorId, 1, 42)
      ).toThrow('Logger must be an object');
    });

    it('escalates unexpected errors thrown while inspecting logger methods', () => {
      const logger = {
        get info() {
          throw new Error('introspection failure');
        },
      };

      expect(() =>
        validateProximityParameters(validFurnitureId, validActorId, 1, logger)
      ).toThrow('Unexpected error during parameter validation');
    });
  });
});
