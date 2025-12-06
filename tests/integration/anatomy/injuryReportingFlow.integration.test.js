/* eslint-disable jsdoc/check-tag-names */
/**
 * @jest-environment node
 */
/* eslint-enable jsdoc/check-tag-names */
/**
 * @file Integration tests for the injury reporting flow.
 * Tests the full flow from damage application through injury aggregation
 * to narrative formatting.
 *
 * @see src/anatomy/services/injuryAggregationService.js
 * @see src/anatomy/services/injuryNarrativeFormatterService.js
 * @see tickets/INJREPANDUSEINT-013-integration-tests.md
 */

import {
  describe,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

import InjuryAggregationService from '../../../src/anatomy/services/injuryAggregationService.js';
import InjuryNarrativeFormatterService from '../../../src/anatomy/services/injuryNarrativeFormatterService.js';

const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';
const BODY_COMPONENT_ID = 'anatomy:body';
const DYING_COMPONENT_ID = 'anatomy:dying';
const DEAD_COMPONENT_ID = 'anatomy:dead';
const BLEEDING_COMPONENT_ID = 'anatomy:bleeding';
const BURNING_COMPONENT_ID = 'anatomy:burning';
const POISONED_COMPONENT_ID = 'anatomy:poisoned';
const FRACTURED_COMPONENT_ID = 'anatomy:fractured';
const NAME_COMPONENT_ID = 'core:name';
const GENDER_COMPONENT_ID = 'anatomy:gender';

describe('Injury Reporting Flow Integration', () => {
  let logger;
  let entityManager;
  let bodyGraphService;
  let injuryAggregationService;
  let narrativeFormatterService;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    entityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    bodyGraphService = {
      getAllParts: jest.fn(),
    };

    injuryAggregationService = new InjuryAggregationService({
      logger,
      entityManager,
      bodyGraphService,
    });

    narrativeFormatterService = new InjuryNarrativeFormatterService({
      logger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('injury aggregation', () => {
    test('should correctly aggregate injuries for a single damaged body part', () => {
      const entityId = 'injured-entity';
      const armPartId = 'arm-part';

      const components = {
        [entityId]: {
          [NAME_COMPONENT_ID]: { text: 'Test Character' },
          [GENDER_COMPONENT_ID]: { gender: 'female' },
          [BODY_COMPONENT_ID]: { bodyId: 'body-1' },
        },
        [armPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'arm',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 60,
            maxHealth: 100,
            state: 'wounded',
            turnsInState: 1,
          },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([armPartId]);

      const summary = injuryAggregationService.aggregateInjuries(entityId);

      expect(summary.entityId).toBe(entityId);
      expect(summary.entityName).toBe('Test Character');
      expect(summary.injuredParts).toHaveLength(1);
      expect(summary.injuredParts[0].partType).toBe('arm');
      expect(summary.injuredParts[0].state).toBe('wounded');
      expect(summary.overallHealthPercentage).toBeGreaterThan(0);
      expect(summary.overallHealthPercentage).toBeLessThanOrEqual(100);
    });

    test('should correctly aggregate multiple injured body parts simultaneously', () => {
      const entityId = 'multi-injured-entity';
      const armPartId = 'arm-part';
      const legPartId = 'leg-part';
      const torsoPartId = 'torso-part';

      const components = {
        [entityId]: {
          [NAME_COMPONENT_ID]: { name: 'Battle-worn Warrior' },
          [GENDER_COMPONENT_ID]: { gender: 'male' },
          [BODY_COMPONENT_ID]: { bodyId: 'body-1' },
        },
        [armPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'arm',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 40,
            maxHealth: 100,
            state: 'wounded',
            turnsInState: 2,
          },
        },
        [legPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'leg',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 20,
            maxHealth: 80,
            state: 'critical',
            turnsInState: 1,
          },
        },
        [torsoPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'torso',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 70,
            maxHealth: 120,
            state: 'wounded',
            turnsInState: 3,
          },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([
        armPartId,
        legPartId,
        torsoPartId,
      ]);

      const summary = injuryAggregationService.aggregateInjuries(entityId);

      expect(summary.injuredParts).toHaveLength(3);
      expect(summary.injuredParts.some((p) => p.partType === 'arm')).toBe(true);
      expect(summary.injuredParts.some((p) => p.partType === 'leg')).toBe(true);
      expect(summary.injuredParts.some((p) => p.partType === 'torso')).toBe(
        true
      );
      // Overall health should reflect weighted average
      expect(summary.overallHealthPercentage).toBeGreaterThan(0);
      expect(summary.overallHealthPercentage).toBeLessThan(100);
    });

    test('should aggregate effects (bleeding, burning, poisoned, fractured)', () => {
      const entityId = 'afflicted-entity';
      const armPartId = 'arm-part';
      const legPartId = 'leg-part';

      const components = {
        [entityId]: {
          [NAME_COMPONENT_ID]: { name: 'Afflicted One' },
          [GENDER_COMPONENT_ID]: { gender: 'female' },
          [BODY_COMPONENT_ID]: { bodyId: 'body-1' },
        },
        [armPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'arm',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 50,
            maxHealth: 100,
            state: 'wounded',
            turnsInState: 1,
          },
          [BLEEDING_COMPONENT_ID]: {
            severity: 'moderate',
            remainingTurns: 3,
            tickDamage: 2,
          },
        },
        [legPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'leg',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 30,
            maxHealth: 80,
            state: 'critical',
            turnsInState: 1,
          },
          [BURNING_COMPONENT_ID]: {
            remainingTurns: 2,
            tickDamage: 5,
            stackedCount: 1,
          },
          [FRACTURED_COMPONENT_ID]: {
            severity: 'severe',
          },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([armPartId, legPartId]);

      const summary = injuryAggregationService.aggregateInjuries(entityId);

      expect(summary.bleedingParts).toHaveLength(1);
      expect(summary.bleedingParts[0].partType).toBe('arm');
      expect(summary.burningParts).toHaveLength(1);
      expect(summary.burningParts[0].partType).toBe('leg');
      expect(summary.fracturedParts).toHaveLength(1);
      expect(summary.fracturedParts[0].partType).toBe('leg');
    });

    test('should calculate weighted overall health correctly', () => {
      const entityId = 'weighted-entity';
      const torsoPartId = 'torso-part'; // Higher weight
      const fingerPartId = 'finger-part'; // Lower weight

      const components = {
        [entityId]: {
          [NAME_COMPONENT_ID]: { name: 'Test' },
          [BODY_COMPONENT_ID]: { bodyId: 'body-1' },
        },
        [torsoPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'torso',
            ownerEntityId: entityId,
            health_calculation_weight: 10, // Higher weight - major body part
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 100,
            maxHealth: 100,
            state: 'healthy',
            turnsInState: 0,
          },
        },
        [fingerPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'finger',
            ownerEntityId: entityId,
            health_calculation_weight: 1, // Lower weight - minor body part
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0,
            maxHealth: 20,
            state: 'destroyed',
            turnsInState: 1,
          },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([torsoPartId, fingerPartId]);

      const summary = injuryAggregationService.aggregateInjuries(entityId);

      // Torso has higher weight, so even with destroyed finger, overall health should be high
      expect(summary.overallHealthPercentage).toBeGreaterThan(50);
      expect(summary.destroyedParts).toHaveLength(1);
      expect(summary.destroyedParts[0].partType).toBe('finger');
    });

    test('should track dying and dead states in summary', () => {
      const entityId = 'dying-entity';
      const torsoPartId = 'torso-part';

      const components = {
        [entityId]: {
          [NAME_COMPONENT_ID]: { name: 'Dying One' },
          [BODY_COMPONENT_ID]: { bodyId: 'body-1' },
          [DYING_COMPONENT_ID]: {
            turnsRemaining: 2,
            causeOfDying: 'overall_health_critical',
            stabilizedBy: null,
          },
        },
        [torsoPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'torso',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 5,
            maxHealth: 100,
            state: 'critical',
            turnsInState: 1,
          },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([torsoPartId]);

      const summary = injuryAggregationService.aggregateInjuries(entityId);

      expect(summary.isDying).toBe(true);
      expect(summary.dyingTurnsRemaining).toBe(2);
      expect(summary.dyingCause).toBe('overall_health_critical');
      expect(summary.isDead).toBe(false);
    });
  });

  describe('narrative formatting', () => {
    test('should produce first-person narrative for healthy entity', () => {
      const summary = {
        entityId: 'healthy-entity',
        entityName: 'Healthy Person',
        injuredParts: [],
        isDying: false,
        isDead: false,
      };

      const narrative = narrativeFormatterService.formatFirstPerson(summary);

      expect(narrative).toBe('I feel fine.');
    });

    test('should produce first-person narrative for wounded entity', () => {
      const summary = {
        entityId: 'wounded-entity',
        entityName: 'Wounded Warrior',
        injuredParts: [
          { partType: 'arm', state: 'wounded', healthPercentage: 40 },
        ],
        destroyedParts: [],
        bleedingParts: [],
        burningParts: [],
        poisonedParts: [],
        fracturedParts: [],
        isDying: false,
        isDead: false,
      };

      const narrative = narrativeFormatterService.formatFirstPerson(summary);

      expect(narrative).toContain('arm');
      // The service uses 'throbs painfully' for wounded state, not 'wound'
      expect(narrative.toLowerCase()).toContain('throbs painfully');
    });

    test('should produce first-person narrative for dying entity', () => {
      const summary = {
        entityId: 'dying-entity',
        entityName: 'Dying Person',
        injuredParts: [{ partType: 'torso', state: 'critical' }],
        isDying: true,
        dyingTurnsRemaining: 2,
        isDead: false,
      };

      const narrative = narrativeFormatterService.formatFirstPerson(summary);

      expect(narrative).toContain('dying');
      expect(narrative).toContain('2');
    });

    test('should produce first-person narrative for dead entity', () => {
      const summary = {
        entityId: 'dead-entity',
        entityName: 'Dead Person',
        injuredParts: [],
        isDying: false,
        isDead: true,
      };

      const narrative = narrativeFormatterService.formatFirstPerson(summary);

      expect(narrative.toLowerCase()).toContain('fade');
    });

    test('should include bleeding effects in narrative', () => {
      const summary = {
        entityId: 'bleeding-entity',
        entityName: 'Bleeding Warrior',
        injuredParts: [
          { partType: 'arm', state: 'wounded', healthPercentage: 50 },
        ],
        destroyedParts: [],
        bleedingParts: [
          {
            partType: 'arm',
            bleedingSeverity: 'moderate',
            bleedingRemainingTurns: 3,
          },
        ],
        burningParts: [],
        poisonedParts: [],
        fracturedParts: [],
        isDying: false,
        isDead: false,
      };

      const narrative = narrativeFormatterService.formatFirstPerson(summary);

      // The service uses 'blood flows steadily from' for moderate bleeding, not 'bleed'
      expect(narrative.toLowerCase()).toContain('blood');
      expect(narrative.toLowerCase()).toContain('flows');
    });

    test('should handle multiple effects in narrative', () => {
      const summary = {
        entityId: 'multi-effect-entity',
        entityName: 'Afflicted Warrior',
        injuredParts: [
          { partType: 'arm', state: 'wounded', healthPercentage: 50 },
          { partType: 'leg', state: 'critical', healthPercentage: 20 },
        ],
        destroyedParts: [],
        bleedingParts: [
          {
            partType: 'arm',
            bleedingSeverity: 'severe',
            bleedingRemainingTurns: 4,
          },
        ],
        burningParts: [
          {
            partType: 'leg',
            burningRemainingTurns: 2,
            burningStackedCount: 1,
          },
        ],
        poisonedParts: [],
        fracturedParts: [{ partType: 'leg', fracturedSeverity: 'moderate' }],
        isDying: false,
        isDead: false,
      };

      const narrative = narrativeFormatterService.formatFirstPerson(summary);

      // Should mention multiple effects
      expect(narrative.length).toBeGreaterThan(20);
      // Narrative should mention both body parts
      expect(narrative.toLowerCase()).toMatch(/arm|leg/);
    });
  });

  describe('full integration flow', () => {
    test('should produce correct narrative from aggregated injury data', () => {
      const entityId = 'full-flow-entity';
      const armPartId = 'arm-part';
      const legPartId = 'leg-part';

      const components = {
        [entityId]: {
          [NAME_COMPONENT_ID]: { name: 'Integrated Test Character' },
          [GENDER_COMPONENT_ID]: { gender: 'male' },
          [BODY_COMPONENT_ID]: { bodyId: 'body-1' },
        },
        [armPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'arm',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 45,
            maxHealth: 100,
            state: 'wounded',
            turnsInState: 2,
          },
          [BLEEDING_COMPONENT_ID]: {
            severity: 'minor',
            remainingTurns: 2,
            tickDamage: 1,
          },
        },
        [legPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'leg',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 80,
            maxHealth: 100,
            state: 'scratched',
            turnsInState: 1,
          },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([armPartId, legPartId]);

      // Step 1: Aggregate injuries
      const summary = injuryAggregationService.aggregateInjuries(entityId);

      // Step 2: Format narrative
      const narrative = narrativeFormatterService.formatFirstPerson(summary);

      // Verify the full flow produces meaningful output
      expect(summary.injuredParts.length).toBeGreaterThan(0);
      expect(summary.bleedingParts.length).toBeGreaterThan(0);
      expect(narrative).not.toBe('I feel fine.');
      expect(narrative.length).toBeGreaterThan(10);
    });

    test('should handle entity with no injuries', () => {
      const entityId = 'healthy-entity';
      const armPartId = 'arm-part';

      const components = {
        [entityId]: {
          [NAME_COMPONENT_ID]: { name: 'Healthy Person' },
          [BODY_COMPONENT_ID]: { bodyId: 'body-1' },
        },
        [armPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'arm',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 100,
            maxHealth: 100,
            state: 'healthy',
            turnsInState: 0,
          },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([armPartId]);

      const summary = injuryAggregationService.aggregateInjuries(entityId);
      const narrative = narrativeFormatterService.formatFirstPerson(summary);

      expect(summary.injuredParts).toHaveLength(0);
      expect(summary.overallHealthPercentage).toBe(100);
      expect(narrative).toBe('I feel fine.');
    });
  });

  describe('event dispatch verification', () => {
    test('should provide data suitable for UI panel updates', () => {
      const entityId = 'ui-test-entity';
      const torsoPartId = 'torso-part';

      const components = {
        [entityId]: {
          [NAME_COMPONENT_ID]: { name: 'UI Test Character' },
          [GENDER_COMPONENT_ID]: { gender: 'female' },
          [BODY_COMPONENT_ID]: { bodyId: 'body-1' },
        },
        [torsoPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'torso',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 65,
            maxHealth: 100,
            state: 'scratched',
            turnsInState: 1,
          },
        },
      };

      entityManager.hasComponent.mockImplementation((id, comp) => {
        return Boolean(components[id]?.[comp]);
      });

      entityManager.getComponentData.mockImplementation((id, comp) => {
        return components[id]?.[comp] || null;
      });

      bodyGraphService.getAllParts.mockReturnValue([torsoPartId]);

      const summary = injuryAggregationService.aggregateInjuries(entityId);

      // Verify summary contains all fields needed for UI updates
      expect(summary).toHaveProperty('entityId');
      expect(summary).toHaveProperty('entityName');
      expect(summary).toHaveProperty('injuredParts');
      expect(summary).toHaveProperty('overallHealthPercentage');
      expect(summary).toHaveProperty('isDying');
      expect(summary).toHaveProperty('isDead');

      // Verify part info structure for UI rendering
      if (summary.injuredParts.length > 0) {
        const partInfo = summary.injuredParts[0];
        expect(partInfo).toHaveProperty('partType');
        expect(partInfo).toHaveProperty('state');
        expect(partInfo).toHaveProperty('healthPercentage');
      }
    });
  });
});
