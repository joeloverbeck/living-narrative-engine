/**
 * @jest-environment node
 */
/**
 * @file Tests the behavior of RestoreOxygenHandler
 * @see src/logic/operationHandlers/restoreOxygenHandler.js
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import RestoreOxygenHandler from '../../../../src/logic/operationHandlers/restoreOxygenHandler.js';
import {
  RESPIRATORY_ORGAN_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID as PART_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

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

describe('RestoreOxygenHandler', () => {
  // Constructor Tests
  describe('constructor', () => {
    test('creates an instance when dependencies are valid', () => {
      const handler = new RestoreOxygenHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
      });
      expect(handler).toBeInstanceOf(RestoreOxygenHandler);
    });

    test('throws if logger is missing', () => {
      expect(
        () =>
          new RestoreOxygenHandler({
            entityManager: em,
            safeEventDispatcher: dispatcher,
            jsonLogicService,
          })
      ).toThrow(/logger/i);
    });

    test('throws if entityManager is missing', () => {
      expect(
        () =>
          new RestoreOxygenHandler({
            logger: log,
            safeEventDispatcher: dispatcher,
            jsonLogicService,
          })
      ).toThrow(/entityManager/i);
    });

    test('throws if safeEventDispatcher is missing', () => {
      expect(
        () =>
          new RestoreOxygenHandler({
            logger: log,
            entityManager: em,
            jsonLogicService,
          })
      ).toThrow(/safeEventDispatcher/i);
    });

    test('throws if jsonLogicService is missing', () => {
      expect(
        () =>
          new RestoreOxygenHandler({
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
      handler = new RestoreOxygenHandler({
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

    test('dispatches error when restoreFull is invalid', async () => {
      await handler.execute(
        { entityId: 'entity1', restoreFull: 'yes' },
        executionContext
      );

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: expect.stringContaining('restoreFull'),
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
      handler = new RestoreOxygenHandler({
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
    });

    test('skips organs that do not belong to target entity', async () => {
      em.getEntitiesWithComponent.mockReturnValue([{ id: 'lung1' }]);
      em.hasComponent.mockImplementation((entityId, componentId) => {
        return componentId === PART_COMPONENT_ID;
      });
      em.getComponentData.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { ownerEntityId: 'otherEntity' };
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

  // Execute Tests - Oxygen Restoration
  describe('execute - oxygen restoration', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new RestoreOxygenHandler({
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

    test('restores oxygen to full capacity when restoreFull is true', async () => {
      const organData = {
        currentOxygen: 10,
        oxygenCapacity: 100,
        restorationRate: 5,
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
        { entityId: 'entity1', restoreFull: true },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'lung1',
        RESPIRATORY_ORGAN_COMPONENT_ID,
        expect.objectContaining({
          currentOxygen: 100,
        })
      );
    });

    test('restores oxygen by specified amount', async () => {
      const organData = {
        currentOxygen: 40,
        oxygenCapacity: 100,
        restorationRate: 5,
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
          currentOxygen: 60,
        })
      );
    });

    test('clamps oxygen to capacity when restoring by amount', async () => {
      const organData = {
        currentOxygen: 90,
        oxygenCapacity: 100,
        restorationRate: 5,
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
          currentOxygen: 100,
        })
      );
    });

    test('uses restorationRate when amount is not specified', async () => {
      const organData = {
        currentOxygen: 10,
        oxygenCapacity: 50,
        restorationRate: 8,
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
          currentOxygen: 18,
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
              currentOxygen: 10,
              oxygenCapacity: 100,
              restorationRate: 5,
            };
          }
          if (entityId === 'lung2') {
            return {
              currentOxygen: 20,
              oxygenCapacity: 80,
              restorationRate: 5,
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
        expect.objectContaining({ currentOxygen: 20 })
      );
      expect(em.addComponent).toHaveBeenCalledWith(
        'lung2',
        RESPIRATORY_ORGAN_COMPONENT_ID,
        expect.objectContaining({ currentOxygen: 30 })
      );
    });
  });

  // Execute Tests - JSON Logic Resolution
  describe('execute - JSON Logic resolution', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new RestoreOxygenHandler({
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
        if (expr && expr.var === 'restoreAmount') {
          return 15;
        }
        return null;
      });

      const organData = {
        currentOxygen: 50,
        oxygenCapacity: 100,
        restorationRate: 5,
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
        { entityId: 'entity1', amount: { var: 'restoreAmount' } },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'lung1',
        RESPIRATORY_ORGAN_COMPONENT_ID,
        expect.objectContaining({
          currentOxygen: 65,
        })
      );
    });

    test('resolves restoreFull from JSON Logic expression', async () => {
      jsonLogicService.evaluate.mockImplementation((expr) => {
        if (expr && expr.var === 'restoreFull') {
          return true;
        }
        return null;
      });

      const organData = {
        currentOxygen: 10,
        oxygenCapacity: 100,
        restorationRate: 5,
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
        { entityId: 'entity1', restoreFull: { var: 'restoreFull' } },
        executionContext
      );

      expect(em.addComponent).toHaveBeenCalledWith(
        'lung1',
        RESPIRATORY_ORGAN_COMPONENT_ID,
        expect.objectContaining({
          currentOxygen: 100,
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
      handler = new RestoreOxygenHandler({
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

    test('handles organ with missing restorationRate (defaults to 1)', async () => {
      const organData = {
        currentOxygen: 10,
        oxygenCapacity: 100,
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
          currentOxygen: 11,
        })
      );
    });

    test('handles error during addComponent gracefully', async () => {
      const organData = {
        currentOxygen: 10,
        oxygenCapacity: 100,
        restorationRate: 5,
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
        'RESTORE_OXYGEN operation failed',
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
  });
});
