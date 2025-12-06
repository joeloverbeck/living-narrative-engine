/* eslint-disable jsdoc/check-tag-names */
/**
 * @jest-environment node
 */
/* eslint-enable jsdoc/check-tag-names */
/**
 * @file Integration tests for physical condition narrative improvements (PHYCONNARIMP).
 * Tests the specific fixes from tickets PHYCONNARIMP-001 through PHYCONNARIMP-005:
 * - SPEC-001: Duplicate part deduplication
 * - SPEC-002: Dismembered parts filtering from health states
 * - SPEC-003: Dismemberment priority ordering
 * - SPEC-004: Bleeding grouping by severity
 * @see src/anatomy/services/injuryAggregationService.js
 * @see src/anatomy/services/injuryNarrativeFormatterService.js
 * @see specs/physical-condition-narrative-improvements.md
 * @see tickets/PHYCONNARIMP-006-integration-tests.md
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
const BLEEDING_COMPONENT_ID = 'anatomy:bleeding';
const NAME_COMPONENT_ID = 'core:name';
const GENDER_COMPONENT_ID = 'anatomy:gender';
const DISMEMBERED_COMPONENT_ID = 'anatomy:dismembered';

describe('Physical Condition Narrative Improvements (PHYCONNARIMP)', () => {
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

  describe('comprehensive injury scenario', () => {
    test('should format complex injury state correctly (SPEC-001 through SPEC-004)', () => {
      // Test: Entity with dismembered, destroyed, critical, wounded parts + bleeding
      // Verifies: output order, no duplicates, bleeding grouped
      const entityId = 'complex-injury-entity';
      const earPartId = 'ear-part';
      const fingerPartId = 'finger-part';
      const torsoPartId = 'torso-part';
      const headPartId = 'head-part';

      const components = {
        [entityId]: {
          [NAME_COMPONENT_ID]: { text: 'Test Character' },
          [GENDER_COMPONENT_ID]: { gender: 'female' },
          [BODY_COMPONENT_ID]: { bodyId: 'body-1' },
        },
        [earPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'ear',
            orientation: 'right',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0,
            maxHealth: 20,
            state: 'destroyed',
            turnsInState: 1,
          },
          [DISMEMBERED_COMPONENT_ID]: {
            dismemberedAt: Date.now(),
          },
        },
        [fingerPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'finger',
            orientation: 'left',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0,
            maxHealth: 10,
            state: 'destroyed',
            turnsInState: 1,
          },
        },
        [torsoPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'torso',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 10,
            maxHealth: 100,
            state: 'critical',
            turnsInState: 1,
          },
          [BLEEDING_COMPONENT_ID]: {
            severity: 'moderate',
            remainingTurns: 3,
            tickDamage: 2,
          },
        },
        [headPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'head',
            orientation: 'upper',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 40,
            maxHealth: 80,
            state: 'wounded',
            turnsInState: 1,
          },
          [BLEEDING_COMPONENT_ID]: {
            severity: 'moderate',
            remainingTurns: 3,
            tickDamage: 2,
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
        earPartId,
        fingerPartId,
        torsoPartId,
        headPartId,
      ]);

      // Execute the flow
      const summary = injuryAggregationService.aggregateInjuries(entityId);
      const narrative = narrativeFormatterService.formatFirstPerson(summary);

      // Verify output order: dismemberment → destroyed → critical → wounded → bleeding
      const missingPos = narrative.indexOf('is missing');
      const numbPos = narrative.indexOf('is completely numb');
      const agonyPos = narrative.indexOf('screams with agony');
      const throbsPos = narrative.indexOf('throbs painfully');
      const bloodPos = narrative.indexOf('Blood');

      // Dismemberment should be first - verify "is missing" appears before "is completely numb"
      // Both positions are expected to be valid (not -1) in this test scenario
      expect(missingPos).toBeGreaterThanOrEqual(0);
      expect(numbPos).toBeGreaterThanOrEqual(0);
      expect(missingPos).toBeLessThan(numbPos);

      // Destroyed before critical
      expect(numbPos).toBeLessThan(agonyPos);
      // Critical before wounded
      expect(agonyPos).toBeLessThan(throbsPos);
      // Health states before effects
      expect(throbsPos).toBeLessThan(bloodPos);

      // Verify no duplicates - right ear should appear only once
      const rightEarMatches = narrative.match(/right ear/gi) || [];
      expect(rightEarMatches.length).toBeLessThanOrEqual(1);

      // Verify bleeding is grouped with "and" (only first part gets "my")
      expect(narrative).toMatch(
        /Blood flows steadily from my torso and upper head\./
      );
    });

    test('should handle the exact problematic scenario from spec', () => {
      // This is the exact regression test from the bug report
      // Input: Right ear dismembered, torso critical+bleeding, upper head wounded+bleeding, brain scratched
      const entityId = 'spec-scenario-entity';
      const earPartId = 'ear-part';
      const torsoPartId = 'torso-part';
      const headPartId = 'head-part';
      const brainPartId = 'brain-part';

      const components = {
        [entityId]: {
          [NAME_COMPONENT_ID]: { text: 'Test Character' },
          [GENDER_COMPONENT_ID]: { gender: 'male' },
          [BODY_COMPONENT_ID]: { bodyId: 'body-1' },
        },
        [earPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'ear',
            orientation: 'right',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0,
            maxHealth: 20,
            state: 'destroyed',
            turnsInState: 1,
          },
          [DISMEMBERED_COMPONENT_ID]: {
            dismemberedAt: Date.now(),
          },
        },
        [torsoPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'torso',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 10,
            maxHealth: 100,
            state: 'critical',
            turnsInState: 1,
          },
          [BLEEDING_COMPONENT_ID]: {
            severity: 'moderate',
            remainingTurns: 3,
            tickDamage: 2,
          },
        },
        [headPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'head',
            orientation: 'upper',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 40,
            maxHealth: 80,
            state: 'wounded',
            turnsInState: 1,
          },
          [BLEEDING_COMPONENT_ID]: {
            severity: 'moderate',
            remainingTurns: 3,
            tickDamage: 2,
          },
        },
        [brainPartId]: {
          [PART_COMPONENT_ID]: {
            subType: 'brain',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 90,
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

      bodyGraphService.getAllParts.mockReturnValue([
        earPartId,
        torsoPartId,
        headPartId,
        brainPartId,
      ]);

      // Execute the flow
      const summary = injuryAggregationService.aggregateInjuries(entityId);
      const narrative = narrativeFormatterService.formatFirstPerson(summary);

      // Expected exact output from spec (only first bleeding part gets "my"):
      // "My right ear is missing. My torso screams with agony. My upper head throbs painfully.
      //  My brain stings slightly. Blood flows steadily from my torso and upper head."
      expect(narrative).toBe(
        'My right ear is missing. My torso screams with agony. My upper head throbs painfully. My brain stings slightly. Blood flows steadily from my torso and upper head.'
      );
    });
  });

  describe('dismembered parts edge cases', () => {
    test('should filter dismembered parts from bleeding output (Scenario 4)', () => {
      // Edge case: Dismembered arm with bleeding should NOT show bleeding for that arm
      // Expected: Only "My left arm is missing." - NO bleeding for dismembered
      const entityId = 'dismembered-bleeding-entity';
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
            orientation: 'left',
            ownerEntityId: entityId,
          },
          [PART_HEALTH_COMPONENT_ID]: {
            currentHealth: 0,
            maxHealth: 100,
            state: 'destroyed',
            turnsInState: 1,
          },
          [DISMEMBERED_COMPONENT_ID]: {
            dismemberedAt: Date.now(),
          },
          [BLEEDING_COMPONENT_ID]: {
            severity: 'severe',
            remainingTurns: 5,
            tickDamage: 5,
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

      // Execute the flow
      const summary = injuryAggregationService.aggregateInjuries(entityId);
      const narrative = narrativeFormatterService.formatFirstPerson(summary);

      // Should mention dismemberment
      expect(narrative).toContain('My left arm is missing.');

      // Should NOT mention bleeding for the dismembered arm
      // The narrative should not contain "Blood" since the only bleeding part is dismembered
      expect(narrative).not.toMatch(/Blood.*left arm/i);

      // The narrative should be clean - just the dismemberment
      expect(narrative).toBe('My left arm is missing.');
    });
  });
});
