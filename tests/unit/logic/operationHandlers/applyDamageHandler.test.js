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

    test('calculates bruised and badly_damaged states correctly', async () => {
        const params = { entity_ref: 'e', part_ref: 'p', amount: 0, damage_type: 'd' };
        em.hasComponent.mockImplementation((id, comp) => comp === PART_HEALTH_COMPONENT_ID);
        
        // Test Bruised (51-75%)
        // Max 100, current 60 -> 60%
        em.getComponentData.mockReturnValue({ currentHealth: 60, maxHealth: 100, state: 'healthy' });
        await handler.execute({ ...params, amount: 0 }, executionContext); // 0 damage to just trigger update check? 
        // Wait, 0 damage might be optimized out? No, code calculates newHealth = current - amount.
        // Actually, if I apply 0 damage, health stays 60. 60 is bruised.
        expect(em.addComponent).toHaveBeenCalledWith('p', PART_HEALTH_COMPONENT_ID, expect.objectContaining({ state: 'bruised' }));

        em.addComponent.mockClear();

        // Test Badly Damaged (1-25%)
        // Max 100, current 10 -> 10%
        em.getComponentData.mockReturnValue({ currentHealth: 10, maxHealth: 100, state: 'healthy' });
        await handler.execute({ ...params, amount: 0 }, executionContext);
        expect(em.addComponent).toHaveBeenCalledWith('p', PART_HEALTH_COMPONENT_ID, expect.objectContaining({ state: 'badly_damaged' }));
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
          partId: 'part1',
          damageEntry: damageEntry,
          maxHealth: 100,
          currentHealth: 70
        });
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
          partId: 'part1',
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
  });
});
