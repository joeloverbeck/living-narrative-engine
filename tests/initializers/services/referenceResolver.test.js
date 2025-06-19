import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ReferenceResolver from '../../../src/initializers/services/referenceResolver.js';

/**
 * Creates a mock logger with Jest stubs for the standard log methods.
 *
 * @returns {{debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock}}
 *   Object containing Jest mock functions.
 */
const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('ReferenceResolver', () => {
  let mockEntityManager;
  let mockLogger;
  let resolver;

  beforeEach(() => {
    mockEntityManager = {
      // getPrimaryInstanceByDefinitionId: jest.fn(), // No longer used by ReferenceResolver
    };
    mockLogger = createMockLogger();
    resolver = new ReferenceResolver({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('throws when entityManager is missing', () => {
      expect(() => new ReferenceResolver({ logger: mockLogger })).toThrow(
        'ReferenceResolver requires an EntityManager.'
      );
    });

    it('throws when logger is missing', () => {
      expect(
        () => new ReferenceResolver({ entityManager: mockEntityManager })
      ).toThrow('ReferenceResolver requires an ILogger.');
    });

    it('logs a deprecation warning on instantiation', () => {
      // Create a new resolver instance to specifically test constructor logging
      new ReferenceResolver({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'This service implements a deprecated pattern (resolutionStrategy)'
        )
      );
    });
  });

  describe('resolve (with deprecated resolutionStrategy)', () => {
    it('handles "direct" strategy: logs warning, returns original value, valueChanged is false', () => {
      const data = { target: 'core:item' }; // This would have been a definitionId
      const spec = {
        dataPath: 'target',
        resolutionStrategy: { type: 'direct' },
      };
      const result = resolver.resolve(data, spec, 'ent1', 'compA');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Attempted 'direct' resolution for [compA]@'target' on entity ent1 with value 'core:item'"
        )
      );
      expect(result).toEqual({
        resolvedValue: 'core:item', // Original value
        valueChanged: false,
        dataPath: 'target',
        dataPathIsSelf: false,
      });
    });

    it('handles "direct" strategy with non-definition ID: no warning, returns original value, valueChanged is false', () => {
      const data = { target: 'some-instance-id' }; // Already an instance ID
      const spec = {
        dataPath: 'target',
        resolutionStrategy: { type: 'direct' },
      };
      const result = resolver.resolve(data, spec, 'ent1', 'compA');

      // Specific warning for definition-like IDs is not called
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining(
          "Attempted 'direct' resolution for [compA]@'target'"
        )
      );
      // General deprecation debug log from resolve() might still be called
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "Processing [compA]@'target' for entity ent1 with strategy direct. This pattern is deprecated."
        )
      );

      expect(result).toEqual({
        resolvedValue: 'some-instance-id', // Original value
        valueChanged: false,
        dataPath: 'target',
        dataPathIsSelf: false,
      });
    });

    it('handles "arrayOfDefinitionIds" strategy: logs warnings for each defId, returns original array, valueChanged is false', () => {
      const data = { items: ['core:item1', 'uuid-2', 'core:item3'] };
      const spec = {
        dataPath: 'items',
        resolutionStrategy: { type: 'arrayOfDefinitionIds' },
      };
      const result = resolver.resolve(data, spec, 'ent1', 'compA');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Attempted 'arrayOfDefinitionIds' resolution for item 'core:item1' at [compA]@'items'[0]"
        )
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Attempted 'arrayOfDefinitionIds' resolution for item 'core:item3' at [compA]@'items'[2]"
        )
      );
      expect(result.resolvedValue).toEqual([
        'core:item1',
        'uuid-2',
        'core:item3',
      ]); // Original array
      expect(result.valueChanged).toBe(false);
      expect(result.dataPath).toBe('items');
      expect(result.dataPathIsSelf).toBe(false);
    });

    it('handles "arrayOfObjects" strategy: logs warnings for each defId in idField, returns original array, valueChanged is false', () => {
      const data = {
        slots: [
          { itemId: 'core:item1', qty: 1 },
          { itemId: 'uuid-2', qty: 2 }, // Not a definitionId, no warning for this one
          { itemId: 'core:itemObj3', qty: 3 },
        ],
      };
      const spec = {
        dataPath: 'slots',
        resolutionStrategy: { type: 'arrayOfObjects', idField: 'itemId' },
      };
      const result = resolver.resolve(data, spec, 'ent1', 'compA');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Attempted 'arrayOfObjects' resolution for idField 'itemId' (value: 'core:item1') in object at [compA]@'slots'[0]"
        )
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Attempted 'arrayOfObjects' resolution for idField 'itemId' (value: 'core:itemObj3') in object at [compA]@'slots'[2]"
        )
      );

      expect(result.valueChanged).toBe(false);
      expect(result.resolvedValue).toEqual([
        // Original array of objects
        { itemId: 'core:item1', qty: 1 },
        { itemId: 'uuid-2', qty: 2 },
        { itemId: 'core:itemObj3', qty: 3 },
      ]);
      expect(result.dataPath).toBe('slots');
      expect(result.dataPathIsSelf).toBe(false);
    });

    it('handles "arrayOfObjects" with missing idField in spec: logs warning, returns original, valueChanged false', () => {
      const data = { slots: [{ item: 'core:item1' }] };
      const spec = {
        dataPath: 'slots',
        resolutionStrategy: { type: 'arrayOfObjects' /* idField missing */ },
      };
      const result = resolver.resolve(data, spec, 'ent1', 'compA');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "'arrayOfObjects' resolution for [compA]@'slots' on entity ent1 is missing 'idField' in strategy"
        )
      );
      expect(result.resolvedValue).toEqual(data.slots);
      expect(result.valueChanged).toBe(false);
    });

    it('handles dataPathIsSelf option with "direct" strategy: logs warning, returns original value, valueChanged false', () => {
      const dataValue = 'core:item5'; // This is the componentDataInstance itself
      const spec = {
        dataPathIsSelf: true,
        resolutionStrategy: { type: 'direct' },
      };
      const result = resolver.resolve(dataValue, spec, 'ent1', 'compA');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Attempted 'direct' resolution for [compA]@'(self)' on entity ent1 with value 'core:item5'"
        )
      );
      expect(result.resolvedValue).toBe('core:item5'); // Original value
      expect(result.valueChanged).toBe(false);
      expect(result.dataPath).toBeUndefined(); // dataPath is not part of spec when dataPathIsSelf is true
      expect(result.dataPathIsSelf).toBe(true);
    });

    it('returns default result and logs warning if spec or resolutionStrategy is missing', () => {
      mockLogger.warn.mockClear(); // Clear constructor warning
      const data = { target: 'core:item' };
      const specForFirstCall = {
        dataPath: 'target' /* no resolutionStrategy */,
      };
      const result = resolver.resolve(data, specForFirstCall, 'ent1', 'compA');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid resolveFields spec for component compA on entity ent1'
        ),
        specForFirstCall
      );
      expect(result).toEqual({
        resolvedValue: undefined,
        valueChanged: false,
        dataPath: 'target',
        dataPathIsSelf: false,
      });

      mockLogger.warn.mockClear(); // Clear previous warning for the next assertion in this test
      const specForSecondCall = null;
      const result2 = resolver.resolve(
        data,
        specForSecondCall,
        'ent1',
        'compA'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid resolveFields spec for component compA on entity ent1'
        ),
        specForSecondCall
      );
      expect(result2).toEqual({
        resolvedValue: undefined,
        valueChanged: false,
        dataPath: null,
        dataPathIsSelf: false,
      });
    });

    it('returns default if dataPath is invalid and not dataPathIsSelf', () => {
      mockLogger.warn.mockClear(); // Clear constructor warning
      const data = { foo: 'bar' };
      const spec = { dataPath: null, resolutionStrategy: { type: 'direct' } }; // Invalid dataPath
      const result = resolver.resolve(data, spec, 'ent1', 'compA');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Invalid dataPath in resolveFields spec for [compA]@'null' on entity ent1"
        ),
        spec
      );
      expect(result).toEqual({
        resolvedValue: undefined,
        valueChanged: false,
        dataPath: null,
        dataPathIsSelf: false,
      });
    });

    it('skips resolution if value at dataPath is undefined (and not dataPathIsSelf)', () => {
      const data = { foo: 'bar' }; // target is undefined
      const spec = {
        dataPath: 'target',
        resolutionStrategy: { type: 'direct' },
      };
      const result = resolver.resolve(data, spec, 'ent1', 'compA');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          "No value at path 'target' for component compA on entity ent1. Skipping resolution"
        )
      );
      expect(result).toEqual({
        resolvedValue: undefined,
        valueChanged: false,
        dataPath: 'target',
        dataPathIsSelf: false,
      });
      // Ensure no resolution warnings are logged
      expect(mockLogger.warn).not.toHaveBeenCalledWith(
        expect.stringContaining("Attempted 'direct' resolution")
      );
    });

    it('handles unknown resolutionStrategy type: logs warning, returns original value, valueChanged false', () => {
      const data = { target: 'core:item' };
      const spec = {
        dataPath: 'target',
        resolutionStrategy: { type: 'unknownStrategy' },
      };
      const result = resolver.resolve(data, spec, 'ent1', 'compA');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Unknown resolutionStrategy type 'unknownStrategy' for [compA]@'target' on entity ent1"
        )
      );
      expect(result).toEqual({
        resolvedValue: 'core:item', // original value at path
        valueChanged: false, // because no resolution was performed
        dataPath: 'target',
        dataPathIsSelf: false,
      });
    });
  });
});
