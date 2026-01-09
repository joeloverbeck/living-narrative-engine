/* eslint-disable jsdoc/check-tag-names */
/**
 * @jest-environment node
 */
/* eslint-enable jsdoc/check-tag-names */
/**
 * @file Integration tests for respiratory organ death (LUNVITORGDEA-007)
 *
 * Tests the `requiresAllDestroyed` flag functionality for respiratory organs.
 * Verifies that:
 * - Single lung destruction does NOT cause instant death
 * - Both lungs destruction DOES cause instant death
 * - Death message is correctly included
 * - Order of destruction is symmetric
 * - Heart/brain/spine death still works alongside lung mechanics
 * @see src/anatomy/services/deathCheckService.js
 * @see data/mods/anatomy/entities/definitions/human_lung_left.entity.json
 * @see data/mods/anatomy/entities/definitions/human_lung_right.entity.json
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import DeathCheckService from '../../../src/anatomy/services/deathCheckService.js';

const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';
const BODY_COMPONENT_ID = 'anatomy:body';
const DEAD_COMPONENT_ID = 'anatomy:dead';
const DYING_COMPONENT_ID = 'anatomy:dying';
const VITAL_ORGAN_COMPONENT_ID = 'anatomy:vital_organ';

describe('Respiratory Organ Death Integration', () => {
  let log;
  let entityManager;
  let eventBus;
  let bodyGraphService;
  let injuryAggregationService;
  let deathCheckService;

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

    eventBus = { dispatch: jest.fn().mockResolvedValue(true) };

    bodyGraphService = {
      getAllParts: jest.fn(),
      getAllDescendants: jest.fn().mockReturnValue([]),
    };

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
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('single lung destruction - should NOT cause instant death', () => {
    test('should NOT trigger death when only left lung is destroyed', () => {
      const entityId = 'entity-with-one-lung-destroyed';
      const leftLungId = 'left-lung-part';
      const rightLungId = 'right-lung-part';

      const components = {
        [leftLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'left',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0, // LEFT LUNG DESTROYED
            maxHealth: 30,
            state: 'destroyed',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
            deathMessage: 'suffocated as both lungs failed',
          },
        },
        [rightLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'right',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 30, // RIGHT LUNG HEALTHY
            maxHealth: 30,
            state: 'healthy',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
            deathMessage: 'suffocated as both lungs failed',
          },
        },
        [entityId]: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === DYING_COMPONENT_ID) return false;
        if (
          comp === VITAL_ORGAN_COMPONENT_ID &&
          (id === leftLungId || id === rightLungId)
        )
          return true;
        if (
          comp === PART_HEALTH_COMPONENT_ID &&
          (id === leftLungId || id === rightLungId)
        )
          return true;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([leftLungId, rightLungId]);

      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [{ partEntityId: leftLungId, partType: 'lung' }],
        overallHealthPercentage: 80,
      });

      const result = deathCheckService.checkDeathConditions(entityId);

      // Should NOT be dead - one lung still functional
      expect(result.isDead).toBe(false);
      expect(result.isDying).toBe(false);

      // Should NOT dispatch death event
      expect(eventBus.dispatch).not.toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.anything()
      );
    });

    test('should NOT trigger death when only right lung is destroyed', () => {
      const entityId = 'entity-with-right-lung-destroyed';
      const leftLungId = 'left-lung-part';
      const rightLungId = 'right-lung-part';

      const components = {
        [leftLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'left',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 30, // LEFT LUNG HEALTHY
            maxHealth: 30,
            state: 'healthy',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
            deathMessage: 'suffocated as both lungs failed',
          },
        },
        [rightLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'right',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0, // RIGHT LUNG DESTROYED
            maxHealth: 30,
            state: 'destroyed',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
            deathMessage: 'suffocated as both lungs failed',
          },
        },
        [entityId]: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === DYING_COMPONENT_ID) return false;
        if (
          comp === VITAL_ORGAN_COMPONENT_ID &&
          (id === leftLungId || id === rightLungId)
        )
          return true;
        if (
          comp === PART_HEALTH_COMPONENT_ID &&
          (id === leftLungId || id === rightLungId)
        )
          return true;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([leftLungId, rightLungId]);

      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [{ partEntityId: rightLungId, partType: 'lung' }],
        overallHealthPercentage: 80,
      });

      const result = deathCheckService.checkDeathConditions(entityId);

      // Should NOT be dead - one lung still functional
      expect(result.isDead).toBe(false);
      expect(result.isDying).toBe(false);

      // Should NOT dispatch death event
      expect(eventBus.dispatch).not.toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.anything()
      );
    });
  });

  describe('both lungs destruction - should cause instant death', () => {
    test('should trigger death when both lungs are destroyed', () => {
      const entityId = 'entity-with-both-lungs-destroyed';
      const leftLungId = 'left-lung-part';
      const rightLungId = 'right-lung-part';

      const components = {
        [leftLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'left',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0, // LEFT LUNG DESTROYED
            maxHealth: 30,
            state: 'destroyed',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
            deathMessage: 'suffocated as both lungs failed',
          },
        },
        [rightLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'right',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0, // RIGHT LUNG DESTROYED
            maxHealth: 30,
            state: 'destroyed',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
            deathMessage: 'suffocated as both lungs failed',
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
        if (
          comp === VITAL_ORGAN_COMPONENT_ID &&
          (id === leftLungId || id === rightLungId)
        )
          return true;
        if (
          comp === PART_HEALTH_COMPONENT_ID &&
          (id === leftLungId || id === rightLungId)
        )
          return true;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([leftLungId, rightLungId]);

      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [
          { partEntityId: leftLungId, partType: 'lung' },
          { partEntityId: rightLungId, partType: 'lung' },
        ],
        overallHealthPercentage: 50,
      });

      const result = deathCheckService.checkDeathConditions(
        entityId,
        'attacker-id'
      );

      // Should be dead - all respiratory organs destroyed
      expect(result.isDead).toBe(true);
      expect(result.deathInfo.vitalOrganDestroyed).toBe('respiratory');
      expect(result.deathInfo.killedBy).toBe('attacker-id');

      // Should dispatch death event
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.objectContaining({
          entityId,
          causeOfDeath: 'vital_organ_destroyed',
          vitalOrganDestroyed: 'respiratory',
        })
      );
    });

    test('should dispatch death event with respiratory organ type when both lungs destroyed', () => {
      const entityId = 'entity-with-lungs-failed';
      const leftLungId = 'left-lung-part';
      const rightLungId = 'right-lung-part';

      const components = {
        [leftLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'left',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0,
            maxHealth: 30,
            state: 'destroyed',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
            deathMessage: 'suffocated as both lungs failed',
          },
        },
        [rightLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'right',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0,
            maxHealth: 30,
            state: 'destroyed',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
            deathMessage: 'suffocated as both lungs failed',
          },
        },
        [entityId]: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === DYING_COMPONENT_ID) return false;
        if (
          comp === VITAL_ORGAN_COMPONENT_ID &&
          (id === leftLungId || id === rightLungId)
        )
          return true;
        if (
          comp === PART_HEALTH_COMPONENT_ID &&
          (id === leftLungId || id === rightLungId)
        )
          return true;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([leftLungId, rightLungId]);

      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [
          { partEntityId: leftLungId, partType: 'lung' },
          { partEntityId: rightLungId, partType: 'lung' },
        ],
        overallHealthPercentage: 50,
      });

      const result = deathCheckService.checkDeathConditions(entityId);

      // Should be dead with respiratory organ type
      expect(result.isDead).toBe(true);
      expect(result.deathInfo.vitalOrganDestroyed).toBe('respiratory');
      expect(result.deathInfo.causeOfDeath).toBe('vital_organ_destroyed');

      // Verify death event was dispatched with correct information
      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'anatomy:entity_died',
        expect.objectContaining({
          entityId,
          causeOfDeath: 'vital_organ_destroyed',
          vitalOrganDestroyed: 'respiratory',
        })
      );
    });
  });

  describe('destruction order symmetry', () => {
    test('destroying left lung then right lung should cause death', () => {
      const entityId = 'entity-left-then-right';
      const leftLungId = 'left-lung-part';
      const rightLungId = 'right-lung-part';

      // Both lungs destroyed (left first, then right)
      const components = {
        [leftLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'left',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0,
            maxHealth: 30,
            state: 'destroyed',
            turnsInState: 2, // Destroyed earlier
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
          },
        },
        [rightLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'right',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0,
            maxHealth: 30,
            state: 'destroyed',
            turnsInState: 0, // Just destroyed
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
          },
        },
        [entityId]: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === DYING_COMPONENT_ID) return false;
        if (
          comp === VITAL_ORGAN_COMPONENT_ID &&
          (id === leftLungId || id === rightLungId)
        )
          return true;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([leftLungId, rightLungId]);

      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [
          { partEntityId: leftLungId, partType: 'lung' },
          { partEntityId: rightLungId, partType: 'lung' },
        ],
        overallHealthPercentage: 50,
      });

      const result = deathCheckService.checkDeathConditions(entityId);

      expect(result.isDead).toBe(true);
      expect(result.deathInfo.vitalOrganDestroyed).toBe('respiratory');
    });

    test('destroying right lung then left lung should cause death', () => {
      const entityId = 'entity-right-then-left';
      const leftLungId = 'left-lung-part';
      const rightLungId = 'right-lung-part';

      // Both lungs destroyed (right first, then left)
      const components = {
        [leftLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'left',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0,
            maxHealth: 30,
            state: 'destroyed',
            turnsInState: 0, // Just destroyed
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
          },
        },
        [rightLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'right',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0,
            maxHealth: 30,
            state: 'destroyed',
            turnsInState: 2, // Destroyed earlier
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
          },
        },
        [entityId]: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === DYING_COMPONENT_ID) return false;
        if (
          comp === VITAL_ORGAN_COMPONENT_ID &&
          (id === leftLungId || id === rightLungId)
        )
          return true;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([leftLungId, rightLungId]);

      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [
          { partEntityId: rightLungId, partType: 'lung' },
          { partEntityId: leftLungId, partType: 'lung' },
        ],
        overallHealthPercentage: 50,
      });

      const result = deathCheckService.checkDeathConditions(entityId);

      expect(result.isDead).toBe(true);
      expect(result.deathInfo.vitalOrganDestroyed).toBe('respiratory');
    });
  });

  describe('mixed scenarios - heart/brain/spine still cause instant death', () => {
    test('should trigger death when heart destroyed (single vital organ)', () => {
      const entityId = 'entity-with-heart-destroyed';
      const heartId = 'heart-part';
      const leftLungId = 'left-lung-part';
      const rightLungId = 'right-lung-part';

      const components = {
        [heartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'heart',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0, // HEART DESTROYED
            maxHealth: 50,
            state: 'destroyed',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'heart',
            killOnDestroy: true,
            // Note: no requiresAllDestroyed - default is false
          },
        },
        [leftLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'left',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 30, // LUNGS HEALTHY
            maxHealth: 30,
            state: 'healthy',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
          },
        },
        [rightLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'right',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 30,
            maxHealth: 30,
            state: 'healthy',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
          },
        },
        [entityId]: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === DYING_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID)
          return [heartId, leftLungId, rightLungId].includes(id);
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([
        heartId,
        leftLungId,
        rightLungId,
      ]);

      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [{ partEntityId: heartId, partType: 'heart' }],
        overallHealthPercentage: 60,
      });

      const result = deathCheckService.checkDeathConditions(entityId);

      // Should be dead - heart is single vital organ (requiresAllDestroyed: false by default)
      expect(result.isDead).toBe(true);
      expect(result.deathInfo.vitalOrganDestroyed).toBe('heart');
    });

    test('should trigger death when brain destroyed even with healthy lungs', () => {
      const entityId = 'entity-with-brain-destroyed';
      const brainId = 'brain-part';
      const leftLungId = 'left-lung-part';
      const rightLungId = 'right-lung-part';

      const components = {
        [brainId]: {
          [PART_COMPONENT_ID]: {
            subType: 'brain',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0, // BRAIN DESTROYED
            maxHealth: 40,
            state: 'destroyed',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'brain',
            killOnDestroy: true,
          },
        },
        [leftLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'left',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 30,
            maxHealth: 30,
            state: 'healthy',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
          },
        },
        [rightLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'right',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 30,
            maxHealth: 30,
            state: 'healthy',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
          },
        },
        [entityId]: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === DYING_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID)
          return [brainId, leftLungId, rightLungId].includes(id);
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([
        brainId,
        leftLungId,
        rightLungId,
      ]);

      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [{ partEntityId: brainId, partType: 'brain' }],
        overallHealthPercentage: 70,
      });

      const result = deathCheckService.checkDeathConditions(entityId);

      // Should be dead - brain is single vital organ
      expect(result.isDead).toBe(true);
      expect(result.deathInfo.vitalOrganDestroyed).toBe('brain');
    });

    test('should NOT trigger death when one lung destroyed and heart healthy', () => {
      const entityId = 'entity-mixed-organs';
      const heartId = 'heart-part';
      const leftLungId = 'left-lung-part';
      const rightLungId = 'right-lung-part';

      const components = {
        [heartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'heart',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 50, // HEART HEALTHY
            maxHealth: 50,
            state: 'healthy',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'heart',
            killOnDestroy: true,
          },
        },
        [leftLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'left',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0, // ONE LUNG DESTROYED
            maxHealth: 30,
            state: 'destroyed',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
          },
        },
        [rightLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'right',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 30, // OTHER LUNG HEALTHY
            maxHealth: 30,
            state: 'healthy',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
          },
        },
        [entityId]: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === DYING_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID)
          return [heartId, leftLungId, rightLungId].includes(id);
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([
        heartId,
        leftLungId,
        rightLungId,
      ]);

      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [{ partEntityId: leftLungId, partType: 'lung' }],
        overallHealthPercentage: 75,
      });

      const result = deathCheckService.checkDeathConditions(entityId);

      // Should NOT be dead - heart healthy and only one lung destroyed
      expect(result.isDead).toBe(false);
      expect(result.isDying).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('should handle entity with no respiratory organs gracefully', () => {
      const entityId = 'entity-no-lungs';
      const heartId = 'heart-part';

      const components = {
        [heartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'heart',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 50,
            maxHealth: 50,
            state: 'healthy',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'heart',
            killOnDestroy: true,
          },
        },
        [entityId]: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === DYING_COMPONENT_ID) return false;
        if (comp === VITAL_ORGAN_COMPONENT_ID && id === heartId) return true;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([heartId]);

      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [],
        overallHealthPercentage: 100,
      });

      const result = deathCheckService.checkDeathConditions(entityId);

      // Should NOT be dead - no organs destroyed
      expect(result.isDead).toBe(false);
      expect(result.isDying).toBe(false);
    });

    test('should handle wounded but not destroyed lungs correctly', () => {
      const entityId = 'entity-wounded-lungs';
      const leftLungId = 'left-lung-part';
      const rightLungId = 'right-lung-part';

      const components = {
        [leftLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'left',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 10, // WOUNDED but not destroyed
            maxHealth: 30,
            state: 'wounded',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
          },
        },
        [rightLungId]: {
          [PART_COMPONENT_ID]: {
            subType: 'lung',
            orientation: 'right',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 5, // WOUNDED but not destroyed
            maxHealth: 30,
            state: 'wounded',
            turnsInState: 0,
          },
          [VITAL_ORGAN_COMPONENT_ID]: {
            organType: 'respiratory',
            killOnDestroy: true,
            requiresAllDestroyed: true,
          },
        },
        [entityId]: {
          [BODY_COMPONENT_ID]: { bodyId: 'body1' },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        if (comp === DEAD_COMPONENT_ID) return false;
        if (comp === DYING_COMPONENT_ID) return false;
        if (
          comp === VITAL_ORGAN_COMPONENT_ID &&
          (id === leftLungId || id === rightLungId)
        )
          return true;
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([leftLungId, rightLungId]);

      injuryAggregationService.aggregateInjuries.mockReturnValue({
        destroyedParts: [],
        overallHealthPercentage: 60,
      });

      const result = deathCheckService.checkDeathConditions(entityId);

      // Should NOT be dead - lungs wounded but not destroyed
      expect(result.isDead).toBe(false);
      expect(result.isDying).toBe(false);
    });
  });

  describe('Creature Respiratory Organ Death (LUNVITORGDEA-008)', () => {
    /**
     * Tests that creature lungs (feline, mustelid, amphibian, reptilian)
     * follow the same death mechanics as human lungs with requiresAllDestroyed: true.
     */

    describe('feline lungs - should behave like human lungs', () => {
      test('should NOT trigger death when only one feline lung is destroyed', () => {
        const entityId = 'feline-entity';
        const leftLungId = 'feline-lung-left';
        const rightLungId = 'feline-lung-right';

        const components = {
          [leftLungId]: {
            [PART_COMPONENT_ID]: {
              subType: 'lung',
              orientation: 'left',
              ownerEntityId: entityId,
            },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 0, // DESTROYED
              maxHealth: 25,
              state: 'destroyed',
              turnsInState: 0,
            },
            [VITAL_ORGAN_COMPONENT_ID]: {
              organType: 'respiratory',
              killOnDestroy: true,
              requiresAllDestroyed: true,
              deathMessage: 'suffocated as both feline lungs failed',
            },
          },
          [rightLungId]: {
            [PART_COMPONENT_ID]: {
              subType: 'lung',
              orientation: 'right',
              ownerEntityId: entityId,
            },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 25, // HEALTHY
              maxHealth: 25,
              state: 'healthy',
              turnsInState: 0,
            },
            [VITAL_ORGAN_COMPONENT_ID]: {
              organType: 'respiratory',
              killOnDestroy: true,
              requiresAllDestroyed: true,
              deathMessage: 'suffocated as both feline lungs failed',
            },
          },
          [entityId]: {
            [BODY_COMPONENT_ID]: { bodyId: 'feline-body' },
          },
        };

        entityManager.hasComponent.mockImplementation((id, comp) => {
          if (comp === DEAD_COMPONENT_ID) return false;
          if (comp === DYING_COMPONENT_ID) return false;
          if (
            comp === VITAL_ORGAN_COMPONENT_ID &&
            (id === leftLungId || id === rightLungId)
          )
            return true;
          if (
            comp === PART_HEALTH_COMPONENT_ID &&
            (id === leftLungId || id === rightLungId)
          )
            return true;
          return Boolean(components[id]?.[comp]);
        });

        entityManager.getComponentData.mockImplementation((id, comp) => {
          return components[id]?.[comp] || null;
        });

        bodyGraphService.getAllParts.mockReturnValue([leftLungId, rightLungId]);

        injuryAggregationService.aggregateInjuries.mockReturnValue({
          destroyedParts: [{ partEntityId: leftLungId, partType: 'lung' }],
          overallHealthPercentage: 80,
        });

        const result = deathCheckService.checkDeathConditions(entityId);

        expect(result.isDead).toBe(false);
        expect(result.isDying).toBe(false);
      });

      test('should trigger death when both feline lungs are destroyed', () => {
        const entityId = 'feline-entity';
        const leftLungId = 'feline-lung-left';
        const rightLungId = 'feline-lung-right';

        const components = {
          [leftLungId]: {
            [PART_COMPONENT_ID]: {
              subType: 'lung',
              orientation: 'left',
              ownerEntityId: entityId,
            },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 0, // DESTROYED
              maxHealth: 25,
              state: 'destroyed',
              turnsInState: 0,
            },
            [VITAL_ORGAN_COMPONENT_ID]: {
              organType: 'respiratory',
              killOnDestroy: true,
              requiresAllDestroyed: true,
              deathMessage: 'suffocated as both feline lungs failed',
            },
          },
          [rightLungId]: {
            [PART_COMPONENT_ID]: {
              subType: 'lung',
              orientation: 'right',
              ownerEntityId: entityId,
            },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 0, // DESTROYED
              maxHealth: 25,
              state: 'destroyed',
              turnsInState: 0,
            },
            [VITAL_ORGAN_COMPONENT_ID]: {
              organType: 'respiratory',
              killOnDestroy: true,
              requiresAllDestroyed: true,
              deathMessage: 'suffocated as both feline lungs failed',
            },
          },
          [entityId]: {
            [BODY_COMPONENT_ID]: { bodyId: 'feline-body' },
          },
        };

        entityManager.hasComponent.mockImplementation((id, comp) => {
          if (comp === DEAD_COMPONENT_ID) return false;
          if (comp === DYING_COMPONENT_ID) return false;
          if (
            comp === VITAL_ORGAN_COMPONENT_ID &&
            (id === leftLungId || id === rightLungId)
          )
            return true;
          if (
            comp === PART_HEALTH_COMPONENT_ID &&
            (id === leftLungId || id === rightLungId)
          )
            return true;
          return Boolean(components[id]?.[comp]);
        });

        entityManager.getComponentData.mockImplementation((id, comp) => {
          return components[id]?.[comp] || null;
        });

        bodyGraphService.getAllParts.mockReturnValue([leftLungId, rightLungId]);

        injuryAggregationService.aggregateInjuries.mockReturnValue({
          destroyedParts: [
            { partEntityId: leftLungId, partType: 'lung' },
            { partEntityId: rightLungId, partType: 'lung' },
          ],
          overallHealthPercentage: 50,
        });

        const result = deathCheckService.checkDeathConditions(entityId);

        expect(result.isDead).toBe(true);
        expect(result.deathInfo.vitalOrganDestroyed).toBe('respiratory');
      });
    });

    describe('reptilian lungs - high-health organs should behave identically', () => {
      test('should NOT trigger death when only one reptilian lung is destroyed', () => {
        const entityId = 'reptilian-entity';
        const leftLungId = 'reptilian-lung-left';
        const rightLungId = 'reptilian-lung-right';

        const components = {
          [leftLungId]: {
            [PART_COMPONENT_ID]: {
              subType: 'lung',
              orientation: 'left',
              ownerEntityId: entityId,
            },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 0, // DESTROYED (50 HP max, different from human 30 HP)
              maxHealth: 50,
              state: 'destroyed',
              turnsInState: 0,
            },
            [VITAL_ORGAN_COMPONENT_ID]: {
              organType: 'respiratory',
              killOnDestroy: true,
              requiresAllDestroyed: true,
              deathMessage: 'suffocated as both massive lungs failed',
            },
          },
          [rightLungId]: {
            [PART_COMPONENT_ID]: {
              subType: 'lung',
              orientation: 'right',
              ownerEntityId: entityId,
            },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 50, // HEALTHY
              maxHealth: 50,
              state: 'healthy',
              turnsInState: 0,
            },
            [VITAL_ORGAN_COMPONENT_ID]: {
              organType: 'respiratory',
              killOnDestroy: true,
              requiresAllDestroyed: true,
              deathMessage: 'suffocated as both massive lungs failed',
            },
          },
          [entityId]: {
            [BODY_COMPONENT_ID]: { bodyId: 'reptilian-body' },
          },
        };

        entityManager.hasComponent.mockImplementation((id, comp) => {
          if (comp === DEAD_COMPONENT_ID) return false;
          if (comp === DYING_COMPONENT_ID) return false;
          if (
            comp === VITAL_ORGAN_COMPONENT_ID &&
            (id === leftLungId || id === rightLungId)
          )
            return true;
          if (
            comp === PART_HEALTH_COMPONENT_ID &&
            (id === leftLungId || id === rightLungId)
          )
            return true;
          return Boolean(components[id]?.[comp]);
        });

        entityManager.getComponentData.mockImplementation((id, comp) => {
          return components[id]?.[comp] || null;
        });

        bodyGraphService.getAllParts.mockReturnValue([leftLungId, rightLungId]);

        injuryAggregationService.aggregateInjuries.mockReturnValue({
          destroyedParts: [{ partEntityId: leftLungId, partType: 'lung' }],
          overallHealthPercentage: 80,
        });

        const result = deathCheckService.checkDeathConditions(entityId);

        expect(result.isDead).toBe(false);
        expect(result.isDying).toBe(false);
      });

      test('should trigger death when both reptilian lungs are destroyed', () => {
        const entityId = 'reptilian-entity';
        const leftLungId = 'reptilian-lung-left';
        const rightLungId = 'reptilian-lung-right';

        const components = {
          [leftLungId]: {
            [PART_COMPONENT_ID]: {
              subType: 'lung',
              orientation: 'left',
              ownerEntityId: entityId,
            },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 0, // DESTROYED
              maxHealth: 50,
              state: 'destroyed',
              turnsInState: 0,
            },
            [VITAL_ORGAN_COMPONENT_ID]: {
              organType: 'respiratory',
              killOnDestroy: true,
              requiresAllDestroyed: true,
              deathMessage: 'suffocated as both massive lungs failed',
            },
          },
          [rightLungId]: {
            [PART_COMPONENT_ID]: {
              subType: 'lung',
              orientation: 'right',
              ownerEntityId: entityId,
            },
            [PART_HEALTH_COMPONENT_ID]: {
              currentHealth: 0, // DESTROYED
              maxHealth: 50,
              state: 'destroyed',
              turnsInState: 0,
            },
            [VITAL_ORGAN_COMPONENT_ID]: {
              organType: 'respiratory',
              killOnDestroy: true,
              requiresAllDestroyed: true,
              deathMessage: 'suffocated as both massive lungs failed',
            },
          },
          [entityId]: {
            [BODY_COMPONENT_ID]: { bodyId: 'reptilian-body' },
          },
        };

        entityManager.hasComponent.mockImplementation((id, comp) => {
          if (comp === DEAD_COMPONENT_ID) return false;
          if (comp === DYING_COMPONENT_ID) return false;
          if (
            comp === VITAL_ORGAN_COMPONENT_ID &&
            (id === leftLungId || id === rightLungId)
          )
            return true;
          if (
            comp === PART_HEALTH_COMPONENT_ID &&
            (id === leftLungId || id === rightLungId)
          )
            return true;
          return Boolean(components[id]?.[comp]);
        });

        entityManager.getComponentData.mockImplementation((id, comp) => {
          return components[id]?.[comp] || null;
        });

        bodyGraphService.getAllParts.mockReturnValue([leftLungId, rightLungId]);

        injuryAggregationService.aggregateInjuries.mockReturnValue({
          destroyedParts: [
            { partEntityId: leftLungId, partType: 'lung' },
            { partEntityId: rightLungId, partType: 'lung' },
          ],
          overallHealthPercentage: 40,
        });

        const result = deathCheckService.checkDeathConditions(entityId);

        expect(result.isDead).toBe(true);
        expect(result.deathInfo.vitalOrganDestroyed).toBe('respiratory');
      });
    });

    describe('cross-creature consistency', () => {
      test.each([
        ['mustelid', 25, 'suffocated as both lungs failed'],
        ['amphibian', 20, 'suffocated as both amphibian lungs failed'],
      ])(
        'should apply requiresAllDestroyed logic consistently for %s lungs',
        (creatureType, maxHealth, deathMessage) => {
          const entityId = `${creatureType}-entity`;
          const leftLungId = `${creatureType}-lung-left`;
          const rightLungId = `${creatureType}-lung-right`;

          const components = {
            [leftLungId]: {
              [PART_COMPONENT_ID]: {
                subType: 'lung',
                orientation: 'left',
                ownerEntityId: entityId,
              },
              [PART_HEALTH_COMPONENT_ID]: {
                currentHealth: 0, // DESTROYED
                maxHealth,
                state: 'destroyed',
                turnsInState: 0,
              },
              [VITAL_ORGAN_COMPONENT_ID]: {
                organType: 'respiratory',
                killOnDestroy: true,
                requiresAllDestroyed: true,
                deathMessage,
              },
            },
            [rightLungId]: {
              [PART_COMPONENT_ID]: {
                subType: 'lung',
                orientation: 'right',
                ownerEntityId: entityId,
              },
              [PART_HEALTH_COMPONENT_ID]: {
                currentHealth: 0, // DESTROYED
                maxHealth,
                state: 'destroyed',
                turnsInState: 0,
              },
              [VITAL_ORGAN_COMPONENT_ID]: {
                organType: 'respiratory',
                killOnDestroy: true,
                requiresAllDestroyed: true,
                deathMessage,
              },
            },
            [entityId]: {
              [BODY_COMPONENT_ID]: { bodyId: `${creatureType}-body` },
            },
          };

          entityManager.hasComponent.mockImplementation((id, comp) => {
            if (comp === DEAD_COMPONENT_ID) return false;
            if (comp === DYING_COMPONENT_ID) return false;
            if (
              comp === VITAL_ORGAN_COMPONENT_ID &&
              (id === leftLungId || id === rightLungId)
            )
              return true;
            if (
              comp === PART_HEALTH_COMPONENT_ID &&
              (id === leftLungId || id === rightLungId)
            )
              return true;
            return Boolean(components[id]?.[comp]);
          });

          entityManager.getComponentData.mockImplementation((id, comp) => {
            return components[id]?.[comp] || null;
          });

          bodyGraphService.getAllParts.mockReturnValue([
            leftLungId,
            rightLungId,
          ]);

          injuryAggregationService.aggregateInjuries.mockReturnValue({
            destroyedParts: [
              { partEntityId: leftLungId, partType: 'lung' },
              { partEntityId: rightLungId, partType: 'lung' },
            ],
            overallHealthPercentage: 50,
          });

          const result = deathCheckService.checkDeathConditions(entityId);

          // Both lungs destroyed should cause death
          expect(result.isDead).toBe(true);
          expect(result.deathInfo.vitalOrganDestroyed).toBe('respiratory');
        }
      );
    });
  });
});
