/**
 * @jest-environment node
 */
/**
 * @file Tests the behavior of ApplyDamageHandler
 * @see src/logic/operationHandlers/applyDamageHandler.js
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import ApplyDamageHandler from '../../../../src/logic/operationHandlers/applyDamageHandler.js';

/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../../src/entities/entityManager.js').default} IEntityManager */

const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';
const BODY_COMPONENT_ID = 'anatomy:body';
const DAMAGE_APPLIED_EVENT = 'anatomy:damage_applied';
const PART_HEALTH_CHANGED_EVENT = 'anatomy:part_health_changed';
const PART_DESTROYED_EVENT = 'anatomy:part_destroyed';

// Test Doubles
/** @type {jest.Mocked<ILogger>} */ let log;
/** @type {jest.Mocked<IEntityManager>} */ let em;
/** @type {{ dispatch: jest.Mock }} */ let dispatcher;
/** @type {{ evaluate: jest.Mock }} */ let jsonLogicService;
/** @type {{ getAllParts: jest.Mock }} */ let bodyGraphService;

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
    addComponent: jest.fn(),
  };

  dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
  jsonLogicService = { evaluate: jest.fn() };
  bodyGraphService = { getAllParts: jest.fn() };
});

afterEach(() => jest.clearAllMocks());

describe('ApplyDamageHandler', () => {
  describe('constructor', () => {
    test('creates an instance when dependencies are valid', () => {
      const handler = new ApplyDamageHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
        bodyGraphService
      });
      expect(handler).toBeInstanceOf(ApplyDamageHandler);
    });

    test('throws if bodyGraphService is missing', () => {
        expect(
          () =>
            new ApplyDamageHandler({
              logger: log,
              entityManager: em,
              safeEventDispatcher: dispatcher,
              jsonLogicService
            })
        ).toThrow(/bodyGraphService/i);
      });
  });

  describe('execute', () => {
    let handler;
    let executionContext;

    beforeEach(() => {
      handler = new ApplyDamageHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
        bodyGraphService
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
      em.addComponent.mockResolvedValue(true);
    });

    test('applies damage to specified part', async () => {
        const params = {
            entity_ref: 'entity1',
            part_ref: 'part1',
            amount: 20,
            damage_type: 'blunt'
        };

        const healthComponent = {
            currentHealth: 100,
            maxHealth: 100,
            state: 'healthy',
            turnsInState: 0
        };

        em.hasComponent.mockImplementation((id, comp) => comp === PART_HEALTH_COMPONENT_ID);
        em.getComponentData.mockReturnValue(healthComponent);

        await handler.execute(params, executionContext);

        expect(dispatcher.dispatch).toHaveBeenCalledWith(DAMAGE_APPLIED_EVENT, expect.objectContaining({
            entityId: 'entity1',
            partId: 'part1',
            amount: 20,
            damageType: 'blunt'
        }));

        expect(em.addComponent).toHaveBeenCalledWith('part1', PART_HEALTH_COMPONENT_ID, expect.objectContaining({
            currentHealth: 80,
            state: 'healthy'
        }));

        expect(dispatcher.dispatch).toHaveBeenCalledWith(PART_HEALTH_CHANGED_EVENT, expect.objectContaining({
            partEntityId: 'part1',
            newHealth: 80
        }));
    });

    test('updates status correctly when crossing thresholds (e.g., Wounded)', async () => {
        const params = {
            entity_ref: 'entity1',
            part_ref: 'part1',
            amount: 60,
            damage_type: 'slash'
        };

        const healthComponent = {
            currentHealth: 100,
            maxHealth: 100,
            state: 'healthy',
            turnsInState: 5
        };

        em.hasComponent.mockImplementation((id, comp) => comp === PART_HEALTH_COMPONENT_ID);
        em.getComponentData.mockReturnValue(healthComponent);

        await handler.execute(params, executionContext);

        expect(em.addComponent).toHaveBeenCalledWith('part1', PART_HEALTH_COMPONENT_ID, expect.objectContaining({
            currentHealth: 40,
            state: 'wounded',
            turnsInState: 0 // State changed, so reset
        }));
    });

    test('auto-resolves part if part_ref missing', async () => {
        const params = {
            entity_ref: 'entity1',
            amount: 20,
            damage_type: 'blunt'
        };

        em.hasComponent.mockImplementation((id, comp) => {
            if (id === 'entity1' && comp === BODY_COMPONENT_ID) return true;
            if (id === 'part1' && comp === PART_HEALTH_COMPONENT_ID) return true;
            if (id === 'part1' && comp === PART_COMPONENT_ID) return true;
            return false;
        });
        
        em.getComponentData.mockImplementation((id, comp) => {
            if (id === 'entity1' && comp === BODY_COMPONENT_ID) return { bodyId: 'body1' };
            if (id === 'part1' && comp === PART_HEALTH_COMPONENT_ID) return { currentHealth: 100, maxHealth: 100, state: 'healthy' };
            if (id === 'part1' && comp === PART_COMPONENT_ID) return { hit_probability_weight: 10 };
            return null;
        });

        bodyGraphService.getAllParts.mockReturnValue(['part1']);

        await handler.execute(params, executionContext);

        expect(dispatcher.dispatch).toHaveBeenCalledWith(DAMAGE_APPLIED_EVENT, expect.objectContaining({
            partId: 'part1'
        }));
    });

    test('dispatches destroyed event when health reaches 0', async () => {
        const params = {
            entity_ref: 'entity1',
            part_ref: 'part1',
            amount: 100,
            damage_type: 'fire'
        };

        const healthComponent = {
            currentHealth: 50,
            maxHealth: 100,
            state: 'wounded',
            turnsInState: 0
        };

        em.hasComponent.mockImplementation((id, comp) => comp === PART_HEALTH_COMPONENT_ID);
        em.getComponentData.mockReturnValue(healthComponent);

        await handler.execute(params, executionContext);

        expect(em.addComponent).toHaveBeenCalledWith('part1', PART_HEALTH_COMPONENT_ID, expect.objectContaining({
            currentHealth: 0,
            state: 'destroyed'
        }));

        expect(dispatcher.dispatch).toHaveBeenCalledWith(PART_DESTROYED_EVENT, expect.objectContaining({
            partId: 'part1',
            entityId: 'entity1'
        }));
    });
    
    test('clamps health at 0', async () => {
        const params = {
            entity_ref: 'entity1',
            part_ref: 'part1',
            amount: 200,
            damage_type: 'nuke'
        };

        const healthComponent = {
            currentHealth: 50,
            maxHealth: 100,
            state: 'wounded',
            turnsInState: 0
        };

        em.hasComponent.mockImplementation((id, comp) => comp === PART_HEALTH_COMPONENT_ID);
        em.getComponentData.mockReturnValue(healthComponent);

        await handler.execute(params, executionContext);

        expect(em.addComponent).toHaveBeenCalledWith('part1', PART_HEALTH_COMPONENT_ID, expect.objectContaining({
            currentHealth: 0
        }));
    });

    test('fails gracefully if entity has no body and no part_ref', async () => {
        const params = {
            entity_ref: 'entity1',
            amount: 10,
            damage_type: 'poke'
        };

        em.hasComponent.mockReturnValue(false); // No body

        await handler.execute(params, executionContext);

        expect(dispatcher.dispatch).toHaveBeenCalledWith('core:system_error_occurred', expect.anything());
    });
  });
});
