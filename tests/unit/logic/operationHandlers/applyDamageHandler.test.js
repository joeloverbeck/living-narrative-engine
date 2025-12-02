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
        damageTypeEffectsService
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
              damageTypeEffectsService
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
              bodyGraphService
            })
        ).toThrow(/damageTypeEffectsService/i);
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
        damageTypeEffectsService
      });
      executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };
      em.addComponent.mockResolvedValue(true);
    });

    describe('propagation', () => {
      test('propagates damage to child when probability/type pass', async () => {
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
            },
            'anatomy:joint': { parentId: 'parent' }
          }
        };

        em.hasComponent.mockImplementation((id, comp) => Boolean(components[id]?.[comp]));
        em.getComponentData.mockImplementation((id, comp) => components[id]?.[comp] || null);

        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.1);

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

        randomSpy.mockRestore();
      });

      test('does not propagate when probability check fails', async () => {
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
            },
            'anatomy:joint': { parentId: 'parent' }
          }
        };

        em.hasComponent.mockImplementation((id, comp) => Boolean(components[id]?.[comp]));
        em.getComponentData.mockImplementation((id, comp) => components[id]?.[comp] || null);

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

      test('does not propagate when damage type filter mismatches', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'parent',
          amount: 10,
          damage_type: 'blunt'
        };

        const components = {
          parent: {
            [PART_COMPONENT_ID]: {
              subType: 'torso',
              ownerEntityId: 'entity1',
              damage_propagation: {
                child: {
                  probability: 1,
                  damage_fraction: 0.5,
                  damage_types: ['piercing']
                }
              }
            },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 80,
              maxHealth: 80,
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
            },
            'anatomy:joint': { parentId: 'parent' }
          }
        };

        em.hasComponent.mockImplementation((id, comp) => Boolean(components[id]?.[comp]));
        em.getComponentData.mockImplementation((id, comp) => components[id]?.[comp] || null);

        await handler.execute(params, executionContext);

        expect(em.addComponent).toHaveBeenCalledWith(
          'parent',
          PART_HEALTH_COMPONENT_ID,
          expect.objectContaining({ currentHealth: 70 })
        );
        expect(em.addComponent).not.toHaveBeenCalledWith(
          'child',
          PART_HEALTH_COMPONENT_ID,
          expect.anything()
        );
      });

      test('skips propagation when rule target is not a child of the part', async () => {
        const params = {
          entity_ref: 'entity1',
          part_ref: 'parent',
          amount: 8,
          damage_type: 'piercing'
        };

        const components = {
          parent: {
            [PART_COMPONENT_ID]: {
              subType: 'torso',
              ownerEntityId: 'entity1',
              damage_propagation: {
                unrelated: { probability: 1, damage_fraction: 1 }
              }
            },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 25,
              maxHealth: 25,
              state: 'healthy',
              turnsInState: 0
            }
          },
          unrelated: {
            [PART_COMPONENT_ID]: { subType: 'tail', ownerEntityId: 'entity1' },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 15,
              maxHealth: 15,
              state: 'healthy',
              turnsInState: 0
            },
            'anatomy:joint': { parentId: 'anotherParent' }
          }
        };

        em.hasComponent.mockImplementation((id, comp) => Boolean(components[id]?.[comp]));
        em.getComponentData.mockImplementation((id, comp) => components[id]?.[comp] || null);

        await handler.execute(params, executionContext);

        // Verify log message
        expect(log.debug).toHaveBeenCalledWith(expect.stringContaining('not a child of'));

        expect(em.addComponent).toHaveBeenCalledWith(
          'parent',
          PART_HEALTH_COMPONENT_ID,
          expect.objectContaining({ currentHealth: 17 })
        );
        expect(em.addComponent).not.toHaveBeenCalledWith(
          'unrelated',
          PART_HEALTH_COMPONENT_ID,
          expect.anything()
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

      jsonLogicService.evaluate.mockImplementation((rule, ctx) => {
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

        // Mock PART_COMPONENT to have propagation rules, but no health component
        em.hasComponent.mockImplementation((id, comp) => {
            if (comp === PART_COMPONENT_ID && id === 'hair') return true;
            // Child part has health
            if (comp === PART_HEALTH_COMPONENT_ID && id === 'scalp') return true;
            if (comp === 'anatomy:joint' && id === 'scalp') return true; // joint
            
            return false;
        });

        em.getComponentData.mockImplementation((id, comp) => {
            if (comp === PART_COMPONENT_ID && id === 'hair') {
                return {
                    damage_propagation: {
                        scalp: { probability: 1, damage_fraction: 1 }
                    }
                };
            }
            // Child part has health
            if (comp === PART_HEALTH_COMPONENT_ID && id === 'scalp') {
                return { currentHealth: 50, maxHealth: 50 };
            }
            if (comp === 'anatomy:joint' && id === 'scalp') {
                return { parentId: 'hair' };
            }
            return null;
        });

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

    test('handles propagation probability edge cases', async () => {
         const params = {
          entity_ref: 'entity1',
          part_ref: 'parent',
          amount: 20,
          damage_type: 'type'
        };

        // Rule with missing probability (should default to 1)
        // Rule with probability > 1 (should clamp to 1)
        // Rule with probability < 0 (should clamp to 0)
        const components = {
          parent: {
            [PART_COMPONENT_ID]: {
              subType: 'torso',
              ownerEntityId: 'entity1',
              damage_propagation: {
                child1: { probability: undefined, damage_fraction: 1 }, // Defaults to 1
                child2: { probability: 1.5, damage_fraction: 1 },       // Clamps to 1
                child3: { probability: -0.5, damage_fraction: 1 }       // Clamps to 0
              }
            },
            [PART_HEALTH_COMPONENT_ID]: { currentHealth: 100, maxHealth: 100 }
          },
          child1: { [PART_HEALTH_COMPONENT_ID]: { currentHealth: 10, maxHealth: 10 }, 'anatomy:joint': { parentId: 'parent' } },
          child2: { [PART_HEALTH_COMPONENT_ID]: { currentHealth: 10, maxHealth: 10 }, 'anatomy:joint': { parentId: 'parent' } },
          child3: { [PART_HEALTH_COMPONENT_ID]: { currentHealth: 10, maxHealth: 10 }, 'anatomy:joint': { parentId: 'parent' } }
        };

        em.hasComponent.mockImplementation((id, comp) => Boolean(components[id]?.[comp]));
        em.getComponentData.mockImplementation((id, comp) => components[id]?.[comp] || null);

        // Force random to allow probability 1 (random < 1) and disallow 0 (random > 0)
        jest.spyOn(Math, 'random').mockReturnValue(0.5);

        await handler.execute(params, executionContext);

        // child1 (undefined -> 1) should be hit
        expect(em.addComponent).toHaveBeenCalledWith('child1', PART_HEALTH_COMPONENT_ID, expect.anything());
        // child2 (1.5 -> 1) should be hit
        expect(em.addComponent).toHaveBeenCalledWith('child2', PART_HEALTH_COMPONENT_ID, expect.anything());
        // child3 (-0.5 -> 0) should NOT be hit (0.5 > 0)
        expect(em.addComponent).not.toHaveBeenCalledWith('child3', PART_HEALTH_COMPONENT_ID, expect.anything());
    });
  });
});
