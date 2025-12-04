/**
 * @file Unit tests for DamageNarrativeComposer service.
 * @see src/anatomy/services/damageNarrativeComposer.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DamageNarrativeComposer from '../../../../src/anatomy/services/damageNarrativeComposer.js';

describe('DamageNarrativeComposer', () => {
  let composer;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    composer = new DamageNarrativeComposer({ logger: mockLogger });
  });

  describe('constructor', () => {
    it('should create an instance successfully', () => {
      expect(composer).toBeDefined();
    });
  });

  describe('compose', () => {
    describe('edge cases', () => {
      it('should return empty string for null entries', () => {
        const result = composer.compose(null);

        expect(result).toBe('');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('compose called with empty entries')
        );
      });

      it('should return empty string for undefined entries', () => {
        const result = composer.compose(undefined);

        expect(result).toBe('');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('compose called with empty entries')
        );
      });

      it('should return empty string for empty array', () => {
        const result = composer.compose([]);

        expect(result).toBe('');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('compose called with empty entries')
        );
      });

      it('should return empty string when no primary entry exists', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'brain-id',
            partType: 'brain',
            orientation: null,
            damageType: 'piercing',
            propagatedFrom: 'head-id', // All entries are propagated
            effectsTriggered: [],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toBe('');
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('No primary damage entry found')
        );
      });
    });

    describe('primary damage only', () => {
      it('should compose simple primary damage', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'leg-id',
            partType: 'leg',
            orientation: 'left',
            damageType: 'slashing',
            propagatedFrom: null,
            effectsTriggered: [],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toBe("Rill's left leg suffers slashing damage.");
      });

      it('should compose primary damage without orientation', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Marcus',
            entityPossessive: 'his',
            partId: 'torso-id',
            partType: 'torso',
            orientation: null,
            damageType: 'bludgeoning',
            propagatedFrom: null,
            effectsTriggered: [],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toBe("Marcus's torso suffers bludgeoning damage.");
      });

      it('should compose primary damage with single effect', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'arm-id',
            partType: 'arm',
            orientation: 'right',
            damageType: 'slashing',
            propagatedFrom: null,
            effectsTriggered: ['bleeding'],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toBe(
          "Rill's right arm suffers slashing damage and is bleeding."
        );
      });

      it('should compose primary damage with dismemberment effect', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'leg-id',
            partType: 'leg',
            orientation: 'left',
            damageType: 'slashing',
            propagatedFrom: null,
            effectsTriggered: ['dismembered'],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toBe(
          "Rill's left leg suffers slashing damage and flies off in an arc."
        );
      });

      it('should compose primary damage with multiple effects', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'arm-id',
            partType: 'arm',
            orientation: 'left',
            damageType: 'fire',
            propagatedFrom: null,
            effectsTriggered: ['burning', 'bleeding'],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toBe(
          "Rill's left arm suffers fire damage and is burning and is bleeding."
        );
      });

      it('should handle unknown effects gracefully', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'leg-id',
            partType: 'leg',
            orientation: null,
            damageType: 'slashing',
            propagatedFrom: null,
            effectsTriggered: ['unknown_effect', 'bleeding'],
          },
        ];

        const result = composer.compose(entries);

        // Unknown effect is filtered out
        expect(result).toBe("Rill's leg suffers slashing damage and is bleeding.");
      });

      it('should handle part types with underscores', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'upper-arm-id',
            partType: 'upper_arm',
            orientation: 'left',
            damageType: 'piercing',
            propagatedFrom: null,
            effectsTriggered: [],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toBe("Rill's left upper arm suffers piercing damage.");
      });
    });

    describe('propagated damage', () => {
      it('should compose primary + single propagated damage', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'head-id',
            partType: 'head',
            orientation: null,
            damageType: 'piercing',
            propagatedFrom: null,
            effectsTriggered: [],
          },
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'brain-id',
            partType: 'brain',
            orientation: null,
            damageType: 'piercing',
            propagatedFrom: 'head-id',
            effectsTriggered: [],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toBe(
          "Rill's head suffers piercing damage. As a result, her brain suffers piercing damage."
        );
      });

      it('should compose primary + multiple propagated damage (same type)', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'head-id',
            partType: 'head',
            orientation: null,
            damageType: 'piercing',
            propagatedFrom: null,
            effectsTriggered: [],
          },
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'brain-id',
            partType: 'brain',
            orientation: null,
            damageType: 'piercing',
            propagatedFrom: 'head-id',
            effectsTriggered: [],
          },
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'left-eye-id',
            partType: 'eye',
            orientation: 'left',
            damageType: 'piercing',
            propagatedFrom: 'head-id',
            effectsTriggered: [],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toBe(
          "Rill's head suffers piercing damage. As a result, her brain and left eye suffer piercing damage."
        );
      });

      it('should compose propagated damage with effects', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'head-id',
            partType: 'head',
            orientation: null,
            damageType: 'piercing',
            propagatedFrom: null,
            effectsTriggered: ['bleeding'],
          },
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'brain-id',
            partType: 'brain',
            orientation: null,
            damageType: 'piercing',
            propagatedFrom: 'head-id',
            effectsTriggered: ['fractured'],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toBe(
          "Rill's head suffers piercing damage and is bleeding. As a result, her brain suffers piercing damage and is fractured."
        );
      });

      it('should use singular verb for single propagated part', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Marcus',
            entityPossessive: 'his',
            partId: 'chest-id',
            partType: 'chest',
            orientation: null,
            damageType: 'bludgeoning',
            propagatedFrom: null,
            effectsTriggered: [],
          },
          {
            entityId: 'entity-1',
            entityName: 'Marcus',
            entityPossessive: 'his',
            partId: 'heart-id',
            partType: 'heart',
            orientation: null,
            damageType: 'bludgeoning',
            propagatedFrom: 'chest-id',
            effectsTriggered: [],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toContain('his heart suffers bludgeoning damage');
      });

      it('should use plural verb for multiple propagated parts', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Marcus',
            entityPossessive: 'his',
            partId: 'chest-id',
            partType: 'chest',
            orientation: null,
            damageType: 'bludgeoning',
            propagatedFrom: null,
            effectsTriggered: [],
          },
          {
            entityId: 'entity-1',
            entityName: 'Marcus',
            entityPossessive: 'his',
            partId: 'heart-id',
            partType: 'heart',
            orientation: null,
            damageType: 'bludgeoning',
            propagatedFrom: 'chest-id',
            effectsTriggered: [],
          },
          {
            entityId: 'entity-1',
            entityName: 'Marcus',
            entityPossessive: 'his',
            partId: 'lung-id',
            partType: 'lung',
            orientation: 'left',
            damageType: 'bludgeoning',
            propagatedFrom: 'chest-id',
            effectsTriggered: [],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toContain('his heart and left lung suffer bludgeoning damage');
      });
    });

    describe('part list formatting', () => {
      it('should format two parts with "and"', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'torso-id',
            partType: 'torso',
            orientation: null,
            damageType: 'fire',
            propagatedFrom: null,
            effectsTriggered: [],
          },
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'lung1-id',
            partType: 'lung',
            orientation: 'left',
            damageType: 'fire',
            propagatedFrom: 'torso-id',
            effectsTriggered: [],
          },
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'lung2-id',
            partType: 'lung',
            orientation: 'right',
            damageType: 'fire',
            propagatedFrom: 'torso-id',
            effectsTriggered: [],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toContain('her left lung and right lung suffer fire damage');
      });

      it('should format three+ parts with Oxford comma', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'head-id',
            partType: 'head',
            orientation: null,
            damageType: 'piercing',
            propagatedFrom: null,
            effectsTriggered: [],
          },
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'brain-id',
            partType: 'brain',
            orientation: null,
            damageType: 'piercing',
            propagatedFrom: 'head-id',
            effectsTriggered: [],
          },
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'left-eye-id',
            partType: 'eye',
            orientation: 'left',
            damageType: 'piercing',
            propagatedFrom: 'head-id',
            effectsTriggered: [],
          },
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'right-eye-id',
            partType: 'eye',
            orientation: 'right',
            damageType: 'piercing',
            propagatedFrom: 'head-id',
            effectsTriggered: [],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toContain(
          'her brain, left eye, and right eye suffer piercing damage'
        );
      });
    });

    describe('effect descriptions', () => {
      it('should map bleeding effect correctly', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'arm-id',
            partType: 'arm',
            orientation: null,
            damageType: 'slashing',
            propagatedFrom: null,
            effectsTriggered: ['bleeding'],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toContain('is bleeding');
      });

      it('should map burning effect correctly', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'arm-id',
            partType: 'arm',
            orientation: null,
            damageType: 'fire',
            propagatedFrom: null,
            effectsTriggered: ['burning'],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toContain('is burning');
      });

      it('should map poisoned effect correctly', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'arm-id',
            partType: 'arm',
            orientation: null,
            damageType: 'poison',
            propagatedFrom: null,
            effectsTriggered: ['poisoned'],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toContain('is poisoned');
      });

      it('should map fractured effect correctly', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'arm-id',
            partType: 'arm',
            orientation: null,
            damageType: 'bludgeoning',
            propagatedFrom: null,
            effectsTriggered: ['fractured'],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toContain('is fractured');
      });

      it('should map dismembered effect correctly', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'arm-id',
            partType: 'arm',
            orientation: null,
            damageType: 'slashing',
            propagatedFrom: null,
            effectsTriggered: ['dismembered'],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toContain('flies off in an arc');
      });

      it('should aggregate effects from multiple propagated entries', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'head-id',
            partType: 'head',
            orientation: null,
            damageType: 'slashing',
            propagatedFrom: null,
            effectsTriggered: [],
          },
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'left-eye-id',
            partType: 'eye',
            orientation: 'left',
            damageType: 'slashing',
            propagatedFrom: 'head-id',
            effectsTriggered: ['bleeding'],
          },
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'right-eye-id',
            partType: 'eye',
            orientation: 'right',
            damageType: 'slashing',
            propagatedFrom: 'head-id',
            effectsTriggered: ['dismembered'],
          },
        ];

        const result = composer.compose(entries);

        // Both effects should appear in the propagation sentence
        expect(result).toContain('is bleeding');
        expect(result).toContain('flies off in an arc');
      });
    });

    describe('possessive pronouns', () => {
      it('should use "her" for female entities', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'head-id',
            partType: 'head',
            orientation: null,
            damageType: 'piercing',
            propagatedFrom: null,
            effectsTriggered: [],
          },
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'brain-id',
            partType: 'brain',
            orientation: null,
            damageType: 'piercing',
            propagatedFrom: 'head-id',
            effectsTriggered: [],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toContain('her brain suffers');
      });

      it('should use "his" for male entities', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Marcus',
            entityPossessive: 'his',
            partId: 'head-id',
            partType: 'head',
            orientation: null,
            damageType: 'piercing',
            propagatedFrom: null,
            effectsTriggered: [],
          },
          {
            entityId: 'entity-1',
            entityName: 'Marcus',
            entityPossessive: 'his',
            partId: 'brain-id',
            partType: 'brain',
            orientation: null,
            damageType: 'piercing',
            propagatedFrom: 'head-id',
            effectsTriggered: [],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toContain('his brain suffers');
      });

      it('should use "their" for neutral entities', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Entity',
            entityPossessive: 'their',
            partId: 'head-id',
            partType: 'head',
            orientation: null,
            damageType: 'piercing',
            propagatedFrom: null,
            effectsTriggered: [],
          },
          {
            entityId: 'entity-1',
            entityName: 'Entity',
            entityPossessive: 'their',
            partId: 'brain-id',
            partType: 'brain',
            orientation: null,
            damageType: 'piercing',
            propagatedFrom: 'head-id',
            effectsTriggered: [],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toContain('their brain suffers');
      });
    });

    describe('integration scenarios', () => {
      it('should handle complete damage sequence with all features', () => {
        const entries = [
          {
            entityId: 'entity-123',
            entityName: 'Rill',
            entityPronoun: 'she',
            entityPossessive: 'her',
            partId: 'head-part-id',
            partType: 'head',
            orientation: null,
            amount: 30,
            damageType: 'piercing',
            propagatedFrom: null,
            effectsTriggered: ['bleeding'],
          },
          {
            entityId: 'entity-123',
            entityName: 'Rill',
            entityPronoun: 'she',
            entityPossessive: 'her',
            partId: 'brain-part-id',
            partType: 'brain',
            orientation: null,
            amount: 15,
            damageType: 'piercing',
            propagatedFrom: 'head-part-id',
            effectsTriggered: ['fractured'],
          },
          {
            entityId: 'entity-123',
            entityName: 'Rill',
            entityPronoun: 'she',
            entityPossessive: 'her',
            partId: 'left-eye-part-id',
            partType: 'eye',
            orientation: 'left',
            amount: 10,
            damageType: 'piercing',
            propagatedFrom: 'head-part-id',
            effectsTriggered: ['dismembered'],
          },
        ];

        const result = composer.compose(entries);

        // Primary damage with effect
        expect(result).toContain("Rill's head suffers piercing damage and is bleeding.");

        // Propagated damage with combined sentence
        expect(result).toContain('As a result, her brain and left eye suffer piercing damage');

        // Effects from propagated entries
        expect(result).toContain('is fractured');
        expect(result).toContain('flies off in an arc');
      });

      it('should handle damage with mixed orientations', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Fighter',
            entityPossessive: 'his',
            partId: 'torso-id',
            partType: 'torso',
            orientation: null,
            damageType: 'slashing',
            propagatedFrom: null,
            effectsTriggered: [],
          },
          {
            entityId: 'entity-1',
            entityName: 'Fighter',
            entityPossessive: 'his',
            partId: 'left-lung-id',
            partType: 'lung',
            orientation: 'left',
            damageType: 'slashing',
            propagatedFrom: 'torso-id',
            effectsTriggered: [],
          },
          {
            entityId: 'entity-1',
            entityName: 'Fighter',
            entityPossessive: 'his',
            partId: 'heart-id',
            partType: 'heart',
            orientation: null,
            damageType: 'slashing',
            propagatedFrom: 'torso-id',
            effectsTriggered: [],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toContain("Fighter's torso suffers slashing damage.");
        expect(result).toContain('his left lung and heart suffer slashing damage');
      });

      it('should handle missing effectsTriggered array in entry', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'head-id',
            partType: 'head',
            orientation: null,
            damageType: 'piercing',
            propagatedFrom: null,
            // effectsTriggered is missing
          },
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'brain-id',
            partType: 'brain',
            orientation: null,
            damageType: 'piercing',
            propagatedFrom: 'head-id',
            // effectsTriggered is missing
          },
        ];

        // Should not throw
        const result = composer.compose(entries);

        expect(result).toBe(
          "Rill's head suffers piercing damage. As a result, her brain suffers piercing damage."
        );
      });

      it('should handle missing partType gracefully', () => {
        const entries = [
          {
            entityId: 'entity-1',
            entityName: 'Rill',
            entityPossessive: 'her',
            partId: 'unknown-id',
            partType: null,
            orientation: null,
            damageType: 'slashing',
            propagatedFrom: null,
            effectsTriggered: [],
          },
        ];

        const result = composer.compose(entries);

        expect(result).toBe("Rill's body part suffers slashing damage.");
      });
    });
  });
});
