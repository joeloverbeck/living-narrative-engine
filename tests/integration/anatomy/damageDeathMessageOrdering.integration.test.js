/* eslint-disable jsdoc/check-tag-names */
/**
 * @jest-environment node
 */
/* eslint-enable jsdoc/check-tag-names */
/**
 * @file Integration tests for damage/death event message ordering
 * Verifies that when lethal damage is applied:
 * 1. Injury/damage events are dispatched FIRST
 * 2. Death events are dispatched LAST
 * This ensures UI messages appear in the correct narrative order:
 * "X's head suffers damage..." → "X dies from head trauma..."
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
const DEAD_COMPONENT_ID = 'anatomy:dead';
const VITAL_ORGAN_COMPONENT_ID = 'anatomy:vital_organ';
const POSITION_COMPONENT_ID = 'core:position';

describe('Damage/Death Message Ordering', () => {
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
  /** @type {Array<{type: string, eventType: string, timestamp: number}>} */
  let eventLog;

  beforeEach(() => {
    eventLog = [];
    let eventCounter = 0;

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

    // Track event dispatch order
    dispatcher = {
      dispatch: jest.fn((eventType, payload) => {
        eventLog.push({
          type: 'dispatcher',
          eventType,
          perceptionType: payload?.perceptionType || null,
          timestamp: eventCounter++,
        });
        return Promise.resolve(true);
      }),
    };

    eventBus = {
      dispatch: jest.fn((eventType, payload) => {
        eventLog.push({
          type: 'eventBus',
          eventType,
          perceptionType: payload?.perceptionType || null,
          timestamp: eventCounter++,
        });
        return Promise.resolve(true);
      }),
    };

    jsonLogicService = { evaluate: jest.fn() };
    bodyGraphService = {
      getAllParts: jest.fn(),
      getAllDescendants: jest.fn().mockReturnValue([]),
    };
    damageTypeEffectsService = { applyEffectsForDamage: jest.fn() };
    damagePropagationService = { propagateDamage: jest.fn().mockReturnValue([]) };
    injuryAggregationService = {
      aggregateInjuries: jest.fn().mockReturnValue({ destroyedParts: [] }),
    };

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

  describe('event ordering when damage causes death', () => {
    test('should dispatch damage_received event BEFORE entity_died event', async () => {
      const params = {
        entity_ref: 'rooster-entity',
        part_ref: 'rooster-head',
        amount: 100,
        damage_type: 'piercing',
      };

      const executionContext = {
        evaluationContext: { context: {} },
        logger: log,
        actorId: 'attacker-id',
      };

      // Setup: rooster with a vital organ (brain) that will be destroyed
      const components = {
        'rooster-head': {
          [PART_COMPONENT_ID]: {
            subType: 'head',
            ownerEntityId: 'rooster-entity',
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 50,
            maxHealth: 100,
            state: 'healthy',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'brain',  // Must match IMMEDIATE_DEATH_ORGANS list
          },
        },
        'rooster-entity': {
          [BODY_COMPONENT_ID]: { bodyId: 'rooster-body' },
          [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
        },
        'attacker-id': {
          [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID && id === 'rooster-head')
          return true;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue(['rooster-head']);

      // Vital organ is destroyed by damage
      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [{ partEntityId: 'rooster-head', partType: 'brain' }],
      });

      await handler.execute(params, executionContext);

      // Find the damage event and death event in the log
      const damageEvent = eventLog.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.perceptionType === 'damage_received'
      );
      const deathEvent = eventLog.find(
        (e) => e.eventType === 'anatomy:entity_died'
      );

      // Both events should have been dispatched
      expect(damageEvent).toBeDefined();
      expect(deathEvent).toBeDefined();

      // CRITICAL ASSERTION: Damage event must come BEFORE death event
      expect(damageEvent.timestamp).toBeLessThan(deathEvent.timestamp);
    });

    test('should dispatch injury narrative before death narrative when vital organ destroyed', async () => {
      const params = {
        entity_ref: 'entity1',
        part_ref: 'brain-part',
        amount: 200,
        damage_type: 'slashing',
      };

      const executionContext = {
        evaluationContext: { context: {} },
        logger: log,
        actorId: 'attacker',
      };

      const components = {
        'brain-part': {
          [PART_COMPONENT_ID]: {
            subType: 'brain',
            ownerEntityId: 'entity1',
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 100,
            maxHealth: 100,
            state: 'healthy',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'brain',
          },
        },
        entity1: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
          [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
        },
        attacker: {
          [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID && id === 'brain-part') return true;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue(['brain-part']);

      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [{ partEntityId: 'brain-part', partType: 'brain' }],
      });

      await handler.execute(params, executionContext);

      // Get all events in order
      const sortedEvents = [...eventLog].sort((a, b) => a.timestamp - b.timestamp);

      // Find indices
      const damageIndex = sortedEvents.findIndex(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.perceptionType === 'damage_received'
      );
      const deathIndex = sortedEvents.findIndex(
        (e) => e.eventType === 'anatomy:entity_died'
      );

      // Verify both exist
      expect(damageIndex).toBeGreaterThanOrEqual(0);
      expect(deathIndex).toBeGreaterThanOrEqual(0);

      // Verify correct ordering
      expect(damageIndex).toBeLessThan(deathIndex);
    });

    test('should maintain correct order with multiple damage propagations', async () => {
      const params = {
        entity_ref: 'entity1',
        part_ref: 'head-part',
        amount: 150,
        damage_type: 'piercing',
      };

      const executionContext = {
        evaluationContext: { context: {} },
        logger: log,
        actorId: 'attacker',
      };

      const components = {
        'head-part': {
          [PART_COMPONENT_ID]: {
            subType: 'head',
            ownerEntityId: 'entity1',
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 100,
            maxHealth: 100,
            state: 'healthy',
            turnsInState: 0,
          },
        },
        'brain-part': {
          [PART_COMPONENT_ID]: {
            subType: 'brain',
            ownerEntityId: 'entity1',
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
        entity1: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
          [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
        },
        attacker: {
          [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID && id === 'brain-part') return true;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue(['head-part', 'brain-part']);

      // Simulate damage propagation from head to brain (both damaged)
      damagePropagationService.propagateDamage.mockReturnValue([
        {
          partEntityId: 'brain-part',
          amount: 75,
          damageType: 'piercing',
          source: 'propagation',
        },
      ]);

      // Brain is destroyed → death
      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [{ partEntityId: 'brain-part', partType: 'brain' }],
      });

      await handler.execute(params, executionContext);

      const sortedEvents = [...eventLog].sort((a, b) => a.timestamp - b.timestamp);

      // Find the LAST damage event and the death event
      const damageEvents = sortedEvents.filter(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.perceptionType === 'damage_received'
      );
      const deathEvent = sortedEvents.find(
        (e) => e.eventType === 'anatomy:entity_died'
      );

      expect(damageEvents.length).toBeGreaterThan(0);
      expect(deathEvent).toBeDefined();

      // ALL damage events should come before the death event
      for (const damageEvent of damageEvents) {
        expect(damageEvent.timestamp).toBeLessThan(deathEvent.timestamp);
      }
    });
  });

  describe('non-lethal damage scenarios', () => {
    test('should dispatch damage events without death event when damage is non-lethal', async () => {
      const params = {
        entity_ref: 'entity1',
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
          [POSITION_COMPONENT_ID]: { locationId: 'test-location' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID) return false;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue(['arm-part']);

      // No destroyed parts - non-lethal damage
      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [],
      });

      await handler.execute(params, executionContext);

      // Should have damage event
      const damageEvent = eventLog.find(
        (e) =>
          e.eventType === 'core:perceptible_event' &&
          e.perceptionType === 'damage_received'
      );
      expect(damageEvent).toBeDefined();

      // Should NOT have death event
      const deathEvent = eventLog.find(
        (e) => e.eventType === 'anatomy:entity_died'
      );
      expect(deathEvent).toBeUndefined();
    });
  });
});
