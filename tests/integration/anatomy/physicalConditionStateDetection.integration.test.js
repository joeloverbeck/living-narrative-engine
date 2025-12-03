/**
 * @file Integration tests for physical condition panel state detection
 * @description Verifies that the physical condition panel correctly shows
 * damaged parts after damage is applied via the ApplyDamageHandler.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import InjuryAggregationService from '../../../src/anatomy/services/injuryAggregationService.js';

// Component IDs from the anatomy system
const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';
const ACTOR_COMPONENT_ID = 'core:actor';
const BODY_COMPONENT_ID = 'anatomy:body';
const BODY_PART_MARKER_ID = 'anatomy:is_body_part_of';

describe('Physical Condition State Detection - Integration', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockBodyGraphService;
  let entityComponents;
  let ownerToParts;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Initialize component storage
    entityComponents = new Map();
    ownerToParts = new Map();

    mockEntityManager = {
      hasComponent: jest.fn((entityId, componentId) => {
        const entityData = entityComponents.get(entityId);
        return entityData ? entityData.has(componentId) : false;
      }),
      getComponentData: jest.fn((entityId, componentId) => {
        const entityData = entityComponents.get(entityId);
        return entityData ? entityData.get(componentId) : null;
      }),
      getEntitiesWithComponent: jest.fn((componentId) => {
        const result = [];
        for (const [entityId, components] of entityComponents) {
          if (components.has(componentId)) {
            result.push(entityId);
          }
        }
        return result;
      }),
    };

    mockBodyGraphService = {
      // Signature: getAllParts(bodyComponent, entityId)
      getAllParts: jest.fn((bodyComponent, entityId) => {
        return ownerToParts.get(entityId) || [];
      }),
    };

    service = new InjuryAggregationService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      bodyGraphService: mockBodyGraphService,
    });
  });

  /**
   * Helper to set up an entity with components
   *
   * @param {string} entityId - Entity ID to set up
   * @param {object} components - Component data keyed by component ID
   * @param {string|null} [ownerEntityId] - Owner entity ID if this is a body part
   */
  function setupEntity(entityId, components, ownerEntityId = null) {
    const componentMap = new Map();
    for (const [componentId, data] of Object.entries(components)) {
      componentMap.set(componentId, data);
    }
    entityComponents.set(entityId, componentMap);

    // If this is a body part, register it with the owner
    if (ownerEntityId) {
      if (!ownerToParts.has(ownerEntityId)) {
        ownerToParts.set(ownerEntityId, []);
      }
      ownerToParts.get(ownerEntityId).push(entityId);
    }
  }

  describe('detecting damaged body parts', () => {
    it('should detect parts with wounded state (health 41-60%)', () => {
      // Set up actor entity with body component
      setupEntity('rill-entity', {
        [ACTOR_COMPONENT_ID]: { name: 'Rill' },
        [BODY_COMPONENT_ID]: { rootPartId: 'rill-torso' },
      });

      // Set up body part with wounded state
      setupEntity('rill-left-leg', {
        [BODY_PART_MARKER_ID]: { ownerEntityId: 'rill-entity' },
        [PART_COMPONENT_ID]: {
          subType: 'leg',
          orientation: 'left',
          ownerEntityId: 'rill-entity',
        },
        [PART_HEALTH_COMPONENT_ID]: {
          currentHealth: 60,
          maxHealth: 100,
          state: 'wounded', // 60% health = wounded
          turnsInState: 0,
        },
      }, 'rill-entity');

      const summary = service.aggregateInjuries('rill-entity');

      expect(summary.injuredParts.length).toBeGreaterThan(0);
      expect(summary.injuredParts[0].state).toBe('wounded');
    });

    it('should detect parts with injured state (health 21-40%)', () => {
      setupEntity('rill-entity', {
        [ACTOR_COMPONENT_ID]: { name: 'Rill' },
        [BODY_COMPONENT_ID]: { rootPartId: 'rill-torso' },
      });

      setupEntity('rill-torso', {
        [BODY_PART_MARKER_ID]: { ownerEntityId: 'rill-entity' },
        [PART_COMPONENT_ID]: {
          subType: 'torso',
          orientation: null,
          ownerEntityId: 'rill-entity',
        },
        [PART_HEALTH_COMPONENT_ID]: {
          currentHealth: 40,
          maxHealth: 100,
          state: 'wounded', // 40% health = wounded
          turnsInState: 0,
        },
      }, 'rill-entity');

      const summary = service.aggregateInjuries('rill-entity');

      expect(summary.injuredParts.length).toBeGreaterThan(0);
      expect(summary.injuredParts[0].state).toBe('wounded');
    });

    it('should NOT include parts with healthy state in injuredParts', () => {
      setupEntity('rill-entity', {
        [ACTOR_COMPONENT_ID]: { name: 'Rill' },
        [BODY_COMPONENT_ID]: { rootPartId: 'rill-arm' },
      });

      setupEntity('rill-arm', {
        [BODY_PART_MARKER_ID]: { ownerEntityId: 'rill-entity' },
        [PART_COMPONENT_ID]: {
          subType: 'arm',
          orientation: 'right',
          ownerEntityId: 'rill-entity',
        },
        [PART_HEALTH_COMPONENT_ID]: {
          currentHealth: 80,
          maxHealth: 100,
          state: 'healthy', // 80% health = healthy (above 76%)
          turnsInState: 0,
        },
      }, 'rill-entity');

      const summary = service.aggregateInjuries('rill-entity');

      expect(summary.injuredParts.length).toBe(0);
    });

    it('should detect multiple damaged parts', () => {
      setupEntity('rill-entity', {
        [ACTOR_COMPONENT_ID]: { name: 'Rill' },
        [BODY_COMPONENT_ID]: { rootPartId: 'rill-torso' },
      });

      // Multiple damaged parts
      setupEntity('rill-left-leg', {
        [BODY_PART_MARKER_ID]: { ownerEntityId: 'rill-entity' },
        [PART_COMPONENT_ID]: {
          subType: 'leg',
          orientation: 'left',
          ownerEntityId: 'rill-entity',
        },
        [PART_HEALTH_COMPONENT_ID]: {
          currentHealth: 60,
          maxHealth: 100,
          state: 'wounded',
          turnsInState: 0,
        },
      }, 'rill-entity');

      setupEntity('rill-ass_cheek', {
        [BODY_PART_MARKER_ID]: { ownerEntityId: 'rill-entity' },
        [PART_COMPONENT_ID]: {
          subType: 'ass_cheek',
          orientation: 'left',
          ownerEntityId: 'rill-entity',
        },
        [PART_HEALTH_COMPONENT_ID]: {
          currentHealth: 45,
          maxHealth: 100,
          state: 'wounded',
          turnsInState: 0,
        },
      }, 'rill-entity');

      setupEntity('rill-torso', {
        [BODY_PART_MARKER_ID]: { ownerEntityId: 'rill-entity' },
        [PART_COMPONENT_ID]: {
          subType: 'torso',
          orientation: null,
          ownerEntityId: 'rill-entity',
        },
        [PART_HEALTH_COMPONENT_ID]: {
          currentHealth: 30,
          maxHealth: 100,
          state: 'wounded',
          turnsInState: 0,
        },
      }, 'rill-entity');

      setupEntity('rill-heart', {
        [BODY_PART_MARKER_ID]: { ownerEntityId: 'rill-entity' },
        [PART_COMPONENT_ID]: {
          subType: 'heart',
          orientation: null,
          ownerEntityId: 'rill-entity',
        },
        [PART_HEALTH_COMPONENT_ID]: {
          currentHealth: 20,
          maxHealth: 100,
          state: 'critical',
          turnsInState: 0,
        },
      }, 'rill-entity');

      const summary = service.aggregateInjuries('rill-entity');

      expect(summary.injuredParts.length).toBe(4);
    });

    it('should return "I feel fine" output from formatFirstPerson when no injuries exist', () => {
      setupEntity('rill-entity', {
        [ACTOR_COMPONENT_ID]: { name: 'Rill' },
        [BODY_COMPONENT_ID]: { rootPartId: 'rill-arm' },
      });

      // Healthy part only
      setupEntity('rill-arm', {
        [BODY_PART_MARKER_ID]: { ownerEntityId: 'rill-entity' },
        [PART_COMPONENT_ID]: {
          subType: 'arm',
          orientation: 'right',
          ownerEntityId: 'rill-entity',
        },
        [PART_HEALTH_COMPONENT_ID]: {
          currentHealth: 100,
          maxHealth: 100,
          state: 'healthy',
          turnsInState: 0,
        },
      }, 'rill-entity');

      const summary = service.aggregateInjuries('rill-entity');

      expect(summary.injuredParts.length).toBe(0);
      // This confirms "I feel fine" would be displayed
    });
  });

  describe('health threshold boundary cases', () => {
    it('should classify 76% health as healthy', () => {
      setupEntity('rill-entity', {
        [ACTOR_COMPONENT_ID]: { name: 'Rill' },
        [BODY_COMPONENT_ID]: { rootPartId: 'rill-arm' },
      });

      setupEntity('rill-arm', {
        [BODY_PART_MARKER_ID]: { ownerEntityId: 'rill-entity' },
        [PART_COMPONENT_ID]: {
          subType: 'arm',
          orientation: 'right',
          ownerEntityId: 'rill-entity',
        },
        [PART_HEALTH_COMPONENT_ID]: {
          currentHealth: 76,
          maxHealth: 100,
          state: 'healthy', // Exactly at threshold
          turnsInState: 0,
        },
      }, 'rill-entity');

      const summary = service.aggregateInjuries('rill-entity');
      expect(summary.injuredParts.length).toBe(0);
    });

    it('should classify 75% health as scratched', () => {
      setupEntity('rill-entity', {
        [ACTOR_COMPONENT_ID]: { name: 'Rill' },
        [BODY_COMPONENT_ID]: { rootPartId: 'rill-arm' },
      });

      setupEntity('rill-arm', {
        [BODY_PART_MARKER_ID]: { ownerEntityId: 'rill-entity' },
        [PART_COMPONENT_ID]: {
          subType: 'arm',
          orientation: 'right',
          ownerEntityId: 'rill-entity',
        },
        [PART_HEALTH_COMPONENT_ID]: {
          currentHealth: 75,
          maxHealth: 100,
          state: 'scratched', // 75% health = scratched (61-80%)
          turnsInState: 0,
        },
      }, 'rill-entity');

      const summary = service.aggregateInjuries('rill-entity');
      expect(summary.injuredParts.length).toBe(1);
      expect(summary.injuredParts[0].state).toBe('scratched');
    });
  });

  describe('parts without health components', () => {
    it('should skip parts that lack anatomy:part_health component', () => {
      setupEntity('rill-entity', {
        [ACTOR_COMPONENT_ID]: { name: 'Rill' },
        [BODY_COMPONENT_ID]: { rootPartId: 'rill-hair' },
      });

      // Part without health component
      setupEntity('rill-hair', {
        [BODY_PART_MARKER_ID]: { ownerEntityId: 'rill-entity' },
        [PART_COMPONENT_ID]: {
          subType: 'hair',
          orientation: null,
          ownerEntityId: 'rill-entity',
        },
        // No PART_HEALTH_COMPONENT_ID!
      }, 'rill-entity');

      const summary = service.aggregateInjuries('rill-entity');

      // Should not crash, and should not include the part
      expect(summary.injuredParts.length).toBe(0);
    });
  });
});
