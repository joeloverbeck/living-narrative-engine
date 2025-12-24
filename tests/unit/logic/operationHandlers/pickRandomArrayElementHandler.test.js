/**
 * @file Unit tests for PickRandomArrayElementHandler
 */

import PickRandomArrayElementHandler from '../../../../src/logic/operationHandlers/pickRandomArrayElementHandler.js';

describe('PickRandomArrayElementHandler', () => {
  let handler;
  let mockEntityManager;
  let mockLogger;
  let context;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    handler = new PickRandomArrayElementHandler({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });

    context = {
      evaluationContext: {
        context: {},
        event: {
          payload: {},
        },
      },
      logger: mockLogger,
    };
  });

  describe('Constructor', () => {
    test('should initialize correctly', () => {
      expect(handler).toBeDefined();
    });

    test('should throw when entityManager is missing', () => {
      expect(
        () =>
          new PickRandomArrayElementHandler({
            logger: mockLogger,
          })
      ).toThrow();
    });

    test('should throw when logger is missing', () => {
      expect(
        () =>
          new PickRandomArrayElementHandler({
            entityManager: mockEntityManager,
          })
      ).toThrow();
    });

    test('should throw when entityManager lacks required methods', () => {
      expect(
        () =>
          new PickRandomArrayElementHandler({
            entityManager: { someMethod: jest.fn() },
            logger: mockLogger,
          })
      ).toThrow();
    });

    test('should throw when logger lacks required methods', () => {
      expect(
        () =>
          new PickRandomArrayElementHandler({
            entityManager: mockEntityManager,
            logger: { debug: jest.fn() },
          })
      ).toThrow();
    });
  });

  describe('Entity Reference Resolution', () => {
    test('should resolve "actor" keyword to actorId from event payload', async () => {
      context.evaluationContext.event.payload.actorId = 'actor1';

      mockEntityManager.getComponentData.mockReturnValue({
        exits: [{ direction: 'north', destination: 'loc2' }],
      });

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor1',
        'locations:exits'
      );
    });

    test('should resolve "actor" keyword to actorId from context', async () => {
      context.evaluationContext.context.actorId = 'actor2';

      mockEntityManager.getComponentData.mockReturnValue({
        items: [{ id: 'item1' }],
      });

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'inventory:inventory',
          array_field: 'items',
          result_variable: 'result',
        },
        context
      );

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'actor2',
        'inventory:inventory'
      );
    });

    test('should resolve "target" keyword to targetId from event payload', async () => {
      context.evaluationContext.event.payload.targetId = 'target1';

      mockEntityManager.getComponentData.mockReturnValue({
        exits: [{ direction: 'south', destination: 'loc3' }],
      });

      await handler.execute(
        {
          entity_ref: 'target',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'target1',
        'locations:exits'
      );
    });

    test('should resolve context reference pattern {context.varName}', async () => {
      context.evaluationContext.context.locationId = 'location1';

      mockEntityManager.getComponentData.mockReturnValue({
        exits: [{ direction: 'east', destination: 'loc4' }],
      });

      await handler.execute(
        {
          entity_ref: '{context.locationId}',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'location1',
        'locations:exits'
      );
    });

    test('should resolve event payload reference pattern', async () => {
      context.evaluationContext.event.payload.locationId = 'location2';

      mockEntityManager.getComponentData.mockReturnValue({
        exits: [{ direction: 'west', destination: 'loc5' }],
      });

      await handler.execute(
        {
          entity_ref: '{event.payload.locationId}',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'location2',
        'locations:exits'
      );
    });

    test('should resolve object with entityId property', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        exits: [{ direction: 'up', destination: 'loc6' }],
      });

      await handler.execute(
        {
          entity_ref: { entityId: 'location3' },
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'location3',
        'locations:exits'
      );
    });

    test('should resolve nested object entityId with context reference', async () => {
      context.evaluationContext.context.actorPosition = { locationId: 'loc7' };

      mockEntityManager.getComponentData.mockReturnValue({
        exits: [{ direction: 'down', destination: 'loc8' }],
      });

      await handler.execute(
        {
          entity_ref: { entityId: '{context.actorPosition}' },
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      // Since actorPosition is an object, not a string, it should fail to resolve
      expect(context.evaluationContext.context.result).toBeNull();
    });

    test('should use direct entity ID string', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        exits: [{ direction: 'north', destination: 'loc9' }],
      });

      await handler.execute(
        {
          entity_ref: 'direct-entity-id',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'direct-entity-id',
        'locations:exits'
      );
    });

    test('should store null when entity_ref cannot be resolved', async () => {
      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not resolve entity_ref')
      );
    });
  });

  describe('Array Extraction', () => {
    beforeEach(() => {
      context.evaluationContext.event.payload.actorId = 'actor1';
    });

    test('should extract array from specified array_field', async () => {
      const exits = [
        { direction: 'north', destination: 'loc2' },
        { direction: 'south', destination: 'loc3' },
      ];

      mockEntityManager.getComponentData.mockReturnValue({ exits });
      jest.spyOn(Math, 'random').mockReturnValue(0);

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toEqual(exits[0]);
    });

    test('should extract array from nested path', async () => {
      const weapons = [{ id: 'sword' }, { id: 'axe' }];

      mockEntityManager.getComponentData.mockReturnValue({
        items: { weapons },
      });
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'inventory:inventory',
          array_field: 'items.weapons',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toEqual(weapons[1]);
    });

    test('should use smart default for locations:exits component', async () => {
      const exits = [{ direction: 'east', destination: 'loc4' }];

      mockEntityManager.getComponentData.mockReturnValue({ exits });

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'locations:exits',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toEqual(exits[0]);
    });

    test('should handle component data as direct array', async () => {
      const exits = [{ direction: 'west', destination: 'loc5' }];

      mockEntityManager.getComponentData.mockReturnValue(exits);

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'locations:exits',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toEqual(exits[0]);
    });

    test('should try common field names (items) when array_field not specified', async () => {
      const items = [{ id: 'potion' }, { id: 'scroll' }];

      mockEntityManager.getComponentData.mockReturnValue({ items });
      jest.spyOn(Math, 'random').mockReturnValue(0);

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'inventory:inventory',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toEqual(items[0]);
    });

    test('should try common field names (elements) when array_field not specified', async () => {
      const elements = [{ type: 'fire' }, { type: 'water' }];

      mockEntityManager.getComponentData.mockReturnValue({ elements });
      jest.spyOn(Math, 'random').mockReturnValue(0.9);

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'magic:affinities',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toEqual(elements[1]);
    });

    test('should try common field names (values) when array_field not specified', async () => {
      const values = ['high', 'medium', 'low'];

      mockEntityManager.getComponentData.mockReturnValue({ values });
      jest.spyOn(Math, 'random').mockReturnValue(0.34);

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'stats:priorities',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBe('medium');
    });

    test('should store null when array_field path is invalid', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        other: 'data',
      });

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'locations:exits',
          array_field: 'nonexistent.path',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Array is empty or not found')
      );
    });
  });

  describe('Random Selection', () => {
    beforeEach(() => {
      context.evaluationContext.event.payload.actorId = 'actor1';
    });

    test('should pick first element when Math.random returns 0', async () => {
      const exits = [
        { direction: 'north', destination: 'loc1' },
        { direction: 'south', destination: 'loc2' },
        { direction: 'east', destination: 'loc3' },
      ];

      mockEntityManager.getComponentData.mockReturnValue({ exits });
      jest.spyOn(Math, 'random').mockReturnValue(0);

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toEqual(exits[0]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Selected element at index 0')
      );
    });

    test('should pick middle element with appropriate random value', async () => {
      const exits = [
        { direction: 'north', destination: 'loc1' },
        { direction: 'south', destination: 'loc2' },
        { direction: 'east', destination: 'loc3' },
      ];

      mockEntityManager.getComponentData.mockReturnValue({ exits });
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toEqual(exits[1]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Selected element at index 1')
      );
    });

    test('should pick last element when Math.random is close to 1', async () => {
      const exits = [
        { direction: 'north', destination: 'loc1' },
        { direction: 'south', destination: 'loc2' },
        { direction: 'east', destination: 'loc3' },
      ];

      mockEntityManager.getComponentData.mockReturnValue({ exits });
      jest.spyOn(Math, 'random').mockReturnValue(0.99);

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toEqual(exits[2]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Selected element at index 2')
      );
    });

    test('should handle single-element array', async () => {
      const exits = [{ direction: 'north', destination: 'loc1' }];

      mockEntityManager.getComponentData.mockReturnValue({ exits });

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toEqual(exits[0]);
    });
  });

  describe('Component Lookup', () => {
    beforeEach(() => {
      context.evaluationContext.event.payload.actorId = 'actor1';
    });

    test('should store null when entity has no component', async () => {
      mockEntityManager.getComponentData.mockReturnValue(null);

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('has no locations:exits component')
      );
    });

    test('should store null when component has undefined value', async () => {
      mockEntityManager.getComponentData.mockReturnValue(undefined);

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBeNull();
    });
  });

  describe('Empty Array Handling', () => {
    beforeEach(() => {
      context.evaluationContext.event.payload.actorId = 'actor1';
    });

    test('should store null when array is empty', async () => {
      mockEntityManager.getComponentData.mockReturnValue({ exits: [] });

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBeNull();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Array is empty or not found')
      );
    });

    test('should store null when array_field points to non-array', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        exits: 'not-an-array',
      });

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBeNull();
    });

    test('should store null when array_field points to object', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        exits: { north: 'loc1' },
      });

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBeNull();
    });
  });

  describe('Result Storage', () => {
    beforeEach(() => {
      context.evaluationContext.event.payload.actorId = 'actor1';
    });

    test('should store result in specified result_variable', async () => {
      const exits = [{ direction: 'north', destination: 'loc1' }];

      mockEntityManager.getComponentData.mockReturnValue({ exits });

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'selectedExit',
        },
        context
      );

      expect(context.evaluationContext.context.selectedExit).toEqual(exits[0]);
      expect(context.evaluationContext.context.result).toBeUndefined();
    });

    test('should handle missing evaluationContext gracefully', async () => {
      const badContext = {};

      await handler.execute(
        {
          entity_ref: 'direct-id',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        badContext
      );

      // Should not throw, just fail gracefully
      expect(badContext).toEqual({});
    });

    test('should handle missing context object in evaluationContext', async () => {
      const partialContext = {
        evaluationContext: {
          event: { payload: {} },
        },
      };

      await handler.execute(
        {
          entity_ref: 'direct-id',
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        partialContext
      );

      // Should not throw
      expect(partialContext.evaluationContext.context).toBeUndefined();
    });
  });

  describe('JSON Logic Integration', () => {
    test('should use jsonLogic.evaluate for complex entity refs', async () => {
      const mockJsonLogic = {
        evaluate: jest.fn().mockReturnValue('resolved-entity-id'),
      };

      context.jsonLogic = mockJsonLogic;

      mockEntityManager.getComponentData.mockReturnValue({
        exits: [{ direction: 'north', destination: 'loc1' }],
      });

      await handler.execute(
        {
          entity_ref: { var: 'some.path' },
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(mockJsonLogic.evaluate).toHaveBeenCalled();
      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'resolved-entity-id',
        'locations:exits'
      );
    });

    test('should extract id from jsonLogic result object', async () => {
      const mockJsonLogic = {
        evaluate: jest.fn().mockReturnValue({ id: 'entity-from-object' }),
      };

      context.jsonLogic = mockJsonLogic;

      mockEntityManager.getComponentData.mockReturnValue({
        exits: [{ direction: 'north', destination: 'loc1' }],
      });

      await handler.execute(
        {
          entity_ref: { var: 'some.entity' },
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
        'entity-from-object',
        'locations:exits'
      );
    });

    test('should store null when jsonLogic returns non-resolvable value', async () => {
      const mockJsonLogic = {
        evaluate: jest.fn().mockReturnValue(null),
      };

      context.jsonLogic = mockJsonLogic;

      await handler.execute(
        {
          entity_ref: { var: 'invalid.path' },
          component_type: 'locations:exits',
          array_field: 'exits',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      context.evaluationContext.event.payload.actorId = 'actor1';
    });

    test('should handle array with primitive values', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        values: ['a', 'b', 'c'],
      });
      jest.spyOn(Math, 'random').mockReturnValue(0.34);

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'core:tags',
          array_field: 'values',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBe('b');
    });

    test('should handle array with numeric values', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        values: [1, 2, 3, 4, 5],
      });
      jest.spyOn(Math, 'random').mockReturnValue(0.8);

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'stats:scores',
          array_field: 'values',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBe(5);
    });

    test('should handle very large arrays', async () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: `item-${i}`,
      }));

      mockEntityManager.getComponentData.mockReturnValue({
        items: largeArray,
      });
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'inventory:inventory',
          array_field: 'items',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toEqual({
        id: 'item-500',
      });
    });

    test('should handle null values within array', async () => {
      mockEntityManager.getComponentData.mockReturnValue({
        values: [null, 'valid', null],
      });
      jest.spyOn(Math, 'random').mockReturnValue(0);

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'core:data',
          array_field: 'values',
          result_variable: 'result',
        },
        context
      );

      // Should pick the null value at index 0
      expect(context.evaluationContext.context.result).toBeNull();
    });

    test('should handle undefined values within array', async () => {
      const arrayWithUndefined = ['first', undefined, 'third'];

      mockEntityManager.getComponentData.mockReturnValue({
        values: arrayWithUndefined,
      });
      jest.spyOn(Math, 'random').mockReturnValue(0.34);

      await handler.execute(
        {
          entity_ref: 'actor',
          component_type: 'core:data',
          array_field: 'values',
          result_variable: 'result',
        },
        context
      );

      expect(context.evaluationContext.context.result).toBeUndefined();
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
