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

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/entities/entityManager.js').default} IEntityManager */

const RESPIRATORY_ORGAN_COMPONENT_ID = 'breathing-states:respiratory_organ';
const PART_COMPONENT_ID = 'anatomy:part';
const OXYGEN_DEPLETED_EVENT = 'breathing-states:oxygen_depleted';

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
