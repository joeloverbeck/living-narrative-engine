/* eslint-disable jsdoc/check-tag-names */
/**
 * @jest-environment node
 */
/* eslint-enable jsdoc/check-tag-names */
/**
 * @file Integration tests for death check integration in ApplyDamageHandler
 * @see src/logic/operationHandlers/applyDamageHandler.js
 * @see src/anatomy/services/deathCheckService.js
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import ApplyDamageHandler from '../../../src/logic/operationHandlers/applyDamageHandler.js';
import DeathCheckService from '../../../src/anatomy/services/deathCheckService.js';
import DamageAccumulator from '../../../src/anatomy/services/damageAccumulator.js';
import DamageNarrativeComposer from '../../../src/anatomy/services/damageNarrativeComposer.js';

const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';
const BODY_COMPONENT_ID = 'anatomy:body';
const OVERALL_HEALTH_COMPONENT_ID = 'anatomy:overall_health';
const DEAD_COMPONENT_ID = 'anatomy:dead';
const DYING_COMPONENT_ID = 'anatomy:dying';
const VITAL_ORGAN_COMPONENT_ID = 'anatomy:vital_organ';

describe('Death Check Integration', () => {
  let log;
  let entityManager;
  let dispatcher;
  let eventBus;
  let jsonLogicService;
  let bodyGraphService;
  let damageTypeEffectsService;
  let damagePropagationService;
  let injuryAggregationService;
  let deathCheckService;
  let handler;

  beforeEach(() => {
    log = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    entityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      addComponent: jest.fn().mockResolvedValue(true),
    };

    // dispatcher is used by ApplyDamageHandler for damage events
    dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    // eventBus is used by DeathCheckService for death/dying events
    eventBus = { dispatch: jest.fn().mockResolvedValue(true) };
    jsonLogicService = { evaluate: jest.fn() };
    bodyGraphService = {
      getAllParts: jest.fn(),
      getAllDescendants: jest.fn().mockReturnValue([]),
    };
    damageTypeEffectsService = { applyEffectsForDamage: jest.fn() };
    damagePropagationService = {
      propagateDamage: jest.fn().mockReturnValue([]),
    };
    // Default to no destroyed parts
    injuryAggregationService = {
      aggregateInjuries: jest.fn().mockReturnValue({ destroyedParts: [] }),
    };

    // Use the real DeathCheckService
    deathCheckService = new DeathCheckService({
      logger: log,
      entityManager,
      eventBus,
      injuryAggregationService,
      bodyGraphService,
    });

    const damageAccumulator = new DamageAccumulator({
      logger: log,
    });

    const damageNarrativeComposer = new DamageNarrativeComposer({
      logger: log,
    });

    handler = new ApplyDamageHandler({
      logger: log,
      entityManager,
      safeEventDispatcher: dispatcher,
      jsonLogicService,
      bodyGraphService,
      damageTypeEffectsService,
      damagePropagationService,
      deathCheckService,
      damageAccumulator,
      damageNarrativeComposer,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('damage -> death flow', () => {
    test('should trigger death when vital organ is destroyed', async () => {
      const params = {
        entity_ref: 'entity1',
        part_ref: 'heart-part',
        amount: 100,
        damage_type: 'piercing',
      };

      const executionContext = {
        evaluationContext: { context: {} },
        logger: log,
        actorId: 'attacker-id',
      };

      // Setup entity state
      const components = {
        'heart-part': {
          [PART_COMPONENT_ID]: {
            subType: 'heart',
            ownerEntityId: 'entity1',
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 50,
            maxHealth: 100,
            state: 'healthy',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'heart',
          },
        },
        entity1: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID && id === 'heart-part')
          return true;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue(['heart-part']);

      // Mock injury aggregation to report destroyed vital organ
      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [{ partEntityId: 'heart-part', partType: 'heart' }],
      });

      await handler.execute(params, executionContext);

      // Verify death was triggered via eventBus (DeathCheckService dispatches to eventBus)
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.objectContaining({
          entityId: 'entity1',
          causeOfDeath: 'vital_organ_destroyed',
          killedBy: 'attacker-id',
        })
      );
    });

    test('should trigger dying state when overall health < 10%', async () => {
      const params = {
        entity_ref: 'entity1',
        part_ref: 'torso-part',
        amount: 50,
        damage_type: 'blunt',
      };

      const executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };

      const components = {
        'torso-part': {
          [PART_COMPONENT_ID]: {
            subType: 'torso',
            ownerEntityId: 'entity1',
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 100,
            maxHealth: 100,
            state: 'healthy',
            turnsInState: 0,
          },
        },
        entity1: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
          [OVERALL_HEALTH_COMPONENT_ID]: {
            currentHealth: 5, // 5% health - critically low
            maxHealth: 100,
          },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === DYING_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID) return false;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue(['torso-part']);

      // Mock injury aggregation to return critical health percentage
      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [],
        overallHealthPercentage: 5, // 5% - below CRITICAL_HEALTH_THRESHOLD (10%)
      });

      await handler.execute(params, executionContext);

      // Verify dying component was added via entityManager
      expect(entityManager.addComponent).toHaveBeenCalledWith(
        'entity1',
        DYING_COMPONENT_ID,
        expect.any(Object)
      );
    });

    test('should dispatch anatomy:entity_died event on death', async () => {
      const params = {
        entity_ref: 'victim',
        part_ref: 'brain-part',
        amount: 200,
        damage_type: 'crushing',
      };

      const executionContext = {
        evaluationContext: { context: {} },
        logger: log,
        actorId: 'killer-id',
      };

      const components = {
        'brain-part': {
          [PART_COMPONENT_ID]: {
            subType: 'brain',
            ownerEntityId: 'victim',
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 50,
            maxHealth: 50,
            state: 'healthy',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'brain',
          },
        },
        victim: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID && id === 'brain-part')
          return true;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue(['brain-part']);

      // Mock injury aggregation to report destroyed vital organ
      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [{ partEntityId: 'brain-part', partType: 'brain' }],
      });

      await handler.execute(params, executionContext);

      // DeathCheckService dispatches to eventBus, uses 'killedBy' field
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.objectContaining({
          entityId: 'victim',
          causeOfDeath: 'vital_organ_destroyed',
          killedBy: 'killer-id',
        })
      );
    });

    test('should dispatch anatomy:entity_dying event on dying state', async () => {
      const params = {
        entity_ref: 'entity1',
        part_ref: 'arm-part',
        amount: 30,
        damage_type: 'slash',
      };

      const executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };

      const components = {
        'arm-part': {
          [PART_COMPONENT_ID]: {
            subType: 'arm',
            ownerEntityId: 'entity1',
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 80,
            maxHealth: 80,
            state: 'healthy',
            turnsInState: 0,
          },
        },
        entity1: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
          [OVERALL_HEALTH_COMPONENT_ID]: {
            currentHealth: 8, // 8% health - critically low
            maxHealth: 100,
          },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === DYING_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID) return false;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue(['arm-part']);

      // Mock injury aggregation to return critical health percentage
      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [],
        overallHealthPercentage: 8, // 8% - below CRITICAL_HEALTH_THRESHOLD (10%)
      });

      await handler.execute(params, executionContext);

      // DeathCheckService dispatches dying events to eventBus
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:entity_dying',
        expect.objectContaining({
          entityId: 'entity1',
        })
      );
    });
  });

  describe('propagation -> death flow', () => {
    test('should check death after propagated damage destroys vital organ', async () => {
      const params = {
        entity_ref: 'entity1',
        part_ref: 'torso-part',
        amount: 50,
        damage_type: 'piercing',
      };

      const executionContext = {
        evaluationContext: { context: {} },
        logger: log,
        actorId: 'attacker-id',
      };

      const components = {
        'torso-part': {
          [PART_COMPONENT_ID]: {
            subType: 'torso',
            ownerEntityId: 'entity1',
            damage_propagation: {
              'heart-part': { probability: 1, damage_fraction: 1 },
            },
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 100,
            maxHealth: 100,
            state: 'healthy',
            turnsInState: 0,
          },
        },
        'heart-part': {
          [PART_COMPONENT_ID]: {
            subType: 'heart',
            ownerEntityId: 'entity1',
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 30,
            maxHealth: 50,
            state: 'wounded',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'heart',
          },
        },
        entity1: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID && id === 'heart-part')
          return true;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      // Mock propagation: parent damage propagates to heart
      damagePropagationService.propagateDamage
        .mockReturnValueOnce([
          {
            childPartId: 'heart-part',
            damageApplied: 50,
            damageTypeId: 'piercing',
          },
        ])
        .mockReturnValue([]);

      bodyGraphService.getAllParts.mockReturnValue([
        'torso-part',
        'heart-part',
      ]);

      // Mock injury aggregation to report destroyed vital organ after propagation
      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [{ partEntityId: 'heart-part', partType: 'heart' }],
      });

      await handler.execute(params, executionContext);

      // Death check should be called only once at top-level, not for each propagated damage
      // The heart destruction should trigger death via eventBus
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.objectContaining({
          entityId: 'entity1',
        })
      );
    });
  });

  describe('edge cases', () => {
    test('should not check death twice when entity already dead', async () => {
      const params = {
        entity_ref: 'dead-entity',
        part_ref: 'arm-part',
        amount: 10,
        damage_type: 'blunt',
      };

      const executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };

      const components = {
        'arm-part': {
          [PART_COMPONENT_ID]: {
            subType: 'arm',
            ownerEntityId: 'dead-entity',
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 50,
            maxHealth: 50,
            state: 'healthy',
            turnsInState: 0,
          },
        },
        'dead-entity': {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
          [DEAD_COMPONENT_ID]: {
            timestamp: Date.now(),
            causeOfDeath: 'vital_organ_destroyed',
          },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        // Entity is already dead
        if (comp === DEAD_COMPONENT_ID && id === 'dead-entity') return true;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      await handler.execute(params, executionContext);

      // Should not dispatch additional death events (check eventBus, not dispatcher)
      expect(eventBus.dispatch).not.toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.anything()
      );
    });

    test('should handle entities without anatomy gracefully', async () => {
      const params = {
        entity_ref: 'simple-entity',
        part_ref: 'part1',
        amount: 20,
        damage_type: 'blunt',
      };

      const executionContext = {
        evaluationContext: { context: {} },
        logger: log,
      };

      // Entity has no body component or vital organs
      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === PART_HEALTH_COMPONENT_ID && id === 'part1') return true;
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === DYING_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID) return false;
        if (comp === OVERALL_HEALTH_COMPONENT_ID) return false;
        return false;
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        if (comp === PART_HEALTH_COMPONENT_ID && id === 'part1') {
          return {
            currentHealth: 100,
            maxHealth: 100,
            state: 'healthy',
            turnsInState: 0,
          };
        }
        return null;
      });

      // Should not throw error
      await expect(
        handler.execute(params, executionContext)
      ).resolves.not.toThrow();

      // Should complete damage application
      expect(entityManager.addComponent).toHaveBeenCalledWith(
        'part1',
        PART_HEALTH_COMPONENT_ID,
        expect.objectContaining({ currentHealth: 80 })
      );

      // Death check called but returns no death/dying since no vital organs
      // Check eventBus, not dispatcher, for death/dying events
      expect(eventBus.dispatch).not.toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.anything()
      );
      expect(eventBus.dispatch).not.toHaveBeenCalledWith(
        'anatomy:entity_dying',
        expect.anything()
      );
    });
  });

  describe('processDyingTurn - dying countdown', () => {
    test('should decrement turnsRemaining each turn', () => {
      const entityId = 'dying-entity';

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DYING_COMPONENT_ID && id === entityId) return true;
        return false;
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        if (comp === DYING_COMPONENT_ID && id === entityId) {
          return {
            turnsRemaining: 3,
            causeOfDying: 'overall_health_critical',
            stabilizedBy: null,
          };
        }
        return null;
      });

      const result = deathCheckService.processDyingTurn(entityId);

      // Should not trigger death yet (countdown not expired)
      expect(result).toBe(false);

      // Should update dying component with decremented turns
      expect(entityManager.addComponent).toHaveBeenCalledWith(
        entityId,
        DYING_COMPONENT_ID,
        expect.objectContaining({
          turnsRemaining: 2,
          causeOfDying: 'overall_health_critical',
          stabilizedBy: null,
        })
      );
    });

    test('should trigger death when turnsRemaining reaches 0', () => {
      const entityId = 'dying-entity';

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DYING_COMPONENT_ID && id === entityId) return true;
        return false;
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        if (comp === DYING_COMPONENT_ID && id === entityId) {
          return {
            turnsRemaining: 1, // Will become 0 after decrement
            causeOfDying: 'overall_health_critical',
            stabilizedBy: null,
          };
        }
        return null;
      });

      const result = deathCheckService.processDyingTurn(entityId);

      // Should trigger death
      expect(result).toBe(true);

      // Should dispatch death event with 'bleeding_out' cause
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.objectContaining({
          entityId,
          causeOfDeath: 'bleeding_out',
        })
      );
    });

    test('should skip countdown processing if entity is stabilized', () => {
      const entityId = 'stabilized-entity';

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DYING_COMPONENT_ID && id === entityId) return true;
        return false;
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        if (comp === DYING_COMPONENT_ID && id === entityId) {
          return {
            turnsRemaining: 2,
            causeOfDying: 'overall_health_critical',
            stabilizedBy: 'healer-entity', // Entity has been stabilized
          };
        }
        return null;
      });

      const result = deathCheckService.processDyingTurn(entityId);

      // Should not trigger death (stabilized)
      expect(result).toBe(false);

      // Should NOT update the dying component (countdown skipped)
      expect(entityManager.addComponent).not.toHaveBeenCalledWith(
        entityId,
        DYING_COMPONENT_ID,
        expect.anything()
      );

      // Should NOT dispatch death event
      expect(eventBus.dispatch).not.toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.anything()
      );
    });

    test('should return false for entity not in dying state', () => {
      const entityId = 'healthy-entity';

      entityManager.hasComponent.mockImplementation(() => false);

      const result = deathCheckService.processDyingTurn(entityId);

      expect(result).toBe(false);
      expect(entityManager.addComponent).not.toHaveBeenCalled();
      expect(eventBus.dispatch).not.toHaveBeenCalled();
    });
  });

  describe('vital organ descendant health check', () => {
    test('should NOT trigger death when container (head) destroyed but vital organ (brain) has health > 0', () => {
      // Scenario: Head destroyed (health = 0) but brain is only scratched (32/40 = 80% health)
      // This is the bug fix scenario - death should NOT trigger
      const entityId = 'entity-with-head-destroyed';
      const headPartId = 'head-part';
      const brainPartId = 'brain-part';

      const components = {
        [headPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'head',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0, // HEAD IS DESTROYED
            maxHealth: 100,
            state: 'destroyed',
            turnsInState: 0,
          },
        },
        [brainPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'brain',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 32, // BRAIN IS SCRATCHED (80% health)
            maxHealth: 40,
            state: 'scratched',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'brain',
          },
        },
        [entityId]: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === DYING_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID && id === brainPartId)
          return true;
        if (
          comp === PART_HEALTH_COMPONENT_ID &&
          (id === headPartId || id === brainPartId)
        )
          return true;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      // Head is destroyed, brain is a descendant of head
      bodyGraphService.getAllDescendants.mockImplementation((partId) => {
        if (partId === headPartId) return [brainPartId];
        return [];
      });

      // Injury aggregation reports head as destroyed
      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [{ partEntityId: headPartId, partType: 'head' }],
        overallHealthPercentage: 79, // Above critical threshold
      });

      const result = deathCheckService.checkDeathConditions(entityId);

      // Should NOT be dead - brain has health remaining
      expect(result.isDead).toBe(false);
      expect(result.isDying).toBe(false);

      // Should NOT dispatch death event
      expect(eventBus.dispatch).not.toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.anything()
      );
    });

    test('should trigger death when container (head) AND vital organ (brain) are both destroyed', () => {
      // Scenario: Head destroyed AND brain destroyed (health = 0)
      // Death should trigger because vital organ is also destroyed
      const entityId = 'entity-with-brain-destroyed';
      const headPartId = 'head-part';
      const brainPartId = 'brain-part';

      const components = {
        [headPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'head',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0, // HEAD IS DESTROYED
            maxHealth: 100,
            state: 'destroyed',
            turnsInState: 0,
          },
        },
        [brainPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'brain',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0, // BRAIN IS ALSO DESTROYED
            maxHealth: 40,
            state: 'destroyed',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'brain',
          },
        },
        [entityId]: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
          'core:name': { text: 'Test Entity' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === DYING_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID && id === brainPartId)
          return true;
        if (
          comp === PART_HEALTH_COMPONENT_ID &&
          (id === headPartId || id === brainPartId)
        )
          return true;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      // Head is destroyed, brain is a descendant of head
      bodyGraphService.getAllDescendants.mockImplementation((partId) => {
        if (partId === headPartId) return [brainPartId];
        return [];
      });

      // Injury aggregation reports head as destroyed
      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [{ partEntityId: headPartId, partType: 'head' }],
        overallHealthPercentage: 50,
      });

      const result = deathCheckService.checkDeathConditions(
        entityId,
        'attacker-id'
      );

      // Should be dead - brain is destroyed
      expect(result.isDead).toBe(true);
      expect(result.deathInfo.vitalOrganDestroyed).toBe('brain');
      expect(result.deathInfo.killedBy).toBe('attacker-id');

      // Should dispatch death event
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.objectContaining({
          entityId,
          causeOfDeath: 'vital_organ_destroyed',
          vitalOrganDestroyed: 'brain',
        })
      );
    });

    test('should trigger death when deeply nested vital organ (spine) is destroyed along with containers', () => {
      // Scenario: Torso destroyed → Spinal column destroyed → Spine destroyed (nested vital organ)
      const entityId = 'entity-with-spine-destroyed';
      const torsoPartId = 'torso-part';
      const spinalColumnPartId = 'spinal-column-part';
      const spinePartId = 'spine-part';

      const components = {
        [torsoPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'torso',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0,
            maxHealth: 200,
            state: 'destroyed',
            turnsInState: 0,
          },
        },
        [spinalColumnPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'spinal_column',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0,
            maxHealth: 80,
            state: 'destroyed',
            turnsInState: 0,
          },
        },
        [spinePartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'spine',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0, // SPINE IS DESTROYED
            maxHealth: 50,
            state: 'destroyed',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'spine',
          },
        },
        [entityId]: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
          'core:name': { text: 'Spine Victim' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === DYING_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID && id === spinePartId)
          return true;
        if (comp === PART_HEALTH_COMPONENT_ID)
          return Boolean(components[id]?.[comp]);
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      // Torso is destroyed, descendants include spinal column and spine
      bodyGraphService.getAllDescendants.mockImplementation((partId) => {
        if (partId === torsoPartId) return [spinalColumnPartId, spinePartId];
        if (partId === spinalColumnPartId) return [spinePartId];
        return [];
      });

      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [{ partEntityId: torsoPartId, partType: 'torso' }],
        overallHealthPercentage: 30,
      });

      const result = deathCheckService.checkDeathConditions(entityId);

      // Should be dead - spine (vital organ) is destroyed
      expect(result.isDead).toBe(true);
      expect(result.deathInfo.vitalOrganDestroyed).toBe('spine');
    });

    test('should NOT trigger death when torso destroyed but nested heart has health remaining', () => {
      // Scenario: Torso destroyed but heart inside is only wounded
      const entityId = 'entity-with-wounded-heart';
      const torsoPartId = 'torso-part';
      const heartPartId = 'heart-part';

      const components = {
        [torsoPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'torso',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0, // TORSO IS DESTROYED
            maxHealth: 200,
            state: 'destroyed',
            turnsInState: 0,
          },
        },
        [heartPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'heart',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 25, // HEART IS WOUNDED (50% health)
            maxHealth: 50,
            state: 'wounded',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'heart',
          },
        },
        [entityId]: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === DYING_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID && id === heartPartId)
          return true;
        if (comp === PART_HEALTH_COMPONENT_ID)
          return Boolean(components[id]?.[comp]);
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllDescendants.mockImplementation((partId) => {
        if (partId === torsoPartId) return [heartPartId];
        return [];
      });

      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [{ partEntityId: torsoPartId, partType: 'torso' }],
        overallHealthPercentage: 60, // Above critical threshold
      });

      const result = deathCheckService.checkDeathConditions(entityId);

      // Should NOT be dead - heart has health remaining
      expect(result.isDead).toBe(false);
      expect(result.isDying).toBe(false);

      // Should NOT dispatch death event
      expect(eventBus.dispatch).not.toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.anything()
      );
    });
  });

  describe('stabilization flow', () => {
    test('should prevent death when entity is stabilized before countdown expires', () => {
      const entityId = 'stabilized-entity';

      // First, set up entity as dying
      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DYING_COMPONENT_ID && id === entityId) return true;
        return false;
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        if (comp === DYING_COMPONENT_ID && id === entityId) {
          return {
            turnsRemaining: 1, // Would die next turn if not stabilized
            causeOfDying: 'overall_health_critical',
            stabilizedBy: 'healer-entity', // Stabilized!
          };
        }
        return null;
      });

      // Process dying turn
      const result = deathCheckService.processDyingTurn(entityId);

      // Should not die (stabilized)
      expect(result).toBe(false);

      // Should NOT dispatch death event
      expect(eventBus.dispatch).not.toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.anything()
      );
    });

    test('should allow multiple dying turns to pass without death when stabilized', () => {
      const entityId = 'stabilized-entity';
      let dyingData = {
        turnsRemaining: 3,
        causeOfDying: 'overall_health_critical',
        stabilizedBy: 'healer-entity',
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DYING_COMPONENT_ID && id === entityId) return true;
        return false;
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        if (comp === DYING_COMPONENT_ID && id === entityId) {
          return dyingData;
        }
        return null;
      });

      // Process multiple turns
      for (let i = 0; i < 5; i++) {
        const result = deathCheckService.processDyingTurn(entityId);
        expect(result).toBe(false);
      }

      // Should never dispatch death event
      expect(eventBus.dispatch).not.toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.anything()
      );

      // Should never update the dying component (countdown frozen)
      expect(entityManager.addComponent).not.toHaveBeenCalled();
    });
  });
});
