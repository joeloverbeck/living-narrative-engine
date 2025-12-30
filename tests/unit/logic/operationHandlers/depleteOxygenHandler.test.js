/**
 * @jest-environment node
 */
/**
 * @file Tests the behavior of DepleteOxygenHandler
 * @see src/logic/operationHandlers/depleteOxygenHandler.js
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import DepleteOxygenHandler from '../../../../src/logic/operationHandlers/depleteOxygenHandler.js';
import {
  RESPIRATORY_ORGAN_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID as PART_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';
import { OXYGEN_DEPLETED_EVENT_ID as OXYGEN_DEPLETED_EVENT } from '../../../../src/constants/eventIds.js';

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/entities/entityManager.js').default} IEntityManager */

// Test Doubles
/** @type {jest.Mocked<ILogger>} */ let log;
/** @type {jest.Mocked<IEntityManager>} */ let em;
/** @type {{ dispatch: jest.Mock }} */ let dispatcher;
/** @type {{ evaluate: jest.Mock }} */ let jsonLogicService;

beforeEach(() => {
  log = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  em = {
    getComponentData: jest.fn(),
    hasComponent: jest.fn(),
    addComponent: jest.fn().mockResolvedValue(true),
    getEntitiesWithComponent: jest.fn().mockReturnValue([]),
  };

  dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
  jsonLogicService = { evaluate: jest.fn() };
});

afterEach(() => jest.clearAllMocks());

describe('DepleteOxygenHandler', () => {
  // Constructor Tests
  describe('constructor', () => {
    test('creates an instance when dependencies are valid', () => {
      const handler = new DepleteOxygenHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      expect(handler).toBeInstanceOf(DepleteOxygenHandler);
    });

    test('throws if logger is missing', () => {
      expect(
        () =>
          new DepleteOxygenHandler({
            entityManager: em,
            safeEventDispatcher: dispatcher,
            jsonLogicService,
          })
      ).toThrow(/logger/i);
    });

    test('throws if entityManager is missing', () => {
      expect(
        () =>
          new DepleteOxygenHandler({
            logger: log,
            safeEventDispatcher: dispatcher,
            jsonLogicService,
          })
      ).toThrow(/entityManager/i);
    });

    test('throws if safeEventDispatcher is missing', () => {
      expect(
        () =>
          new DepleteOxygenHandler({
            logger: log,
            entityManager: em,
            jsonLogicService,
          })
      ).toThrow(/safeEventDispatcher/i);
    });

    test('throws if jsonLogicService is missing', () => {
      expect(
        () =>
          new DepleteOxygenHandler({
            logger: log,
            entityManager: em,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/jsonLogicService/i);
    });
  });

  // Execute Tests - Parameter Validation
  describe('execute - parameter validation', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new DepleteOxygenHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
    });

    test('dispatches error when params is null', async () => {
      await handler.execute(null, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('params'),
        })
      );
    });

    test('dispatches error when params is not an object', async () => {
      await handler.execute('invalid', executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('params'),
        })
      );
    });

    test('dispatches error when entityId is missing', async () => {
      await handler.execute({}, executionContext);

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('entityId'),
        })
      );
    });

    test('dispatches error when amount is invalid (non-positive)', async () => {
      await handler.execute(
        { entityId: 'entity1', amount: 0 },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('amount'),
        })
      );
    });

    test('dispatches error when amount is negative', async () => {
      await handler.execute(
        { entityId: 'entity1', amount: -5 },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('amount'),
        })
      );
    });
  });

  // Execute Tests - No Respiratory Organs
  describe('execute - graceful handling of no respiratory organs', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new DepleteOxygenHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
    });

    test('logs debug and returns when entity has no respiratory organs', async () => {
      em.getEntitiesWithComponent.mockReturnValue([]);

      await handler.execute({ entityId: 'entity1' }, executionContext);

      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('no respiratory organs')
      );
      expect(em.addComponent).not.toHaveBeenCalled();
      expect(dispatcher.dispatch).not.toHaveBeenCalledWith(
        OXYGEN_DEPLETED_EVENT,
        expect.anything()
      );
    });

    test('skips organs that do not belong to target entity', async () => {
      // Organ belongs to different entity
      em.getEntitiesWithComponent.mockReturnValue([{ id: 'lung1' }]);
      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_COMPONENT_ID;
      });
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'otherEntity' }; // Different entity
        }
        return null;
      });

      await handler.execute({ entityId: 'entity1' }, executionContext);

      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('no respiratory organs')
      );
      expect(em.addComponent).not.toHaveBeenCalled();
    });
  });

  // Execute Tests - Oxygen Depletion
  describe('execute - oxygen depletion', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new DepleteOxygenHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
    });

    test('depletes oxygen by specified amount', async () => {
      const organData = {
        currentOxygen: 100,
        oxygenCapacity: 100,
        depletionRate: 5,
      };

      em.getEntitiesWithComponent.mockReturnValue([{ id: 'lung1' }]);
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'entity1' };
        }
        if (componentId === RESPIRATORY_ORGAN_COMPONENT_ID) {
          return organData;
        }
        return null;
      });

      await handler.execute(
        { entityId: 'entity1', amount: 20 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'lung1',
        RESPIRATORY_ORGAN_COMPONENT_ID,
        expect.objectContaining({
          currentOxygen: 80,
        })
      );
    });

    test('uses depletionRate when amount is not specified', async () => {
      const organData = {
        currentOxygen: 100,
        oxygenCapacity: 100,
        depletionRate: 10,
      };

      em.getEntitiesWithComponent.mockReturnValue([{ id: 'lung1' }]);
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'entity1' };
        }
        if (componentId === RESPIRATORY_ORGAN_COMPONENT_ID) {
          return organData;
        }
        return null;
      });

      await handler.execute({ entityId: 'entity1' }, executionContext);

      expect(em.addComponent).toHaveBeenCalledWith(
        'lung1',
        RESPIRATORY_ORGAN_COMPONENT_ID,
        expect.objectContaining({
          currentOxygen: 90, // 100 - 10 (depletionRate)
        })
      );
    });

    test('clamps oxygen to 0 minimum', async () => {
      const organData = {
        currentOxygen: 10,
        oxygenCapacity: 100,
        depletionRate: 5,
      };

      em.getEntitiesWithComponent.mockReturnValue([{ id: 'lung1' }]);
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'entity1' };
        }
        if (componentId === RESPIRATORY_ORGAN_COMPONENT_ID) {
          return organData;
        }
        return null;
      });

      await handler.execute(
        { entityId: 'entity1', amount: 50 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'lung1',
        RESPIRATORY_ORGAN_COMPONENT_ID,
        expect.objectContaining({
          currentOxygen: 0, // Clamped to 0
        })
      );
    });

    test('handles multiple respiratory organs', async () => {
      em.getEntitiesWithComponent.mockReturnValue([
        { id: 'lung1' },
        { id: 'lung2' },
      ]);
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'entity1' };
        }
        if (componentId === RESPIRATORY_ORGAN_COMPONENT_ID) {
          if (entityId === 'lung1') {
            return {
              currentOxygen: 100,
              oxygenCapacity: 100,
              depletionRate: 5,
            };
          }
          if (entityId === 'lung2') {
            return {
              currentOxygen: 80,
              oxygenCapacity: 100,
              depletionRate: 5,
            };
          }
        }
        return null;
      });

      await handler.execute(
        { entityId: 'entity1', amount: 10 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledTimes(2);
      expect(em.addComponent).toHaveBeenCalledWith(
        'lung1',
        RESPIRATORY_ORGAN_COMPONENT_ID,
        expect.objectContaining({ currentOxygen: 90 })
      );
      expect(em.addComponent).toHaveBeenCalledWith(
        'lung2',
        RESPIRATORY_ORGAN_COMPONENT_ID,
        expect.objectContaining({ currentOxygen: 70 })
      );
    });
  });

  // Execute Tests - Oxygen Depleted Event
  describe('execute - oxygen depleted event', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new DepleteOxygenHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
    });

    test('dispatches oxygen_depleted event when total oxygen reaches zero', async () => {
      const organData = {
        currentOxygen: 5,
        oxygenCapacity: 100,
        depletionRate: 5,
      };

      em.getEntitiesWithComponent.mockReturnValue([{ id: 'lung1' }]);
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'entity1' };
        }
        if (componentId === RESPIRATORY_ORGAN_COMPONENT_ID) {
          return organData;
        }
        return null;
      });

      await handler.execute(
        { entityId: 'entity1', amount: 10 },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        OXYGEN_DEPLETED_EVENT,
        expect.objectContaining({
          entityId: 'entity1',
          organCount: 1,
          timestamp: expect.any(Number),
        })
      );
    });

    test('does not dispatch oxygen_depleted event when oxygen remains', async () => {
      const organData = {
        currentOxygen: 100,
        oxygenCapacity: 100,
        depletionRate: 5,
      };

      em.getEntitiesWithComponent.mockReturnValue([{ id: 'lung1' }]);
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'entity1' };
        }
        if (componentId === RESPIRATORY_ORGAN_COMPONENT_ID) {
          return organData;
        }
        return null;
      });

      await handler.execute(
        { entityId: 'entity1', amount: 10 },
        executionContext
      );

      expect(dispatcher.dispatch).not.toHaveBeenCalledWith(
        OXYGEN_DEPLETED_EVENT,
        expect.anything()
      );
    });

    test('dispatches oxygen_depleted only when ALL organs are depleted', async () => {
      em.getEntitiesWithComponent.mockReturnValue([
        { id: 'lung1' },
        { id: 'lung2' },
      ]);
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'entity1' };
        }
        if (componentId === RESPIRATORY_ORGAN_COMPONENT_ID) {
          if (entityId === 'lung1') {
            return { currentOxygen: 5, oxygenCapacity: 100, depletionRate: 5 };
          }
          if (entityId === 'lung2') {
            return { currentOxygen: 50, oxygenCapacity: 100, depletionRate: 5 };
          }
        }
        return null;
      });

      await handler.execute(
        { entityId: 'entity1', amount: 10 },
        executionContext
      );

      // lung1 goes to 0, lung2 goes to 40 - total is 40, not depleted
      expect(dispatcher.dispatch).not.toHaveBeenCalledWith(
        OXYGEN_DEPLETED_EVENT,
        expect.anything()
      );
    });

    test('dispatches oxygen_depleted when all multiple organs reach zero', async () => {
      em.getEntitiesWithComponent.mockReturnValue([
        { id: 'lung1' },
        { id: 'lung2' },
      ]);
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'entity1' };
        }
        if (componentId === RESPIRATORY_ORGAN_COMPONENT_ID) {
          if (entityId === 'lung1') {
            return { currentOxygen: 5, oxygenCapacity: 100, depletionRate: 5 };
          }
          if (entityId === 'lung2') {
            return { currentOxygen: 3, oxygenCapacity: 100, depletionRate: 5 };
          }
        }
        return null;
      });

      await handler.execute(
        { entityId: 'entity1', amount: 10 },
        executionContext
      );

      // Both lungs go to 0, total is 0
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        OXYGEN_DEPLETED_EVENT,
        expect.objectContaining({
          entityId: 'entity1',
          organCount: 2,
        })
      );
    });
  });

  // Execute Tests - JSON Logic Resolution
  describe('execute - JSON Logic resolution', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new DepleteOxygenHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
        actor: { id: 'actor1' },
      };
    });

    test('resolves entityId from JSON Logic expression', async () => {
      jsonLogicService.evaluate.mockReturnValue('resolvedEntity');
      em.getEntitiesWithComponent.mockReturnValue([]);

      await handler.execute(
        { entityId: { var: 'target' } },
        executionContext
      );

      expect(jsonLogicService.evaluate).toHaveBeenCalledWith(
        { var: 'target' },
        executionContext
      );
      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('resolvedEntity')
      );
    });

    test('resolves amount from JSON Logic expression', async () => {
      jsonLogicService.evaluate.mockImplementation((expr) => {
        if (expr && expr.var === 'depleteAmount') {
          return 15;
        }
        return null;
      });

      const organData = {
        currentOxygen: 100,
        oxygenCapacity: 100,
        depletionRate: 5,
      };

      em.getEntitiesWithComponent.mockReturnValue([{ id: 'lung1' }]);
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'entity1' };
        }
        if (componentId === RESPIRATORY_ORGAN_COMPONENT_ID) {
          return organData;
        }
        return null;
      });

      await handler.execute(
        { entityId: 'entity1', amount: { var: 'depleteAmount' } },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'lung1',
        RESPIRATORY_ORGAN_COMPONENT_ID,
        expect.objectContaining({
          currentOxygen: 85, // 100 - 15
        })
      );
    });

    test('resolves entityId from actor keyword', async () => {
      em.getEntitiesWithComponent.mockReturnValue([]);

      const contextWithActor = {
        evaluationContext: { actor: { id: 'actorEntity' } },
        logger: log,
      };

      await handler.execute({ entityId: 'actor' }, contextWithActor);

      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('actorEntity')
      );
    });
  });

  // Execute Tests - JSON Logic Advanced Resolution
  describe('execute - JSON Logic advanced resolution', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new DepleteOxygenHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
    });

    test('resolves entityId from JSON Logic returning object with id property', async () => {
      // Setup: JSON Logic returns an object with `id` property
      jsonLogicService.evaluate.mockReturnValue({ id: 'resolvedEntityId' });
      em.getEntitiesWithComponent.mockReturnValue([]);

      await handler.execute(
        { entityId: { var: 'someExpression' } },
        executionContext
      );

      expect(jsonLogicService.evaluate).toHaveBeenCalledWith(
        { var: 'someExpression' },
        executionContext
      );
      // Should resolve and log debug about no organs (proving it resolved)
      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('resolvedEntityId')
      );
    });

    test('resolves entityId from JSON Logic returning object with entityId property', async () => {
      // Setup: JSON Logic returns an object with `entityId` property
      jsonLogicService.evaluate.mockReturnValue({ entityId: 'anotherEntityId' });
      em.getEntitiesWithComponent.mockReturnValue([]);

      await handler.execute(
        { entityId: { var: 'anotherExpression' } },
        executionContext
      );

      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('anotherEntityId')
      );
    });

    test('dispatches error when JSON Logic entityId returns object without valid id', async () => {
      // Setup: JSON Logic returns an object without id/entityId properties
      jsonLogicService.evaluate.mockReturnValue({ name: 'something' });

      await handler.execute(
        { entityId: { var: 'invalidExpression' } },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('entityId'),
        })
      );
    });

    test('dispatches error when JSON Logic entityId returns object with empty string id', async () => {
      // Setup: JSON Logic returns object with empty string id
      jsonLogicService.evaluate.mockReturnValue({ id: '   ' });

      await handler.execute(
        { entityId: { var: 'emptyIdExpression' } },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('entityId'),
        })
      );
    });

    test('logs warning when JSON Logic entityId evaluation throws error', async () => {
      // Setup: JSON Logic throws during entityId evaluation
      jsonLogicService.evaluate.mockImplementation(() => {
        throw new Error('JSON Logic evaluation failed');
      });

      await handler.execute(
        { entityId: { var: 'badExpression' } },
        executionContext
      );

      expect(log.warn).toHaveBeenCalledWith(
        'DEPLETE_OXYGEN: Failed to evaluate entityId',
        expect.objectContaining({
          error: 'JSON Logic evaluation failed',
        })
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('entityId'),
        })
      );
    });

    test('logs warning when JSON Logic amount evaluation throws error', async () => {
      // Setup: JSON Logic throws during amount evaluation
      jsonLogicService.evaluate.mockImplementation((expr) => {
        if (expr && expr.var === 'badAmountExpr') {
          throw new Error('Amount evaluation failed');
        }
        return null;
      });

      await handler.execute(
        { entityId: 'entity1', amount: { var: 'badAmountExpr' } },
        executionContext
      );

      expect(log.warn).toHaveBeenCalledWith(
        'DEPLETE_OXYGEN: Failed to evaluate amount',
        expect.objectContaining({
          error: 'Amount evaluation failed',
        })
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('amount'),
        })
      );
    });

    test('dispatches error when JSON Logic amount returns non-number value', async () => {
      // Setup: JSON Logic returns a string for amount
      jsonLogicService.evaluate.mockImplementation((expr) => {
        if (expr && expr.var === 'stringAmount') {
          return 'not-a-number';
        }
        return null;
      });

      await handler.execute(
        { entityId: 'entity1', amount: { var: 'stringAmount' } },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('amount'),
        })
      );
    });

    test('dispatches error when JSON Logic amount returns null', async () => {
      // Setup: JSON Logic returns null for amount (not undefined)
      jsonLogicService.evaluate.mockImplementation((expr) => {
        if (expr && expr.var === 'nullAmount') {
          return null;
        }
        return null;
      });

      await handler.execute(
        { entityId: 'entity1', amount: { var: 'nullAmount' } },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('amount'),
        })
      );
    });

    test('falls through when JSON Logic entityId returns a number', async () => {
      // Setup: JSON Logic returns a number (not string or object with id)
      jsonLogicService.evaluate.mockReturnValue(12345);

      await handler.execute(
        { entityId: { var: 'numericExpression' } },
        executionContext
      );

      // Should fail entityId validation since number is not valid
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('entityId'),
        })
      );
    });

    test('skips invalid amount when amount is a string directly', async () => {
      // Setup: amount is a non-object, non-number primitive (string)
      // This tests the branch where amount is not undefined/null, not a number, and not an object
      await handler.execute(
        { entityId: 'entity1', amount: 'invalid-amount' },
        executionContext
      );

      // String amount is not a valid type, should fail validation
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('amount'),
        })
      );
    });
  });

  // Execute Tests - Respiratory Organ Edge Cases
  describe('execute - respiratory organ edge cases', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new DepleteOxygenHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
    });

    test('skips organs without anatomy:part component', async () => {
      // Setup: Organ exists but doesn't have PART_COMPONENT_ID
      em.getEntitiesWithComponent.mockReturnValue([{ id: 'lung1' }]);
      em.hasComponent.mockReturnValue(false); // No part component

      await handler.execute({ entityId: 'entity1' }, executionContext);

      // Should log "no respiratory organs" since the organ was skipped
      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('no respiratory organs')
      );
      expect(em.addComponent).not.toHaveBeenCalled();
    });

    test('skips organs with part component but null organData', async () => {
      // Setup: Organ has part component pointing to target, but getComponentData returns null for respiratory_organ
      em.getEntitiesWithComponent.mockReturnValue([{ id: 'lung1' }]);
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'entity1' };
        }
        if (componentId === RESPIRATORY_ORGAN_COMPONENT_ID) {
          return null; // No organ data
        }
        return null;
      });

      await handler.execute({ entityId: 'entity1' }, executionContext);

      // Should log "no respiratory organs" since the organ was skipped (no organData)
      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('no respiratory organs')
      );
      expect(em.addComponent).not.toHaveBeenCalled();
    });

    test('handles organ with missing oxygenCapacity (defaults to 0)', async () => {
      const organData = {
        currentOxygen: 100,
        depletionRate: 5,
        // oxygenCapacity is missing - should default to 0
      };

      em.getEntitiesWithComponent.mockReturnValue([{ id: 'lung1' }]);
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'entity1' };
        }
        if (componentId === RESPIRATORY_ORGAN_COMPONENT_ID) {
          return organData;
        }
        return null;
      });

      await handler.execute(
        { entityId: 'entity1', amount: 10 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'lung1',
        RESPIRATORY_ORGAN_COMPONENT_ID,
        expect.objectContaining({
          currentOxygen: 90,
        })
      );

      // depletionResults in any event should have oxygenCapacity: 0 (the default)
      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('oxygen 100 -> 90')
      );
    });
  });

  // Execute Tests - Edge Cases
  describe('execute - edge cases', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new DepleteOxygenHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
    });

    test('handles organ with zero currentOxygen', async () => {
      const organData = {
        currentOxygen: 0,
        oxygenCapacity: 100,
        depletionRate: 5,
      };

      em.getEntitiesWithComponent.mockReturnValue([{ id: 'lung1' }]);
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'entity1' };
        }
        if (componentId === RESPIRATORY_ORGAN_COMPONENT_ID) {
          return organData;
        }
        return null;
      });

      await handler.execute(
        { entityId: 'entity1', amount: 10 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'lung1',
        RESPIRATORY_ORGAN_COMPONENT_ID,
        expect.objectContaining({
          currentOxygen: 0, // Still 0 (clamped)
        })
      );

      // Should dispatch event since oxygen is 0
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        OXYGEN_DEPLETED_EVENT,
        expect.anything()
      );
    });

    test('handles organ with missing currentOxygen (defaults to 0)', async () => {
      const organData = {
        oxygenCapacity: 100,
        depletionRate: 5,
        // currentOxygen is missing
      };

      em.getEntitiesWithComponent.mockReturnValue([{ id: 'lung1' }]);
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'entity1' };
        }
        if (componentId === RESPIRATORY_ORGAN_COMPONENT_ID) {
          return organData;
        }
        return null;
      });

      await handler.execute(
        { entityId: 'entity1', amount: 10 },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'lung1',
        RESPIRATORY_ORGAN_COMPONENT_ID,
        expect.objectContaining({
          currentOxygen: 0, // 0 - 10 = -10 clamped to 0
        })
      );
    });

    test('handles organ with missing depletionRate (defaults to 1)', async () => {
      const organData = {
        currentOxygen: 100,
        oxygenCapacity: 100,
        // depletionRate is missing
      };

      em.getEntitiesWithComponent.mockReturnValue([{ id: 'lung1' }]);
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'entity1' };
        }
        if (componentId === RESPIRATORY_ORGAN_COMPONENT_ID) {
          return organData;
        }
        return null;
      });

      await handler.execute({ entityId: 'entity1' }, executionContext);

      expect(em.addComponent).toHaveBeenCalledWith(
        'lung1',
        RESPIRATORY_ORGAN_COMPONENT_ID,
        expect.objectContaining({
          currentOxygen: 99, // 100 - 1 (default depletionRate)
        })
      );
    });

    test('handles error during addComponent gracefully', async () => {
      const organData = {
        currentOxygen: 100,
        oxygenCapacity: 100,
        depletionRate: 5,
      };

      em.getEntitiesWithComponent.mockReturnValue([{ id: 'lung1' }]);
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'entity1' };
        }
        if (componentId === RESPIRATORY_ORGAN_COMPONENT_ID) {
          return organData;
        }
        return null;
      });
      em.addComponent.mockRejectedValue(new Error('Database error'));

      await handler.execute(
        { entityId: 'entity1', amount: 10 },
        executionContext
      );

      expect(log.error).toHaveBeenCalledWith(
        'DEPLETE_OXYGEN operation failed',
        expect.any(Error),
        expect.objectContaining({ targetEntityId: 'entity1' })
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('Database error'),
        })
      );
    });

    test('includes depletionResults in oxygen_depleted event', async () => {
      const organData = {
        currentOxygen: 5,
        oxygenCapacity: 100,
        depletionRate: 5,
      };

      em.getEntitiesWithComponent.mockReturnValue([{ id: 'lung1' }]);
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'entity1' };
        }
        if (componentId === RESPIRATORY_ORGAN_COMPONENT_ID) {
          return organData;
        }
        return null;
      });

      await handler.execute(
        { entityId: 'entity1', amount: 10 },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        OXYGEN_DEPLETED_EVENT,
        expect.objectContaining({
          depletionResults: expect.arrayContaining([
            expect.objectContaining({
              organEntityId: 'lung1',
              previousOxygen: 5,
              newOxygen: 0,
              depleteAmount: 10,
              oxygenCapacity: 100,
            }),
          ]),
        })
      );
    });
  });
});
