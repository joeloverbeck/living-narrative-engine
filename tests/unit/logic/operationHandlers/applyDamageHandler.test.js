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
import { calculateStateFromPercentage } from '../../../../src/anatomy/registries/healthStateRegistry.js';

jest.mock('../../../../src/anatomy/registries/healthStateRegistry.js', () => {
  const original = jest.requireActual(
    '../../../../src/anatomy/registries/healthStateRegistry.js'
  );
  return {
    ...original,
    calculateStateFromPercentage: jest.fn(
      original.calculateStateFromPercentage
    ),
  };
});

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
/** @type {{ applyEffectsForDamage: jest.Mock }} */ let damageTypeEffectsService;
/** @type {{ propagateDamage: jest.Mock }} */ let damagePropagationService;
/** @type {{ checkDeathConditions: jest.Mock }} */ let deathCheckService;

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
  damageTypeEffectsService = { applyEffectsForDamage: jest.fn() };
  damagePropagationService = { propagateDamage: jest.fn().mockReturnValue([]) };
  deathCheckService = {
    checkDeathConditions: jest.fn().mockReturnValue({
      isDead: false,
      isDying: false,
      deathInfo: null,
    }),
  };
});

afterEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

describe('ApplyDamageHandler', () => {
  describe('constructor', () => {
    test('creates an instance when dependencies are valid', () => {
      const handler = new ApplyDamageHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        jsonLogicService,
        bodyGraphService,
        damageTypeEffectsService,
        damagePropagationService,
        deathCheckService
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
              jsonLogicService,
              damageTypeEffectsService,
              damagePropagationService,
              deathCheckService
            })
        ).toThrow(/bodyGraphService/i);
      });

    test('throws if damageTypeEffectsService is missing', () => {
        expect(
          () =>
            new ApplyDamageHandler({
              logger: log,
              entityManager: em,
              safeEventDispatcher: dispatcher,
              jsonLogicService,
              bodyGraphService,
              damagePropagationService,
              deathCheckService
            })
        ).toThrow(/damageTypeEffectsService/i);
      });

    test('throws if damagePropagationService is missing', () => {
        expect(
          () =>
            new ApplyDamageHandler({
              logger: log,
              entityManager: em,
              safeEventDispatcher: dispatcher,
              jsonLogicService,
              bodyGraphService,
              damageTypeEffectsService,
              deathCheckService
            })
        ).toThrow(/damagePropagationService/i);
      });

    test('throws if deathCheckService is missing', () => {
        expect(
          () =>
            new ApplyDamageHandler({
              logger: log,
              entityManager: em,
              safeEventDispatcher: dispatcher,
              jsonLogicService,
              bodyGraphService,
              damageTypeEffectsService,
              damagePropagationService
            })
        ).toThrow(/deathCheckService/i);
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
        bodyGraphService,
        damageTypeEffectsService,
        damagePropagationService,
        deathCheckService
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
      em.addComponent.mockResolvedValue(true);
    });

    describe('propagation', () => {
      test('propagates damage to child when service returns results', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'parent',
          amount: 20,
          damage_type: 'piercing'
        };

        const components = {
          parent: {
            [PART_COMPONENT_ID]: {
              subType: 'torso',
              ownerEntityId: 'entity1',
              damage_propagation: {
                child: { probability: 1, damage_fraction: 0.5 }
              }
            },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 100,
              maxHealth: 100,
              state: 'healthy',
              turnsInState: 0
            }
          },
          child: {
            [PART_COMPONENT_ID]: { subType: 'heart', ownerEntityId: 'entity1' },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 40,
              maxHealth: 40,
              state: 'healthy',
              turnsInState: 0
            }
          }
        };

        em.hasComponent.mockImplementation((id, comp) => Boolean(components[id]?.[comp]));
        em.getComponentData.mockImplementation((id, comp) => components[id]?.[comp] || null);

        // Mock the service to return propagation result on first call, then empty array
        // to prevent infinite recursion (child has no further propagation)
        damagePropagationService.propagateDamage
          .mockReturnValueOnce([{ childPartId: 'child', damageApplied: 10, damageTypeId: 'piercing' }])
          .mockReturnValue([]);

        await handler.execute(params, executionContext);

        expect(em.addComponent).toHaveBeenCalledWith(
          'parent',
          PART_HEALTH_COMPONENT_ID,
          expect.objectContaining({ currentHealth: 80 })
        );
        expect(em.addComponent).toHaveBeenCalledWith(
          'child',
          PART_HEALTH_COMPONENT_ID,
          expect.objectContaining({ currentHealth: 30 })
        );
        expect(dispatcher.dispatch).toHaveBeenCalledWith(
          DAMAGE_APPLIED_EVENT,
          expect.objectContaining({ partId: 'child', propagatedFrom: 'parent' })
        );
      });

      test('does not propagate when service returns empty array', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'parent',
          amount: 15,
          damage_type: 'piercing'
        };

        const components = {
          parent: {
            [PART_COMPONENT_ID]: {
              subType: 'torso',
              ownerEntityId: 'entity1',
              damage_propagation: {
                child: { probability: 0, damage_fraction: 0.5 }
              }
            },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 50,
              maxHealth: 50,
              state: 'healthy',
              turnsInState: 0
            }
          },
          child: {
            [PART_COMPONENT_ID]: { subType: 'heart', ownerEntityId: 'entity1' },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 30,
              maxHealth: 30,
              state: 'healthy',
              turnsInState: 0
            }
          }
        };

        em.hasComponent.mockImplementation((id, comp) => Boolean(components[id]?.[comp]));
        em.getComponentData.mockImplementation((id, comp) => components[id]?.[comp] || null);

        // Mock the service to return empty array (no propagation)
        damagePropagationService.propagateDamage.mockReturnValue([]);

        await handler.execute(params, executionContext);

        expect(em.addComponent).toHaveBeenCalledWith(
          'parent',
          PART_HEALTH_COMPONENT_ID,
          expect.objectContaining({ currentHealth: 35 })
        );
        expect(em.addComponent).not.toHaveBeenCalledWith(
          'child',
          PART_HEALTH_COMPONENT_ID,
          expect.anything()
        );
      });

      test('calls propagation service with correct parameters', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'parent',
          amount: 10,
          damage_type: 'blunt'
        };

        const propagationRules = {
          child: { probability: 1, damage_fraction: 0.5, damage_types: ['piercing'] }
        };

        const components = {
          parent: {
            [PART_COMPONENT_ID]: {
              subType: 'torso',
              ownerEntityId: 'entity1',
              damage_propagation: propagationRules
            },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 80,
              maxHealth: 80,
              state: 'healthy',
              turnsInState: 0
            }
          }
        };

        em.hasComponent.mockImplementation((id, comp) => Boolean(components[id]?.[comp]));
        em.getComponentData.mockImplementation((id, comp) => components[id]?.[comp] || null);

        await handler.execute(params, executionContext);

        expect(damagePropagationService.propagateDamage).toHaveBeenCalledWith(
          'parent',       // parentPartId
          10,             // damageAmount
          'blunt',        // damageType
          'entity1',      // ownerEntityId
          propagationRules
        );
      });

      test('propagates multiple damage results from service', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'parent',
          amount: 20,
          damage_type: 'piercing'
        };

        const components = {
          parent: {
            [PART_COMPONENT_ID]: {
              subType: 'torso',
              ownerEntityId: 'entity1',
              damage_propagation: {}
            },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 100,
              maxHealth: 100,
              state: 'healthy',
              turnsInState: 0
            }
          },
          child1: {
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 50,
              maxHealth: 50,
              state: 'healthy',
              turnsInState: 0
            }
          },
          child2: {
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 30,
              maxHealth: 30,
              state: 'healthy',
              turnsInState: 0
            }
          }
        };

        em.hasComponent.mockImplementation((id, comp) => Boolean(components[id]?.[comp]));
        em.getComponentData.mockImplementation((id, comp) => components[id]?.[comp] || null);

        // Mock the service to return multiple propagation results on first call,
        // then empty array to prevent infinite recursion (children have no further propagation)
        damagePropagationService.propagateDamage
          .mockReturnValueOnce([
            { childPartId: 'child1', damageApplied: 10, damageTypeId: 'piercing' },
            { childPartId: 'child2', damageApplied: 5, damageTypeId: 'piercing' }
          ])
          .mockReturnValue([]);

        await handler.execute(params, executionContext);

        // Both children should receive damage
        expect(em.addComponent).toHaveBeenCalledWith(
          'child1',
          PART_HEALTH_COMPONENT_ID,
          expect.objectContaining({ currentHealth: 40 })
        );
        expect(em.addComponent).toHaveBeenCalledWith(
          'child2',
          PART_HEALTH_COMPONENT_ID,
          expect.objectContaining({ currentHealth: 25 })
        );
      });
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

        // 80% health is 'scratched' (61-80% threshold)
        expect(em.addComponent).toHaveBeenCalledWith('part1', PART_HEALTH_COMPONENT_ID, expect.objectContaining({
            currentHealth: 80,
            state: 'scratched'
        }));

        expect(dispatcher.dispatch).toHaveBeenCalledWith(PART_HEALTH_CHANGED_EVENT, expect.objectContaining({
            partEntityId: 'part1',
            newHealth: 80
        }));
    });

    test('updates status correctly when crossing thresholds (e.g., Injured)', async () => {
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

        // 40% health is 'injured' (21-40% threshold)
        expect(em.addComponent).toHaveBeenCalledWith('part1', PART_HEALTH_COMPONENT_ID, expect.objectContaining({
            currentHealth: 40,
            state: 'injured',
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

    test('auto-resolves part when hit_probability_weight is undefined (defaults to 1.0)', async () => {
        const params = {
            entity_ref: 'entity1',
            amount: 20,
            damage_type: 'slashing'
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
            // Return anatomy:part WITHOUT hit_probability_weight - mimics real entity definitions
            if (id === 'part1' && comp === PART_COMPONENT_ID) return { subType: 'torso' };
            return null;
        });

        bodyGraphService.getAllParts.mockReturnValue(['part1']);

        await handler.execute(params, executionContext);

        // Should succeed with defaulted weight of 1.0
        expect(dispatcher.dispatch).toHaveBeenCalledWith(DAMAGE_APPLIED_EVENT, expect.objectContaining({
            partId: 'part1'
        }));
    });

    test('excludes parts with explicit hit_probability_weight of 0', async () => {
        const params = {
            entity_ref: 'entity1',
            amount: 20,
            damage_type: 'slashing'
        };

        em.hasComponent.mockImplementation((id, comp) => {
            if (id === 'entity1' && comp === BODY_COMPONENT_ID) return true;
            if (id === 'part1' && comp === PART_HEALTH_COMPONENT_ID) return true;
            if (id === 'part1' && comp === PART_COMPONENT_ID) return true;
            if (id === 'part2' && comp === PART_HEALTH_COMPONENT_ID) return true;
            if (id === 'part2' && comp === PART_COMPONENT_ID) return true;
            return false;
        });

        em.getComponentData.mockImplementation((id, comp) => {
            if (id === 'entity1' && comp === BODY_COMPONENT_ID) return { bodyId: 'body1' };
            // part1 has explicit 0 weight - should be excluded
            if (id === 'part1' && comp === PART_HEALTH_COMPONENT_ID) return { currentHealth: 100, maxHealth: 100, state: 'healthy' };
            if (id === 'part1' && comp === PART_COMPONENT_ID) return { subType: 'head', hit_probability_weight: 0 };
            // part2 has undefined weight - should default to 1.0 and be selected
            if (id === 'part2' && comp === PART_HEALTH_COMPONENT_ID) return { currentHealth: 100, maxHealth: 100, state: 'healthy' };
            if (id === 'part2' && comp === PART_COMPONENT_ID) return { subType: 'torso' };
            return null;
        });

        bodyGraphService.getAllParts.mockReturnValue(['part1', 'part2']);

        await handler.execute(params, executionContext);

        // Should select part2 (the only one with positive weight)
        expect(dispatcher.dispatch).toHaveBeenCalledWith(DAMAGE_APPLIED_EVENT, expect.objectContaining({
            partId: 'part2'
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

    test('resolves dynamic values for amount and damage_type', async () => {
      const params = {
        entity_ref: 'entity1',
        part_ref: 'part1',
        amount: { '+': [10, 10] },
        damage_type: { var: 'dtype' }
      };

      const context = { dtype: 'fire' };
      const executionContextWithVars = {
        evaluationContext: { context },
        logger: log
      };

      jsonLogicService.evaluate.mockImplementation((rule) => {
        if (rule['+']) return 20;
        if (rule.var === 'dtype') return 'fire';
        return null;
      });

      em.hasComponent.mockImplementation((id, comp) => comp === PART_HEALTH_COMPONENT_ID);
      em.getComponentData.mockReturnValue({
        currentHealth: 100,
        maxHealth: 100,
        state: 'healthy'
      });

      await handler.execute(params, executionContextWithVars);

      expect(jsonLogicService.evaluate).toHaveBeenCalledTimes(2);
      expect(dispatcher.dispatch).toHaveBeenCalledWith(DAMAGE_APPLIED_EVENT, expect.objectContaining({
        amount: 20,
        damageType: 'fire'
      }));
    });

    test('resolves entity_ref via JsonLogic returning object with id', async () => {
        const params = {
            entity_ref: { var: 'target' },
            part_ref: 'part1',
            amount: 10,
            damage_type: 'blunt'
        };

        // Mock evaluating to an object { id: '...' }
        jsonLogicService.evaluate.mockReturnValue({ id: 'resolvedEntityObject' });

        em.hasComponent.mockImplementation((id, comp) => comp === PART_HEALTH_COMPONENT_ID);
        em.getComponentData.mockReturnValue({ currentHealth: 100, maxHealth: 100 });

        await handler.execute(params, executionContext);

        expect(dispatcher.dispatch).toHaveBeenCalledWith(DAMAGE_APPLIED_EVENT, expect.objectContaining({
            entityId: 'resolvedEntityObject'
        }));
    });

    test('handles resolution failure for values gracefully', async () => {
      const params = {
        entity_ref: 'entity1',
        part_ref: 'part1',
        amount: { malformed: true },
        damage_type: 'blunt'
      };

      jsonLogicService.evaluate.mockImplementation(() => {
        throw new Error('JsonLogic error');
      });

      // Should fail validation because amount becomes NaN
      await handler.execute(params, executionContext);

      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to evaluate value'), expect.anything());
      expect(dispatcher.dispatch).toHaveBeenCalledWith('core:system_error_occurred', expect.objectContaining({
          message: expect.stringContaining('Invalid amount')
      }));
    });

    test('handles resolveValue returning type mismatch', async () => {
        // amount expects number, resolve string -> becomes NaN
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          amount: { op: 'returnString' },
          damage_type: 'blunt'
        };
  
        jsonLogicService.evaluate.mockReturnValue('not a number');
  
        await handler.execute(params, executionContext);
  
        expect(dispatcher.dispatch).toHaveBeenCalledWith('core:system_error_occurred', expect.objectContaining({
            message: expect.stringContaining('Invalid amount')
        }));
    });

    test('resolves entity_ref via JsonLogic', async () => {
        const params = {
            entity_ref: { var: 'target' },
            part_ref: 'part1',
            amount: 10,
            damage_type: 'blunt'
        };

        jsonLogicService.evaluate.mockReturnValue('resolvedEntity');

        em.hasComponent.mockImplementation((id, comp) => comp === PART_HEALTH_COMPONENT_ID);
        em.getComponentData.mockReturnValue({ currentHealth: 100, maxHealth: 100 });

        await handler.execute(params, executionContext);

        expect(jsonLogicService.evaluate).toHaveBeenCalled();
        expect(dispatcher.dispatch).toHaveBeenCalledWith(DAMAGE_APPLIED_EVENT, expect.objectContaining({
            entityId: 'resolvedEntity'
        }));
    });

    test('handles missing PART_COMPONENT_ID (defaults extra event data)', async () => {
        const params = {
            entity_ref: 'entity1',
            part_ref: 'part1',
            amount: 10,
            damage_type: 'blunt'
        };

        // PART_HEALTH exists, but PART_COMPONENT does not
        em.hasComponent.mockImplementation((id, comp) => comp === PART_HEALTH_COMPONENT_ID);
        em.getComponentData.mockReturnValue({
             currentHealth: 100,
             maxHealth: 100,
             state: 'healthy'
        });

        await handler.execute(params, executionContext);

        // Check that PART_HEALTH_CHANGED_EVENT was dispatched with default values
        expect(dispatcher.dispatch).toHaveBeenCalledWith(PART_HEALTH_CHANGED_EVENT, expect.objectContaining({
            partType: 'unknown',
            ownerEntityId: null
        }));
    });

    test('skips health update but continues propagation if PART_HEALTH_COMPONENT_ID is missing', async () => {
        const params = {
            entity_ref: 'entity1',
            part_ref: 'hair',
            amount: 10,
            damage_type: 'fire'
        };

        const propagationRules = {
            scalp: { probability: 1, damage_fraction: 1 }
        };

        // Mock PART_COMPONENT to have propagation rules, but no health component
        em.hasComponent.mockImplementation((id, comp) => {
            if (comp === PART_COMPONENT_ID && id === 'hair') return true;
            // Child part has health
            if (comp === PART_HEALTH_COMPONENT_ID && id === 'scalp') return true;

            return false;
        });

        em.getComponentData.mockImplementation((id, comp) => {
            if (comp === PART_COMPONENT_ID && id === 'hair') {
                return {
                    damage_propagation: propagationRules
                };
            }
            // Child part has health
            if (comp === PART_HEALTH_COMPONENT_ID && id === 'scalp') {
                return { currentHealth: 50, maxHealth: 50, state: 'healthy' };
            }
            return null;
        });

        // Mock service to return propagation result on first call,
        // then empty array to prevent infinite recursion
        damagePropagationService.propagateDamage
            .mockReturnValueOnce([
                { childPartId: 'scalp', damageApplied: 10, damageTypeId: 'fire' }
            ])
            .mockReturnValue([]);

        await handler.execute(params, executionContext);

        // Should log debug message
        expect(log.debug).toHaveBeenCalledWith(expect.stringContaining('has no health component'));

        // Should not update 'hair' health
        expect(em.addComponent).not.toHaveBeenCalledWith('hair', PART_HEALTH_COMPONENT_ID, expect.anything());

        // Should propagate to 'scalp' (this calls execute recursively)
        expect(em.addComponent).toHaveBeenCalledWith('scalp', PART_HEALTH_COMPONENT_ID, expect.anything());
    });

    test('catches and reports errors during health update process', async () => {
        const params = {
            entity_ref: 'entity1',
            part_ref: 'part1',
            amount: 10,
            damage_type: 'blunt'
        };

        em.hasComponent.mockReturnValue(true);
        em.getComponentData.mockReturnValue({ currentHealth: 100, maxHealth: 100 });
        
        const error = new Error('Database exploded');
        em.addComponent.mockRejectedValue(error);

        await handler.execute(params, executionContext);

        expect(log.error).toHaveBeenCalledWith('APPLY_DAMAGE operation failed', error, expect.anything());
        expect(dispatcher.dispatch).toHaveBeenCalledWith('core:system_error_occurred', expect.objectContaining({
             message: expect.stringContaining('Operation failed')
        }));
    });

    test('calculates wounded and critical states correctly', async () => {
        const params = { entity_ref: 'e', part_ref: 'p', amount: 0, damage_type: 'd' };
        em.hasComponent.mockImplementation((id, comp) => comp === PART_HEALTH_COMPONENT_ID);

        // Test Wounded (41-60%)
        // Max 100, current 60 -> 60%
        em.getComponentData.mockReturnValue({ currentHealth: 60, maxHealth: 100, state: 'healthy' });
        await handler.execute({ ...params, amount: 0 }, executionContext);
        // 60% health is in the wounded range (41-60%)
        expect(em.addComponent).toHaveBeenCalledWith('p', PART_HEALTH_COMPONENT_ID, expect.objectContaining({ state: 'wounded' }));

        em.addComponent.mockClear();

        // Test Critical (1-20%)
        // Max 100, current 10 -> 10%
        em.getComponentData.mockReturnValue({ currentHealth: 10, maxHealth: 100, state: 'healthy' });
        await handler.execute({ ...params, amount: 0 }, executionContext);
        expect(em.addComponent).toHaveBeenCalledWith('p', PART_HEALTH_COMPONENT_ID, expect.objectContaining({ state: 'critical' }));
    });

    test('uses registry to calculate health state', async () => {
      const params = {
        entity_ref: 'entity1',
        part_ref: 'part1',
        amount: 20,
        damage_type: 'blunt',
      };

      const healthComponent = {
        currentHealth: 100,
        maxHealth: 100,
        state: 'healthy',
        turnsInState: 0,
      };

      em.hasComponent.mockImplementation(
        (id, comp) => comp === PART_HEALTH_COMPONENT_ID
      );
      em.getComponentData.mockReturnValue(healthComponent);

      await handler.execute(params, executionContext);

      expect(calculateStateFromPercentage).toHaveBeenCalled();
    });

    test('handles resolveRef exceptions and null returns', async () => {
        // Case 1: Exception
        const params1 = { entity_ref: { malformed: true }, amount: 10, damage_type: 'd' };
        jsonLogicService.evaluate.mockImplementationOnce(() => { throw new Error('Ref Error'); });
        await handler.execute(params1, executionContext);
        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to evaluate ref'), expect.anything());
        expect(dispatcher.dispatch).toHaveBeenCalledWith('core:system_error_occurred', expect.objectContaining({
            message: expect.stringContaining('Invalid entity_ref')
        }));

        // Case 2: Returns null/non-string
        const params2 = { entity_ref: { var: 'missing' }, amount: 10, damage_type: 'd' };
        jsonLogicService.evaluate.mockImplementationOnce(() => null);
        await handler.execute(params2, executionContext);
        expect(dispatcher.dispatch).toHaveBeenCalledWith('core:system_error_occurred', expect.objectContaining({
            message: expect.stringContaining('Invalid entity_ref')
        }));
    });

    test('applies propagation results from service correctly', async () => {
         const params = {
          entity_ref: 'entity1',
          part_ref: 'parent',
          amount: 20,
          damage_type: 'type'
        };

        // Service determines which children receive damage based on probability edge cases
        // (probability handling is tested in the service tests)
        const components = {
          parent: {
            [PART_COMPONENT_ID]: {
              subType: 'torso',
              ownerEntityId: 'entity1',
              damage_propagation: {
                child1: { probability: undefined, damage_fraction: 1 },
                child2: { probability: 1.5, damage_fraction: 1 },
                child3: { probability: -0.5, damage_fraction: 1 }
              }
            },
            [PART_HEALTH_COMPONENT_ID]: { currentHealth: 100, maxHealth: 100, state: 'healthy' }
          },
          child1: { [PART_HEALTH_COMPONENT_ID]: { currentHealth: 10, maxHealth: 10, state: 'healthy' } },
          child2: { [PART_HEALTH_COMPONENT_ID]: { currentHealth: 10, maxHealth: 10, state: 'healthy' } }
        };

        em.hasComponent.mockImplementation((id, comp) => Boolean(components[id]?.[comp]));
        em.getComponentData.mockImplementation((id, comp) => components[id]?.[comp] || null);

        // Mock service to return propagation results on first call (service handles probability logic),
        // then empty array to prevent infinite recursion
        damagePropagationService.propagateDamage
          .mockReturnValueOnce([
            { childPartId: 'child1', damageApplied: 20, damageTypeId: 'type' },
            { childPartId: 'child2', damageApplied: 20, damageTypeId: 'type' }
            // child3 not included because probability was clamped to 0
          ])
          .mockReturnValue([]);

        await handler.execute(params, executionContext);

        // child1 and child2 should be hit (service decided they should propagate)
        expect(em.addComponent).toHaveBeenCalledWith('child1', PART_HEALTH_COMPONENT_ID, expect.anything());
        expect(em.addComponent).toHaveBeenCalledWith('child2', PART_HEALTH_COMPONENT_ID, expect.anything());
    });

    describe('death condition checks', () => {
      test('should call checkDeathConditions after top-level damage is applied', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          amount: 20,
          damage_type: 'blunt'
        };

        const partComponent = {
          subType: 'torso',
          ownerEntityId: 'owner-entity-id'
        };

        const healthComponent = {
          currentHealth: 100,
          maxHealth: 100,
          state: 'healthy',
          turnsInState: 0
        };

        em.hasComponent.mockImplementation((id, comp) => {
          if (comp === PART_HEALTH_COMPONENT_ID) return true;
          if (comp === PART_COMPONENT_ID && id === 'part1') return true;
          return false;
        });
        em.getComponentData.mockImplementation((id, comp) => {
          if (comp === PART_HEALTH_COMPONENT_ID) return healthComponent;
          if (comp === PART_COMPONENT_ID && id === 'part1') return partComponent;
          return null;
        });

        await handler.execute(params, executionContext);

        expect(deathCheckService.checkDeathConditions).toHaveBeenCalledWith(
          'owner-entity-id',
          null
        );
      });

      test('should NOT call checkDeathConditions for propagated damage', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'child-part',
          amount: 10,
          damage_type: 'piercing',
          propagatedFrom: 'parent-part-id'
        };

        const healthComponent = {
          currentHealth: 50,
          maxHealth: 50,
          state: 'healthy',
          turnsInState: 0
        };

        em.hasComponent.mockImplementation((id, comp) => comp === PART_HEALTH_COMPONENT_ID);
        em.getComponentData.mockReturnValue(healthComponent);

        await handler.execute(params, executionContext);

        expect(deathCheckService.checkDeathConditions).not.toHaveBeenCalled();
      });

      test('should log death when entity dies', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          amount: 100,
          damage_type: 'fire'
        };

        const partComponent = {
          subType: 'heart',
          ownerEntityId: 'victim-entity'
        };

        const healthComponent = {
          currentHealth: 100,
          maxHealth: 100,
          state: 'healthy',
          turnsInState: 0
        };

        em.hasComponent.mockImplementation((id, comp) => {
          if (comp === PART_HEALTH_COMPONENT_ID) return true;
          if (comp === PART_COMPONENT_ID && id === 'part1') return true;
          return false;
        });
        em.getComponentData.mockImplementation((id, comp) => {
          if (comp === PART_HEALTH_COMPONENT_ID) return healthComponent;
          if (comp === PART_COMPONENT_ID && id === 'part1') return partComponent;
          return null;
        });

        deathCheckService.checkDeathConditions.mockReturnValue({
          isDead: true,
          isDying: false,
          deathInfo: { cause: 'vital_organ_destroyed' }
        });

        await handler.execute(params, executionContext);

        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('victim-entity died from damage')
        );
      });

      test('should log dying state when entity enters dying state', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          amount: 50,
          damage_type: 'blunt'
        };

        const partComponent = {
          subType: 'torso',
          ownerEntityId: 'dying-entity'
        };

        const healthComponent = {
          currentHealth: 100,
          maxHealth: 100,
          state: 'healthy',
          turnsInState: 0
        };

        em.hasComponent.mockImplementation((id, comp) => {
          if (comp === PART_HEALTH_COMPONENT_ID) return true;
          if (comp === PART_COMPONENT_ID && id === 'part1') return true;
          return false;
        });
        em.getComponentData.mockImplementation((id, comp) => {
          if (comp === PART_HEALTH_COMPONENT_ID) return healthComponent;
          if (comp === PART_COMPONENT_ID && id === 'part1') return partComponent;
          return null;
        });

        deathCheckService.checkDeathConditions.mockReturnValue({
          isDead: false,
          isDying: true,
          deathInfo: null
        });

        await handler.execute(params, executionContext);

        expect(log.info).toHaveBeenCalledWith(
          expect.stringContaining('dying-entity is now dying')
        );
      });

      test('should pass damageCauserId from executionContext.actorId', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          amount: 30,
          damage_type: 'slash'
        };

        const partComponent = {
          subType: 'arm',
          ownerEntityId: 'victim-id'
        };

        const healthComponent = {
          currentHealth: 100,
          maxHealth: 100,
          state: 'healthy',
          turnsInState: 0
        };

        const executionContextWithActor = {
          evaluationContext: { context: {} },
          logger: log,
          actorId: 'attacker-id'
        };

        em.hasComponent.mockImplementation((id, comp) => {
          if (comp === PART_HEALTH_COMPONENT_ID) return true;
          if (comp === PART_COMPONENT_ID && id === 'part1') return true;
          return false;
        });
        em.getComponentData.mockImplementation((id, comp) => {
          if (comp === PART_HEALTH_COMPONENT_ID) return healthComponent;
          if (comp === PART_COMPONENT_ID && id === 'part1') return partComponent;
          return null;
        });

        await handler.execute(params, executionContextWithActor);

        expect(deathCheckService.checkDeathConditions).toHaveBeenCalledWith(
          'victim-id',
          'attacker-id'
        );
      });
    });

    describe('damage_entry parameter (WEADAMCAPREF-005)', () => {
      test('should accept damage_entry parameter and apply damage correctly', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          damage_entry: {
            name: 'slashing',
            amount: 25
          }
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
          amount: 25,
          damageType: 'slashing'
        }));

        expect(em.addComponent).toHaveBeenCalledWith('part1', PART_HEALTH_COMPONENT_ID, expect.objectContaining({
          currentHealth: 75
        }));
      });

      test('should call DamageTypeEffectsService with damageEntry object', async () => {
        const damageEntry = {
          name: 'slashing',
          amount: 30,
          bleed: { enabled: true, severity: 'moderate' },
          dismember: { enabled: true, thresholdFraction: 0.8 }
        };

        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          damage_entry: damageEntry
        };

        const partComponent = {
          subType: 'arm',
          ownerEntityId: 'victim-entity'
        };

        const healthComponent = {
          currentHealth: 100,
          maxHealth: 100,
          state: 'healthy',
          turnsInState: 0
        };

        em.hasComponent.mockImplementation((id, comp) => {
          if (comp === PART_HEALTH_COMPONENT_ID) return true;
          if (comp === PART_COMPONENT_ID && id === 'part1') return true;
          return false;
        });
        em.getComponentData.mockImplementation((id, comp) => {
          if (comp === PART_HEALTH_COMPONENT_ID) return healthComponent;
          if (comp === PART_COMPONENT_ID && id === 'part1') return partComponent;
          return null;
        });

        await handler.execute(params, executionContext);

        expect(damageTypeEffectsService.applyEffectsForDamage).toHaveBeenCalledWith({
          entityId: 'victim-entity',
          entityName: 'Unknown',
          entityPronoun: 'they',
          partId: 'part1',
          partType: 'arm',
          orientation: null,
          damageEntry: damageEntry,
          maxHealth: 100,
          currentHealth: 70
        });
      });

      test('should apply damage multiplier when provided (damage_entry path)', async () => {
        const baseDamageEntry = {
          name: 'slashing',
          amount: 20,
          bleed: { enabled: true }
        };

        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          damage_entry: baseDamageEntry,
          damage_multiplier: 1.5
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

        expect(em.addComponent).toHaveBeenCalledWith(
          'part1',
          PART_HEALTH_COMPONENT_ID,
          expect.objectContaining({ currentHealth: 70 })
        );

        expect(damageTypeEffectsService.applyEffectsForDamage).toHaveBeenCalledWith(
          expect.objectContaining({
            damageEntry: expect.objectContaining({ amount: 30, name: 'slashing' })
          })
        );

        // Ensure original object not mutated
        expect(baseDamageEntry.amount).toBe(20);
      });

      test('should work with legacy damage_type + amount parameters (backward compatibility)', async () => {
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

        // Should still work
        expect(em.addComponent).toHaveBeenCalledWith('part1', PART_HEALTH_COMPONENT_ID, expect.objectContaining({
          currentHealth: 80
        }));

        // Should emit deprecation warning
        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('DEPRECATED'));
      });

      test('should apply damage multiplier with legacy parameters', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          amount: 10,
          damage_type: 'blunt',
          damage_multiplier: 2
        };

        const healthComponent = {
          currentHealth: 50,
          maxHealth: 50,
          state: 'healthy',
          turnsInState: 0
        };

        em.hasComponent.mockImplementation((id, comp) => comp === PART_HEALTH_COMPONENT_ID);
        em.getComponentData.mockReturnValue(healthComponent);

        await handler.execute(params, executionContext);

        expect(em.addComponent).toHaveBeenCalledWith(
          'part1',
          PART_HEALTH_COMPONENT_ID,
          expect.objectContaining({ currentHealth: 30 })
        );

        expect(damageTypeEffectsService.applyEffectsForDamage).toHaveBeenCalledWith(
          expect.objectContaining({
            damageEntry: expect.objectContaining({ amount: 20, name: 'blunt' })
          })
        );
      });

      test('should emit deprecation warning for legacy mode', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          amount: 15,
          damage_type: 'piercing'
        };

        const healthComponent = {
          currentHealth: 50,
          maxHealth: 50,
          state: 'healthy',
          turnsInState: 0
        };

        em.hasComponent.mockImplementation((id, comp) => comp === PART_HEALTH_COMPONENT_ID);
        em.getComponentData.mockReturnValue(healthComponent);

        await handler.execute(params, executionContext);

        expect(log.warn).toHaveBeenCalledWith(
          'DEPRECATED: Using damage_type + amount parameters. Migrate to damage_entry object.'
        );
      });

      test('should throw error when missing both damage_entry and legacy params', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1'
          // No damage_entry, amount, or damage_type
        };

        await handler.execute(params, executionContext);

        expect(dispatcher.dispatch).toHaveBeenCalledWith('core:system_error_occurred', expect.objectContaining({
          message: expect.stringContaining('Either damage_entry or (damage_type + amount) required')
        }));
      });

      test('should resolve JSON Logic expressions in damage_entry parameter', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          damage_entry: { var: 'context.dmgEntry' }
        };

        const resolvedDamageEntry = {
          name: 'fire',
          amount: 15,
          burn: { enabled: true, dps: 2 }
        };

        jsonLogicService.evaluate.mockReturnValue(resolvedDamageEntry);

        const healthComponent = {
          currentHealth: 100,
          maxHealth: 100,
          state: 'healthy',
          turnsInState: 0
        };

        em.hasComponent.mockImplementation((id, comp) => comp === PART_HEALTH_COMPONENT_ID);
        em.getComponentData.mockReturnValue(healthComponent);

        await handler.execute(params, executionContext);

        expect(jsonLogicService.evaluate).toHaveBeenCalledWith(
          { var: 'context.dmgEntry' },
          executionContext
        );

        expect(em.addComponent).toHaveBeenCalledWith('part1', PART_HEALTH_COMPONENT_ID, expect.objectContaining({
          currentHealth: 85
        }));

        expect(damageTypeEffectsService.applyEffectsForDamage).toHaveBeenCalledWith(
          expect.objectContaining({
            damageEntry: resolvedDamageEntry
          })
        );
      });

      test('should fail if damage_entry is missing required amount field', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          damage_entry: {
            name: 'slashing'
            // Missing amount
          }
        };

        await handler.execute(params, executionContext);

        expect(dispatcher.dispatch).toHaveBeenCalledWith('core:system_error_occurred', expect.objectContaining({
          message: expect.stringContaining('Invalid damage_entry (missing amount)')
        }));
      });

      test('should fail if damage_entry is missing required name field', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          damage_entry: {
            amount: 20
            // Missing name
          }
        };

        await handler.execute(params, executionContext);

        expect(dispatcher.dispatch).toHaveBeenCalledWith('core:system_error_occurred', expect.objectContaining({
          message: expect.stringContaining('Invalid damage_entry (missing name)')
        }));
      });

      test('should handle damage_entry with all effect configurations', async () => {
        const fullDamageEntry = {
          name: 'slashing',
          amount: 50,
          penetration: 0.3,
          bleed: { enabled: true, severity: 'severe', baseDurationTurns: 5 },
          fracture: { enabled: false },
          burn: { enabled: false },
          poison: { enabled: false },
          dismember: { enabled: true, thresholdFraction: 0.6 },
          flags: ['magical', 'cursed']
        };

        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          damage_entry: fullDamageEntry
        };

        const partComponent = {
          subType: 'torso',
          ownerEntityId: 'victim-entity'
        };

        const healthComponent = {
          currentHealth: 100,
          maxHealth: 100,
          state: 'healthy',
          turnsInState: 0
        };

        em.hasComponent.mockImplementation((id, comp) => {
          if (comp === PART_HEALTH_COMPONENT_ID) return true;
          if (comp === PART_COMPONENT_ID && id === 'part1') return true;
          return false;
        });
        em.getComponentData.mockImplementation((id, comp) => {
          if (comp === PART_HEALTH_COMPONENT_ID) return healthComponent;
          if (comp === PART_COMPONENT_ID && id === 'part1') return partComponent;
          return null;
        });

        await handler.execute(params, executionContext);

        // Full damage entry should be passed to effects service
        expect(damageTypeEffectsService.applyEffectsForDamage).toHaveBeenCalledWith({
          entityId: 'victim-entity',
          entityName: 'Unknown',
          entityPronoun: 'they',
          partId: 'part1',
          partType: 'torso',
          orientation: null,
          damageEntry: fullDamageEntry,
          maxHealth: 100,
          currentHealth: 50
        });
      });

      test('should propagate damage using damage_entry structure', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'parent',
          damage_entry: {
            name: 'piercing',
            amount: 20,
            penetration: 0.5
          }
        };

        const components = {
          parent: {
            [PART_COMPONENT_ID]: {
              subType: 'torso',
              ownerEntityId: 'entity1',
              damage_propagation: {
                child: { probability: 1, damage_fraction: 0.5 }
              }
            },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 100,
              maxHealth: 100,
              state: 'healthy',
              turnsInState: 0
            }
          },
          child: {
            [PART_COMPONENT_ID]: { subType: 'heart', ownerEntityId: 'entity1' },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 40,
              maxHealth: 40,
              state: 'healthy',
              turnsInState: 0
            }
          }
        };

        em.hasComponent.mockImplementation((id, comp) => Boolean(components[id]?.[comp]));
        em.getComponentData.mockImplementation((id, comp) => components[id]?.[comp] || null);

        // Mock the service to return propagation result on first call, then empty array
        damagePropagationService.propagateDamage
          .mockReturnValueOnce([{ childPartId: 'child', damageApplied: 10, damageTypeId: 'piercing' }])
          .mockReturnValue([]);

        await handler.execute(params, executionContext);

        // Parent damage applied
        expect(em.addComponent).toHaveBeenCalledWith(
          'parent',
          PART_HEALTH_COMPONENT_ID,
          expect.objectContaining({ currentHealth: 80 })
        );

        // Child damage applied (via propagation)
        expect(em.addComponent).toHaveBeenCalledWith(
          'child',
          PART_HEALTH_COMPONENT_ID,
          expect.objectContaining({ currentHealth: 30 })
        );
      });
    });

    describe('exclude_damage_types parameter', () => {
      test('should skip damage when type is in exclusion list', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          damage_entry: {
            name: 'piercing',
            amount: 25
          },
          exclude_damage_types: ['piercing']
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

        // No damage should be applied
        expect(em.addComponent).not.toHaveBeenCalled();
        expect(dispatcher.dispatch).not.toHaveBeenCalledWith(DAMAGE_APPLIED_EVENT, expect.anything());
        expect(log.debug).toHaveBeenCalledWith(
          expect.stringContaining("Skipping excluded damage type 'piercing'"),
          expect.objectContaining({ excluded: ['piercing'] })
        );
      });

      test('should apply damage when type is NOT in exclusion list', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          damage_entry: {
            name: 'slashing',
            amount: 25
          },
          exclude_damage_types: ['piercing']
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

        // Damage should be applied normally
        expect(dispatcher.dispatch).toHaveBeenCalledWith(DAMAGE_APPLIED_EVENT, expect.objectContaining({
          entityId: 'entity1',
          amount: 25,
          damageType: 'slashing'
        }));
        expect(em.addComponent).toHaveBeenCalledWith('part1', PART_HEALTH_COMPONENT_ID, expect.objectContaining({
          currentHealth: 75
        }));
      });

      test('should apply damage when exclusion list is empty', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          damage_entry: {
            name: 'slashing',
            amount: 20
          },
          exclude_damage_types: []
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
          amount: 20
        }));
        expect(em.addComponent).toHaveBeenCalled();
      });

      test('should apply damage when exclude_damage_types is undefined (backward compatibility)', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          damage_entry: {
            name: 'slashing',
            amount: 15
          }
          // No exclude_damage_types parameter
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
          amount: 15
        }));
        expect(em.addComponent).toHaveBeenCalled();
      });

      test('should handle multiple exclusions correctly', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          damage_entry: {
            name: 'fire',
            amount: 30
          },
          exclude_damage_types: ['piercing', 'fire', 'bludgeoning']
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

        // Fire should be excluded
        expect(em.addComponent).not.toHaveBeenCalled();
        expect(log.debug).toHaveBeenCalledWith(
          expect.stringContaining("Skipping excluded damage type 'fire'"),
          expect.anything()
        );
      });

      test('should resolve JSON Logic expression for exclusions', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          damage_entry: {
            name: 'piercing',
            amount: 20
          },
          exclude_damage_types: { var: 'context.excludedTypes' }
        };

        const healthComponent = {
          currentHealth: 100,
          maxHealth: 100,
          state: 'healthy',
          turnsInState: 0
        };

        // JSON Logic evaluates to array of excluded types
        jsonLogicService.evaluate.mockReturnValue(['piercing', 'slashing']);

        em.hasComponent.mockImplementation((id, comp) => comp === PART_HEALTH_COMPONENT_ID);
        em.getComponentData.mockReturnValue(healthComponent);

        await handler.execute(params, executionContext);

        expect(jsonLogicService.evaluate).toHaveBeenCalledWith(
          { var: 'context.excludedTypes' },
          executionContext
        );
        // Piercing should be excluded
        expect(em.addComponent).not.toHaveBeenCalled();
      });

      test('should handle JSON Logic evaluation failure gracefully (fail-open)', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          damage_entry: {
            name: 'slashing',
            amount: 25
          },
          exclude_damage_types: { malformed: 'expression' }
        };

        const healthComponent = {
          currentHealth: 100,
          maxHealth: 100,
          state: 'healthy',
          turnsInState: 0
        };

        // JSON Logic evaluation throws
        jsonLogicService.evaluate.mockImplementation(() => {
          throw new Error('Evaluation failed');
        });

        em.hasComponent.mockImplementation((id, comp) => comp === PART_HEALTH_COMPONENT_ID);
        em.getComponentData.mockReturnValue(healthComponent);

        await handler.execute(params, executionContext);

        // Should warn about the failure
        expect(log.warn).toHaveBeenCalledWith(
          'APPLY_DAMAGE: Failed to evaluate exclude_damage_types',
          expect.objectContaining({ error: 'Evaluation failed' })
        );
        // Should still apply damage (fail-open)
        expect(dispatcher.dispatch).toHaveBeenCalledWith(DAMAGE_APPLIED_EVENT, expect.objectContaining({
          amount: 25
        }));
        expect(em.addComponent).toHaveBeenCalled();
      });

      test('should be case-sensitive for damage type names', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          damage_entry: {
            name: 'Piercing',  // Capital P
            amount: 20
          },
          exclude_damage_types: ['piercing']  // lowercase
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

        // Damage should be applied because case doesn't match
        expect(dispatcher.dispatch).toHaveBeenCalledWith(DAMAGE_APPLIED_EVENT, expect.objectContaining({
          damageType: 'Piercing'
        }));
        expect(em.addComponent).toHaveBeenCalled();
      });

      test('should not affect damage_multiplier when exclusion applies', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          damage_entry: {
            name: 'piercing',
            amount: 20
          },
          damage_multiplier: 1.5,
          exclude_damage_types: ['piercing']
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

        // No damage should be applied - exclusion happens before multiplier
        expect(em.addComponent).not.toHaveBeenCalled();
        expect(damageTypeEffectsService.applyEffectsForDamage).not.toHaveBeenCalled();
      });

      test('should work with legacy damage_type parameter', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'part1',
          amount: 20,
          damage_type: 'piercing',
          exclude_damage_types: ['piercing']
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

        // Should skip damage due to exclusion
        expect(em.addComponent).not.toHaveBeenCalled();
        // Should still emit deprecation warning first
        expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('DEPRECATED'));
        // Then skip with debug message
        expect(log.debug).toHaveBeenCalledWith(
          expect.stringContaining("Skipping excluded damage type 'piercing'"),
          expect.anything()
        );
      });
    });

    describe('entity_ref placeholder resolution', () => {
      test('should resolve "secondary" placeholder to entity ID from event payload', async () => {
        const actualEntityId = 'actual-target-entity-123';
        const params = {
          entity_ref: 'secondary',
          part_ref: 'part1',
          damage_entry: { name: 'slashing', amount: 10 }
        };

        const healthComponent = {
          currentHealth: 100,
          maxHealth: 100,
          state: 'healthy',
          turnsInState: 0
        };

        // Set up execution context with event payload containing secondaryId
        executionContext = {
          evaluationContext: {
            context: {},
            event: {
              type: 'core:attempt_action',
              payload: {
                actionId: 'weapons:swing_at_target',
                actorId: 'actor-123',
                primaryId: 'weapon-456',
                secondaryId: actualEntityId
              }
            }
          },
          logger: log,
        };

        em.hasComponent.mockImplementation((id, comp) => {
          if (id === actualEntityId && comp === BODY_COMPONENT_ID) return true;
          if (id === 'part1' && comp === PART_HEALTH_COMPONENT_ID) return true;
          if (id === 'part1' && comp === PART_COMPONENT_ID) return true;
          return false;
        });
        em.getComponentData.mockImplementation((id, comp) => {
          if (id === 'part1' && comp === PART_HEALTH_COMPONENT_ID) return healthComponent;
          if (id === 'part1' && comp === PART_COMPONENT_ID) return { subType: 'torso', ownerEntityId: actualEntityId };
          return null;
        });

        await handler.execute(params, executionContext);

        // Verify damage was applied to the resolved entity (via part)
        expect(dispatcher.dispatch).toHaveBeenCalledWith(
          DAMAGE_APPLIED_EVENT,
          expect.objectContaining({
            entityId: actualEntityId,
            partId: 'part1',
            amount: 10,
            damageType: 'slashing'
          })
        );
      });

      test('should resolve "primary" placeholder to entity ID from event payload', async () => {
        const actualEntityId = 'weapon-entity-456';
        const params = {
          entity_ref: 'primary',
          part_ref: 'blade-part',
          damage_entry: { name: 'impact', amount: 5 }
        };

        const healthComponent = {
          currentHealth: 50,
          maxHealth: 50,
          state: 'healthy',
          turnsInState: 0
        };

        executionContext = {
          evaluationContext: {
            context: {},
            event: {
              type: 'core:attempt_action',
              payload: {
                actionId: 'test:action',
                actorId: 'actor-123',
                primaryId: actualEntityId,
                secondaryId: 'other-entity'
              }
            }
          },
          logger: log,
        };

        em.hasComponent.mockImplementation((id, comp) => {
          if (id === actualEntityId && comp === BODY_COMPONENT_ID) return true;
          if (id === 'blade-part' && comp === PART_HEALTH_COMPONENT_ID) return true;
          if (id === 'blade-part' && comp === PART_COMPONENT_ID) return true;
          return false;
        });
        em.getComponentData.mockImplementation((id, comp) => {
          if (id === 'blade-part' && comp === PART_HEALTH_COMPONENT_ID) return healthComponent;
          if (id === 'blade-part' && comp === PART_COMPONENT_ID) return { subType: 'blade', ownerEntityId: actualEntityId };
          return null;
        });

        await handler.execute(params, executionContext);

        expect(dispatcher.dispatch).toHaveBeenCalledWith(
          DAMAGE_APPLIED_EVENT,
          expect.objectContaining({
            entityId: actualEntityId,
            partId: 'blade-part'
          })
        );
      });

      test('should resolve "actor" keyword to actor ID from evaluation context', async () => {
        const actorEntityId = 'actor-entity-789';
        const params = {
          entity_ref: 'actor',
          part_ref: 'hand-part',
          damage_entry: { name: 'fire', amount: 8 }
        };

        const healthComponent = {
          currentHealth: 30,
          maxHealth: 30,
          state: 'healthy',
          turnsInState: 0
        };

        executionContext = {
          evaluationContext: {
            context: {},
            actor: { id: actorEntityId },
            event: {
              type: 'core:attempt_action',
              payload: { actorId: actorEntityId }
            }
          },
          logger: log,
        };

        em.hasComponent.mockImplementation((id, comp) => {
          if (id === actorEntityId && comp === BODY_COMPONENT_ID) return true;
          if (id === 'hand-part' && comp === PART_HEALTH_COMPONENT_ID) return true;
          if (id === 'hand-part' && comp === PART_COMPONENT_ID) return true;
          return false;
        });
        em.getComponentData.mockImplementation((id, comp) => {
          if (id === 'hand-part' && comp === PART_HEALTH_COMPONENT_ID) return healthComponent;
          if (id === 'hand-part' && comp === PART_COMPONENT_ID) return { subType: 'hand', ownerEntityId: actorEntityId };
          return null;
        });

        await handler.execute(params, executionContext);

        expect(dispatcher.dispatch).toHaveBeenCalledWith(
          DAMAGE_APPLIED_EVENT,
          expect.objectContaining({
            entityId: actorEntityId,
            partId: 'hand-part'
          })
        );
      });

      test('should still work with direct entity ID strings', async () => {
        const directEntityId = 'direct-entity-id-999';
        const params = {
          entity_ref: directEntityId,
          part_ref: 'part1',
          damage_entry: { name: 'bludgeoning', amount: 15 }
        };

        const healthComponent = {
          currentHealth: 100,
          maxHealth: 100,
          state: 'healthy',
          turnsInState: 0
        };

        em.hasComponent.mockImplementation((id, comp) => {
          if (id === directEntityId && comp === BODY_COMPONENT_ID) return true;
          if (id === 'part1' && comp === PART_HEALTH_COMPONENT_ID) return true;
          if (id === 'part1' && comp === PART_COMPONENT_ID) return true;
          return false;
        });
        em.getComponentData.mockImplementation((id, comp) => {
          if (id === 'part1' && comp === PART_HEALTH_COMPONENT_ID) return healthComponent;
          if (id === 'part1' && comp === PART_COMPONENT_ID) return { subType: 'torso', ownerEntityId: directEntityId };
          return null;
        });

        await handler.execute(params, executionContext);

        expect(dispatcher.dispatch).toHaveBeenCalledWith(
          DAMAGE_APPLIED_EVENT,
          expect.objectContaining({
            entityId: directEntityId,
            partId: 'part1'
          })
        );
      });

      test('should resolve "tertiary" placeholder to entity ID from event payload', async () => {
        const tertiaryEntityId = 'tertiary-entity-321';
        const params = {
          entity_ref: 'tertiary',
          part_ref: 'arm-part',
          damage_entry: { name: 'cold', amount: 12 }
        };

        const healthComponent = {
          currentHealth: 40,
          maxHealth: 40,
          state: 'healthy',
          turnsInState: 0
        };

        executionContext = {
          evaluationContext: {
            context: {},
            event: {
              type: 'core:attempt_action',
              payload: {
                actionId: 'test:multi-target',
                actorId: 'actor-123',
                primaryId: 'primary-entity',
                secondaryId: 'secondary-entity',
                tertiaryId: tertiaryEntityId
              }
            }
          },
          logger: log,
        };

        em.hasComponent.mockImplementation((id, comp) => {
          if (id === tertiaryEntityId && comp === BODY_COMPONENT_ID) return true;
          if (id === 'arm-part' && comp === PART_HEALTH_COMPONENT_ID) return true;
          if (id === 'arm-part' && comp === PART_COMPONENT_ID) return true;
          return false;
        });
        em.getComponentData.mockImplementation((id, comp) => {
          if (id === 'arm-part' && comp === PART_HEALTH_COMPONENT_ID) return healthComponent;
          if (id === 'arm-part' && comp === PART_COMPONENT_ID) return { subType: 'arm', ownerEntityId: tertiaryEntityId };
          return null;
        });

        await handler.execute(params, executionContext);

        expect(dispatcher.dispatch).toHaveBeenCalledWith(
          DAMAGE_APPLIED_EVENT,
          expect.objectContaining({
            entityId: tertiaryEntityId,
            partId: 'arm-part'
          })
        );
      });

      test('should dispatch error when placeholder cannot be resolved', async () => {
        const params = {
          entity_ref: 'secondary',  // Placeholder that won't resolve
          part_ref: 'part1',
          damage_entry: { name: 'slashing', amount: 10 }
        };

        // Event payload missing secondaryId
        executionContext = {
          evaluationContext: {
            context: {},
            event: {
              type: 'core:attempt_action',
              payload: {
                actionId: 'test:action',
                actorId: 'actor-123'
                // No primaryId, secondaryId, tertiaryId
              }
            }
          },
          logger: log,
        };

        await handler.execute(params, executionContext);

        // Should dispatch error for invalid entity_ref
        expect(dispatcher.dispatch).toHaveBeenCalledWith(
          'core:system_error_occurred',
          expect.objectContaining({
            message: expect.stringContaining('Invalid entity_ref')
          })
        );
      });

      test('should still evaluate JSON Logic entity_ref objects', async () => {
        const resolvedEntityId = 'json-logic-resolved-entity';
        const params = {
          entity_ref: { var: 'context.targetEntity.id' },
          part_ref: 'part1',
          damage_entry: { name: 'piercing', amount: 7 }
        };

        const healthComponent = {
          currentHealth: 60,
          maxHealth: 60,
          state: 'healthy',
          turnsInState: 0
        };

        executionContext = {
          evaluationContext: {
            context: {
              targetEntity: { id: resolvedEntityId }
            }
          },
          logger: log,
        };

        // Mock JSON Logic evaluation
        jsonLogicService.evaluate.mockReturnValue(resolvedEntityId);

        em.hasComponent.mockImplementation((id, comp) => {
          if (id === resolvedEntityId && comp === BODY_COMPONENT_ID) return true;
          if (id === 'part1' && comp === PART_HEALTH_COMPONENT_ID) return true;
          if (id === 'part1' && comp === PART_COMPONENT_ID) return true;
          return false;
        });
        em.getComponentData.mockImplementation((id, comp) => {
          if (id === 'part1' && comp === PART_HEALTH_COMPONENT_ID) return healthComponent;
          if (id === 'part1' && comp === PART_COMPONENT_ID) return { subType: 'torso', ownerEntityId: resolvedEntityId };
          return null;
        });

        await handler.execute(params, executionContext);

        expect(jsonLogicService.evaluate).toHaveBeenCalledWith(
          { var: 'context.targetEntity.id' },
          executionContext
        );
        expect(dispatcher.dispatch).toHaveBeenCalledWith(
          DAMAGE_APPLIED_EVENT,
          expect.objectContaining({
            entityId: resolvedEntityId,
            partId: 'part1'
          })
        );
      });
    });
  });
});
