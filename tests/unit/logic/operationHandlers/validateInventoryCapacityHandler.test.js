/**
 * @jest-environment node
 */
/**
 * @file Tests the behavior of ValidateInventoryCapacityHandler
 * @see src/logic/operationHandlers/validateInventoryCapacityHandler.js
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import ValidateInventoryCapacityHandler from '../../../../src/logic/operationHandlers/validateInventoryCapacityHandler.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';
import * as contextVariableUtils from '../../../../src/utils/contextVariableUtils.js';

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/entities/entityManager.js').default} IEntityManager */

const INVENTORY_COMPONENT_ID = 'inventory:inventory';
const WEIGHT_COMPONENT_ID = 'core:weight';

// Test Doubles
/** @type {jest.Mocked<ILogger>} */ let log;
/** @type {jest.Mocked<IEntityManager>} */ let em;
/** @type {{ dispatch: jest.Mock }} */ let dispatcher;

beforeEach(() => {
  log = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  em = {
    getComponentData: jest.fn(),
    // Additional methods that might be referenced
    hasComponent: jest.fn(),
    addComponent: jest.fn(),
    getEntityInstance: jest.fn(),
  };

  dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
});

afterEach(() => jest.clearAllMocks());

describe('ValidateInventoryCapacityHandler', () => {
  // Constructor Tests
  describe('constructor', () => {
    test('creates an instance when dependencies are valid', () => {
      const handler = new ValidateInventoryCapacityHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      expect(handler).toBeInstanceOf(ValidateInventoryCapacityHandler);
    });

    test('throws if logger is missing', () => {
      expect(
        () =>
          new ValidateInventoryCapacityHandler({
            entityManager: em,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/logger/);
    });

    test('throws if entityManager is missing', () => {
      expect(
        () =>
          new ValidateInventoryCapacityHandler({
            logger: log,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/entityManager/);
    });

    test('throws if safeEventDispatcher is missing', () => {
      expect(
        () =>
          new ValidateInventoryCapacityHandler({
            logger: log,
            entityManager: em,
          })
      ).toThrow(/safeEventDispatcher/);
    });
  });

  // Execute Tests - Valid Scenarios
  describe('execute - valid capacity scenarios', () => {
    let handler;

    beforeEach(() => {
      handler = new ValidateInventoryCapacityHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('validates successfully when capacity is available', async () => {
      const inventory = {
        capacity: { maxItems: 10, maxWeight: 100 },
        items: ['item1', 'item2'],
      };
      const itemWeight = { weight: 5 };
      const existingWeight1 = { weight: 10 };
      const existingWeight2 = { weight: 15 };

      em.getComponentData
        .mockReturnValueOnce(inventory) // targetEntity inventory
        .mockReturnValueOnce(itemWeight) // itemEntity weight
        .mockReturnValueOnce(existingWeight1) // item1 weight
        .mockReturnValueOnce(existingWeight2); // item2 weight

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          targetEntity: 'actor1',
          itemEntity: 'item3',
          result_variable: 'testResult',
        },
        executionContext
      );

      expect(executionContext.evaluationContext.context.testResult).toEqual({
        valid: true,
      });
      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor1',
        INVENTORY_COMPONENT_ID
      );
      expect(em.getComponentData).toHaveBeenCalledWith(
        'item3',
        WEIGHT_COMPONENT_ID
      );
    });

    test('validates successfully for empty inventory', async () => {
      const inventory = {
        capacity: { maxItems: 10, maxWeight: 100 },
        items: [],
      };
      const itemWeight = { weight: 5 };

      em.getComponentData
        .mockReturnValueOnce(inventory)
        .mockReturnValueOnce(itemWeight);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          targetEntity: 'actor1',
          itemEntity: 'item1',
          result_variable: 'testResult',
        },
        executionContext
      );

      expect(executionContext.evaluationContext.context.testResult).toEqual({
        valid: true,
      });
    });

    test('validates successfully at boundary (max items - 1)', async () => {
      const inventory = {
        capacity: { maxItems: 3, maxWeight: 100 },
        items: ['item1', 'item2'], // 2 items, max is 3
      };
      const itemWeight = { weight: 5 };
      const existingWeight1 = { weight: 10 };
      const existingWeight2 = { weight: 15 };

      em.getComponentData
        .mockReturnValueOnce(inventory)
        .mockReturnValueOnce(itemWeight)
        .mockReturnValueOnce(existingWeight1)
        .mockReturnValueOnce(existingWeight2);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          targetEntity: 'actor1',
          itemEntity: 'item3',
          result_variable: 'testResult',
        },
        executionContext
      );

      expect(executionContext.evaluationContext.context.testResult).toEqual({
        valid: true,
      });
    });

    test('handles items with null/undefined weight gracefully', async () => {
      const inventory = {
        capacity: { maxItems: 10, maxWeight: 100 },
        items: ['item1', 'item2'],
      };
      const itemWeight = { weight: 5 };

      em.getComponentData
        .mockReturnValueOnce(inventory)
        .mockReturnValueOnce(itemWeight)
        .mockReturnValueOnce(null) // item1 has no weight component
        .mockReturnValueOnce({ weight: 10 }); // item2 has weight

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          targetEntity: 'actor1',
          itemEntity: 'item3',
          result_variable: 'testResult',
        },
        executionContext
      );

      expect(executionContext.evaluationContext.context.testResult).toEqual({
        valid: true,
      });
    });
  });

  // Execute Tests - Invalid Scenarios
  describe('execute - invalid capacity scenarios', () => {
    let handler;

    beforeEach(() => {
      handler = new ValidateInventoryCapacityHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('fails when max items exceeded', async () => {
      const inventory = {
        capacity: { maxItems: 3, maxWeight: 100 },
        items: ['item1', 'item2', 'item3'], // already at max
      };
      const itemWeight = { weight: 5 };

      em.getComponentData
        .mockReturnValueOnce(inventory)
        .mockReturnValueOnce(itemWeight);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          targetEntity: 'actor1',
          itemEntity: 'item4',
          result_variable: 'testResult',
        },
        executionContext
      );

      expect(executionContext.evaluationContext.context.testResult).toEqual({
        valid: false,
        reason: 'max_items_exceeded',
      });
      expect(log.debug).toHaveBeenCalledWith(
        'ValidateInventoryCapacityHandler: Inventory full (item count)',
        expect.any(Object)
      );
    });

    test('fails when max weight would be exceeded', async () => {
      const inventory = {
        capacity: { maxItems: 10, maxWeight: 30 },
        items: ['item1', 'item2'],
      };
      const itemWeight = { weight: 15 }; // Adding this would exceed max
      const existingWeight1 = { weight: 10 };
      const existingWeight2 = { weight: 10 };

      em.getComponentData
        .mockReturnValueOnce(inventory)
        .mockReturnValueOnce(itemWeight)
        .mockReturnValueOnce(existingWeight1)
        .mockReturnValueOnce(existingWeight2);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          targetEntity: 'actor1',
          itemEntity: 'item3',
          result_variable: 'testResult',
        },
        executionContext
      );

      expect(executionContext.evaluationContext.context.testResult).toEqual({
        valid: false,
        reason: 'max_weight_exceeded',
      });
      expect(log.debug).toHaveBeenCalledWith(
        'ValidateInventoryCapacityHandler: Inventory full (weight)',
        expect.objectContaining({
          currentWeight: 20,
          newWeight: 35,
          maxWeight: 30,
        })
      );
    });

    test('fails when weight would exactly match max (boundary)', async () => {
      const inventory = {
        capacity: { maxItems: 10, maxWeight: 30 },
        items: ['item1'],
      };
      const itemWeight = { weight: 10 };
      const existingWeight1 = { weight: 20 };

      em.getComponentData
        .mockReturnValueOnce(inventory)
        .mockReturnValueOnce(itemWeight)
        .mockReturnValueOnce(existingWeight1);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          targetEntity: 'actor1',
          itemEntity: 'item2',
          result_variable: 'testResult',
        },
        executionContext
      );

      // Weight: 20 + 10 = 30, which should still be valid (not exceeding)
      expect(executionContext.evaluationContext.context.testResult).toEqual({
        valid: true,
      });
    });

    test('fails when weight exceeds max by 1 (boundary)', async () => {
      const inventory = {
        capacity: { maxItems: 10, maxWeight: 30 },
        items: ['item1'],
      };
      const itemWeight = { weight: 11 };
      const existingWeight1 = { weight: 20 };

      em.getComponentData
        .mockReturnValueOnce(inventory)
        .mockReturnValueOnce(itemWeight)
        .mockReturnValueOnce(existingWeight1);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          targetEntity: 'actor1',
          itemEntity: 'item2',
          result_variable: 'testResult',
        },
        executionContext
      );

      expect(executionContext.evaluationContext.context.testResult).toEqual({
        valid: false,
        reason: 'max_weight_exceeded',
      });
    });
  });

  // Execute Tests - Failure Scenarios
  describe('execute - failure scenarios', () => {
    let handler;

    beforeEach(() => {
      handler = new ValidateInventoryCapacityHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('fails when targetEntity parameter is missing', async () => {
      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          itemEntity: 'item1',
          result_variable: 'testResult',
        },
        executionContext
      );

      expect(executionContext.evaluationContext.context.testResult).toEqual({
        valid: false,
        reason: 'validation_failed',
      });
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Object)
      );
    });

    test('fails when itemEntity parameter is missing', async () => {
      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          targetEntity: 'actor1',
          result_variable: 'testResult',
        },
        executionContext
      );

      expect(executionContext.evaluationContext.context.testResult).toEqual({
        valid: false,
        reason: 'validation_failed',
      });
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Object)
      );
    });

    test('does not attempt to write context variable when result_variable is blank', async () => {
      const spy = jest.spyOn(contextVariableUtils, 'tryWriteContextVariable');

      const executionContext = { evaluationContext: { context: {} } };

      try {
        await handler.execute(
          {
            targetEntity: 'actor1',
            itemEntity: 'item1',
            result_variable: '   ',
          },
          executionContext
        );

        expect(spy).not.toHaveBeenCalled();
        expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
        expect(executionContext.evaluationContext.context).toEqual({});
      } finally {
        spy.mockRestore();
      }
    });

    test('fails when params is null', async () => {
      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(null, executionContext);

      // When params is null, handler cannot write to result_variable
      // It should still dispatch an error event
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.any(Object)
      );
    });

    test('fails when targetEntity has no inventory component', async () => {
      em.getComponentData.mockReturnValueOnce(null); // no inventory

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          targetEntity: 'actor1',
          itemEntity: 'item1',
          result_variable: 'testResult',
        },
        executionContext
      );

      expect(executionContext.evaluationContext.context.testResult).toEqual({
        valid: false,
        reason: 'no_inventory',
      });
      expect(log.warn).toHaveBeenCalledWith(
        'ValidateInventoryCapacityHandler: No inventory component on target',
        expect.any(Object)
      );
    });

    test('fails when item has no weight component', async () => {
      const inventory = {
        capacity: { maxItems: 10, maxWeight: 100 },
        items: [],
      };

      em.getComponentData
        .mockReturnValueOnce(inventory)
        .mockReturnValueOnce(null); // no weight component

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          targetEntity: 'actor1',
          itemEntity: 'item1',
          result_variable: 'testResult',
        },
        executionContext
      );

      expect(executionContext.evaluationContext.context.testResult).toEqual({
        valid: false,
        reason: 'no_weight',
      });
      expect(log.warn).toHaveBeenCalledWith(
        'ValidateInventoryCapacityHandler: No weight component on item',
        expect.any(Object)
      );
    });

    test('handles getComponentData errors gracefully', async () => {
      const getDataError = new Error('Component data retrieval failed');
      em.getComponentData.mockImplementation(() => {
        throw getDataError;
      });

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          targetEntity: 'actor1',
          itemEntity: 'item1',
          result_variable: 'testResult',
        },
        executionContext
      );

      expect(executionContext.evaluationContext.context.testResult).toEqual({
        valid: false,
        reason: 'Component data retrieval failed',
      });
      expect(log.error).toHaveBeenCalledWith(
        'ValidateInventoryCapacityHandler: Capacity validation failed',
        getDataError,
        expect.any(Object)
      );
    });
  });

  // Parameter Trimming Tests
  describe('parameter trimming', () => {
    let handler;

    beforeEach(() => {
      handler = new ValidateInventoryCapacityHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('trims whitespace from entity IDs', async () => {
      const inventory = {
        capacity: { maxItems: 10, maxWeight: 100 },
        items: [],
      };
      const itemWeight = { weight: 5 };

      em.getComponentData
        .mockReturnValueOnce(inventory)
        .mockReturnValueOnce(itemWeight);

      const executionContext = { evaluationContext: { context: {} } };
      await handler.execute(
        {
          targetEntity: '  actor1  ',
          itemEntity: '  item1  ',
          result_variable: 'testResult',
        },
        executionContext
      );

      expect(em.getComponentData).toHaveBeenCalledWith(
        'actor1',
        INVENTORY_COMPONENT_ID
      );
      expect(em.getComponentData).toHaveBeenCalledWith(
        'item1',
        WEIGHT_COMPONENT_ID
      );
    });
  });
});
