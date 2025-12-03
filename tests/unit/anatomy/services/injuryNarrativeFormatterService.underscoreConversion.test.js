/**
 * @file Tests for underscore-to-space conversion in body part names
 * @description Verifies that body part types with underscores (e.g., ass_cheek)
 * are displayed with spaces (e.g., ass cheek) in damage narratives.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import InjuryNarrativeFormatterService from '../../../../src/anatomy/services/injuryNarrativeFormatterService.js';

describe('InjuryNarrativeFormatterService - Underscore Conversion', () => {
  let service;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    service = new InjuryNarrativeFormatterService({
      logger: mockLogger,
    });
  });

  describe('formatFirstPerson with underscored part names', () => {
    it('should convert underscores to spaces in part names (e.g., ass_cheek)', () => {
      const summary = {
        entityId: 'entity-1',
        entityName: 'Test Entity',
        entityPronoun: 'she',
        injuredParts: [
          {
            partEntityId: 'part-1',
            partType: 'ass_cheek',
            orientation: 'left',
            state: 'wounded',
            healthPercentage: 50,
          },
        ],
        bleedingParts: [],
        burningParts: [],
        poisonedParts: [],
        fracturedParts: [],
        destroyedParts: [],
        overallHealthPercentage: 75,
        isDying: false,
        isDead: false,
      };

      const result = service.formatFirstPerson(summary);

      // Should show "left ass cheek" not "left ass_cheek"
      expect(result).toContain('ass cheek');
      expect(result).not.toContain('ass_cheek');
    });

    it('should handle multi-underscore part names (e.g., upper_arm_muscle)', () => {
      const summary = {
        entityId: 'entity-1',
        entityName: 'Test Entity',
        entityPronoun: 'they',
        injuredParts: [
          {
            partEntityId: 'part-1',
            partType: 'upper_arm_muscle',
            orientation: null,
            state: 'wounded',
            healthPercentage: 40,
          },
        ],
        bleedingParts: [],
        burningParts: [],
        poisonedParts: [],
        fracturedParts: [],
        destroyedParts: [],
        overallHealthPercentage: 80,
        isDying: false,
        isDead: false,
      };

      const result = service.formatFirstPerson(summary);

      expect(result).toContain('upper arm muscle');
      expect(result).not.toContain('_');
    });

    it('should convert underscores in destroyed part names', () => {
      const summary = {
        entityId: 'entity-1',
        entityName: 'Test Entity',
        entityPronoun: 'he',
        // Include in injuredParts to pass the early return check
        injuredParts: [
          {
            partEntityId: 'part-1',
            partType: 'left_leg',
            orientation: null,
            state: 'destroyed',
            healthPercentage: 0,
          },
        ],
        bleedingParts: [],
        burningParts: [],
        poisonedParts: [],
        fracturedParts: [],
        destroyedParts: [
          {
            partEntityId: 'part-1',
            partType: 'left_leg',
            orientation: null,
            state: 'destroyed',
            healthPercentage: 0,
          },
        ],
        overallHealthPercentage: 60,
        isDying: false,
        isDead: false,
      };

      const result = service.formatFirstPerson(summary);

      expect(result).toContain('left leg');
      expect(result).not.toContain('left_leg');
    });

    it('should convert underscores in bleeding part names', () => {
      const summary = {
        entityId: 'entity-1',
        entityName: 'Test Entity',
        entityPronoun: 'she',
        injuredParts: [
          {
            partEntityId: 'part-1',
            partType: 'right_arm',
            orientation: null,
            state: 'wounded',
            healthPercentage: 45,
          },
        ],
        bleedingParts: [
          {
            partEntityId: 'part-1',
            partType: 'right_arm',
            orientation: null,
          },
        ],
        burningParts: [],
        poisonedParts: [],
        fracturedParts: [],
        destroyedParts: [],
        overallHealthPercentage: 70,
        isDying: false,
        isDead: false,
      };

      const result = service.formatFirstPerson(summary);

      expect(result).toContain('right arm');
      expect(result).not.toContain('right_arm');
    });
  });

  describe('formatDamageEvent with underscored part names', () => {
    it('should convert underscores to spaces in damage event output', () => {
      const damageEventData = {
        entityName: 'Vespera',
        entityPronoun: 'she',
        partType: 'ass_cheek',
        orientation: 'left',
        damageType: 'blunt',
        damageAmount: 15,
        previousState: 'healthy',
        newState: 'wounded',
        effectsTriggered: [],
      };

      const result = service.formatDamageEvent(damageEventData);

      expect(result).toContain('left ass cheek');
      expect(result).not.toContain('ass_cheek');
    });

    it('should handle propagated damage with underscored part names', () => {
      const damageEventData = {
        entityName: 'Vespera',
        entityPronoun: 'she',
        partType: 'torso',
        orientation: null,
        damageType: 'piercing',
        damageAmount: 40,
        previousState: 'healthy',
        newState: 'wounded',
        effectsTriggered: [],
        propagatedDamage: [
          {
            childPartId: 'organ-1',
            childPartType: 'left_lung_lobe',
            orientation: null,
            damageApplied: 20,
            previousState: 'healthy',
            newState: 'wounded',
          },
        ],
      };

      const result = service.formatDamageEvent(damageEventData);

      expect(result).toContain('left lung lobe');
      expect(result).not.toContain('left_lung_lobe');
    });

    it('should convert underscores when part name has orientation prefix', () => {
      const damageEventData = {
        entityName: 'Rill',
        entityPronoun: 'she',
        partType: 'upper_thigh',
        orientation: 'right',
        damageType: 'slashing',
        damageAmount: 20,
        previousState: 'healthy',
        newState: 'scratched',
        effectsTriggered: [],
      };

      const result = service.formatDamageEvent(damageEventData);

      // Should produce "right upper thigh" not "right upper_thigh"
      expect(result).toContain('right upper thigh');
      expect(result).not.toContain('_');
    });

    it('should handle single-underscore part names correctly', () => {
      const damageEventData = {
        entityName: 'Test Character',
        entityPronoun: 'they',
        partType: 'body_part',
        orientation: null,
        damageType: 'piercing',
        damageAmount: 10,
        previousState: 'healthy',
        newState: 'scratched',
        effectsTriggered: [],
      };

      const result = service.formatDamageEvent(damageEventData);

      expect(result).toContain('body part');
      expect(result).not.toContain('body_part');
    });
  });
});
