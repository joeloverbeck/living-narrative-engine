import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import InjuryNarrativeFormatterService from '../../../../src/anatomy/services/injuryNarrativeFormatterService.js';
import {
  getFirstPersonDescription,
  getStateOrder,
} from '../../../../src/anatomy/registries/healthStateRegistry.js';

jest.mock('../../../../src/anatomy/registries/healthStateRegistry.js', () => {
  const original = jest.requireActual(
    '../../../../src/anatomy/registries/healthStateRegistry.js'
  );
  return {
    ...original,
    getFirstPersonDescription: jest.fn(original.getFirstPersonDescription),
    getStateOrder: jest.fn(original.getStateOrder),
  };
});

describe('InjuryNarrativeFormatterService', () => {
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

  describe('constructor', () => {
    it('should initialize with logger dependency', () => {
      expect(service).toBeDefined();
    });

    it('should throw if logger is missing', () => {
      expect(() => new InjuryNarrativeFormatterService({})).toThrow();
    });

    it('should throw if dependencies object is undefined', () => {
      expect(() => new InjuryNarrativeFormatterService()).toThrow();
    });
  });

  describe('formatFirstPerson', () => {
    describe('edge cases', () => {
      it('should return default message for null summary', () => {
        const result = service.formatFirstPerson(null);
        expect(result).toBe('I feel fine.');
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it('should return default message for undefined summary', () => {
        const result = service.formatFirstPerson(undefined);
        expect(result).toBe('I feel fine.');
      });

      it('should return default message for healthy entity with no injuries', () => {
        const summary = {
          entityId: 'entity-1',
          entityName: 'Test Entity',
          entityPronoun: 'he',
          injuredParts: [],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          destroyedParts: [],
          overallHealthPercentage: 100,
          isDying: false,
          dyingTurnsRemaining: null,
          dyingCause: null,
          isDead: false,
          causeOfDeath: null,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toBe('I feel fine.');
      });

      it('should return default message when injuredParts is undefined', () => {
        const summary = {
          entityId: 'entity-1',
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toBe('I feel fine.');
      });
    });

    describe('dead state', () => {
      it('should return death message when isDead is true', () => {
        const summary = {
          entityId: 'entity-1',
          isDead: true,
          causeOfDeath: 'vital_organ_destroyed',
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toBe('Everything fades to black...');
      });
    });

    describe('dying state', () => {
      it('should return dying message with multiple turns', () => {
        const summary = {
          entityId: 'entity-1',
          isDying: true,
          dyingTurnsRemaining: 3,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toBe(
          'I am dying. Without help, I have only 3 moments left...'
        );
      });

      it('should return dying message with single turn', () => {
        const summary = {
          entityId: 'entity-1',
          isDying: true,
          dyingTurnsRemaining: 1,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toBe(
          'I am dying. Without help, I have only moment left...'
        );
      });
    });

    describe('state-to-adjective mappings', () => {
      it('should use registry for descriptions', () => {
        const summary = createSummaryWithInjury('scratched');
        service.formatFirstPerson(summary);
        expect(getFirstPersonDescription).toHaveBeenCalledWith('scratched');
        expect(getStateOrder).toHaveBeenCalled();
      });

      it('should format scratched state correctly', () => {
        const summary = createSummaryWithInjury('scratched');
        const result = service.formatFirstPerson(summary);
        expect(result).toContain('stings slightly');
      });

      it('should format wounded state correctly', () => {
        const summary = createSummaryWithInjury('wounded');
        const result = service.formatFirstPerson(summary);
        expect(result).toContain('throbs painfully');
      });

      it('should format injured state correctly', () => {
        const summary = createSummaryWithInjury('injured');
        const result = service.formatFirstPerson(summary);
        expect(result).toContain('aches deeply');
      });

      it('should format critical state correctly', () => {
        const summary = createSummaryWithInjury('critical');
        const result = service.formatFirstPerson(summary);
        expect(result).toContain('screams with agony');
      });

      it('should format destroyed state correctly', () => {
        const summary = createSummaryWithDestroyed();
        const result = service.formatFirstPerson(summary);
        expect(result).toContain('is completely numb');
      });
    });

    describe('part name formatting', () => {
      it('should include orientation in part name', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'wounded',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          destroyedParts: [],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toContain('left arm');
      });

      it('should handle parts without orientation', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'torso',
              orientation: null,
              state: 'wounded',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          destroyedParts: [],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toContain('torso');
        expect(result).not.toContain('null');
      });
    });

    describe('duplicate part deduplication', () => {
      it('should not duplicate destroyed parts in output', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        const armCount = (result.match(/left arm/g) || []).length;
        expect(armCount).toBe(1);
      });

      it('should handle multiple destroyed parts without duplication', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
            {
              partEntityId: 'part-2',
              partType: 'ear',
              orientation: 'right',
              state: 'destroyed',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
            {
              partEntityId: 'part-2',
              partType: 'ear',
              orientation: 'right',
              state: 'destroyed',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        const armCount = (result.match(/left arm/g) || []).length;
        const earCount = (result.match(/right ear/g) || []).length;
        expect(armCount).toBe(1);
        expect(earCount).toBe(1);
      });

      it('should produce correct grammar for single destroyed part', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              state: 'destroyed',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              state: 'destroyed',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        // Should NOT produce "My right ear and right ear is completely numb"
        expect(result).not.toMatch(/right ear and right ear/);
        // Should produce single part reference
        expect(result).toContain('right ear');
        expect(result).toContain('is completely numb');
      });
    });

    describe('multiple injuries', () => {
      it('should format multiple parts with same state', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'wounded',
            },
            {
              partEntityId: 'part-2',
              partType: 'arm',
              orientation: 'right',
              state: 'wounded',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          destroyedParts: [],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toContain('left arm');
        expect(result).toContain('right arm');
        expect(result).toContain('and');
      });

      it('should group injuries by severity', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'critical',
            },
            {
              partEntityId: 'part-2',
              partType: 'leg',
              orientation: 'right',
              state: 'scratched',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          destroyedParts: [],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        // Critical should appear before scratched
        const criticalPos = result.indexOf('screams with agony');
        const scratchedPos = result.indexOf('stings slightly');
        expect(criticalPos).toBeLessThan(scratchedPos);
      });
    });

    describe('effect-to-description mappings', () => {
      it('should format bleeding effect with minor severity', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'wounded',
            },
          ],
          bleedingParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              bleedingSeverity: 'minor',
            },
          ],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          destroyedParts: [],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toContain('Blood seeps from');
      });

      it('should format bleeding effect with moderate severity', () => {
        const summary = createSummaryWithBleeding('moderate');
        const result = service.formatFirstPerson(summary);
        expect(result).toContain('Blood flows steadily from');
      });

      it('should format bleeding effect with severe severity', () => {
        const summary = createSummaryWithBleeding('severe');
        const result = service.formatFirstPerson(summary);
        expect(result).toContain('Blood pours freely from');
      });

      it('should format burning effect', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'wounded',
            },
          ],
          bleedingParts: [],
          burningParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
            },
          ],
          poisonedParts: [],
          fracturedParts: [],
          destroyedParts: [],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toContain('Searing heat radiates from');
      });

      it('should format poisoned effect', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'wounded',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
            },
          ],
          fracturedParts: [],
          destroyedParts: [],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toContain('A sickening feeling spreads from');
      });

      it('should format fractured effect', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'wounded',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
            },
          ],
          destroyedParts: [],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toContain('Sharp pain shoots through');
      });
    });

    describe('dismembered parts filtering', () => {
      it('should not show health state for dismembered parts', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              state: 'destroyed',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              state: 'destroyed',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              isDismembered: true,
            },
          ],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toContain('is missing');
        expect(result).not.toContain('is completely numb');
      });

      it('should show health state for destroyed but non-dismembered parts', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'torso',
              orientation: null,
              state: 'destroyed',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'torso',
              orientation: null,
              state: 'destroyed',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toContain('is completely numb');
        expect(result).not.toContain('is missing');
      });

      it('should not show bleeding for dismembered parts', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          bleedingParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              bleedingSeverity: 'severe',
            },
          ],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              isDismembered: true,
            },
          ],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toContain('is missing');
        expect(result).not.toContain('Blood');
        expect(result).not.toContain('blood');
      });

      it('should handle multiple dismembered parts', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              state: 'destroyed',
            },
            {
              partEntityId: 'part-2',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              state: 'destroyed',
            },
            {
              partEntityId: 'part-2',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              isDismembered: true,
            },
            {
              partEntityId: 'part-2',
              partType: 'arm',
              orientation: 'left',
              isDismembered: true,
            },
          ],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        // Should show grouped "are missing" for multiple dismembered parts
        expect(result).toContain('right ear');
        expect(result).toContain('left arm');
        expect(result).toContain('are missing');
        // Should NOT show health state descriptions
        expect(result).not.toContain('is completely numb');
      });

      it('should not exclude non-dismembered parts when some are dismembered', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              state: 'destroyed',
            },
            {
              partEntityId: 'part-2',
              partType: 'torso',
              orientation: null,
              state: 'critical',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              state: 'destroyed',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              isDismembered: true,
            },
          ],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        // Ear should show "is missing" (dismembered)
        expect(result).toContain('right ear');
        expect(result).toContain('is missing');
        // Torso should show health state (not dismembered)
        expect(result).toContain('torso');
        expect(result).toContain('screams with agony');
      });

      it('should not show burning effect for dismembered parts', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          bleedingParts: [],
          burningParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
            },
          ],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              isDismembered: true,
            },
          ],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toContain('is missing');
        expect(result).not.toContain('Searing heat');
        expect(result).not.toContain('searing heat');
      });

      it('should not show poisoned effect for dismembered parts', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
            },
          ],
          fracturedParts: [],
          dismemberedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              isDismembered: true,
            },
          ],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toContain('is missing');
        expect(result).not.toContain('sickening feeling');
        expect(result).not.toContain('Sickening feeling');
      });

      it('should not show fractured effect for dismembered parts', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
            },
          ],
          dismemberedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              isDismembered: true,
            },
          ],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toContain('is missing');
        expect(result).not.toContain('Sharp pain');
        expect(result).not.toContain('sharp pain');
      });

      it('should filter dismembered from non-destroyed health states', () => {
        // Edge case: a part that is marked as dismembered but has a non-destroyed state
        // (shouldn't normally happen, but ensure filtering works)
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'critical',
            },
          ],
          destroyedParts: [],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              isDismembered: true,
            },
          ],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toContain('is missing');
        // Should NOT show the critical state for the dismembered part
        expect(result).not.toContain('screams with agony');
      });
    });

    describe('grouped dismemberment formatting', () => {
      it('should use "is missing" for single dismembered part', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              isDismembered: true,
            },
          ],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toBe('My left arm is missing.');
      });

      it('should use "are missing" for two dismembered parts with "and"', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
            {
              partEntityId: 'part-2',
              partType: 'leg',
              orientation: 'right',
              state: 'destroyed',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
            {
              partEntityId: 'part-2',
              partType: 'leg',
              orientation: 'right',
              state: 'destroyed',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              isDismembered: true,
            },
            {
              partEntityId: 'part-2',
              partType: 'leg',
              orientation: 'right',
              isDismembered: true,
            },
          ],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toBe('My left arm and right leg are missing.');
      });

      it('should use "are missing" with Oxford comma for three+ dismembered parts', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            { partEntityId: 'part-1', partType: 'ass cheek', orientation: 'left', state: 'destroyed' },
            { partEntityId: 'part-2', partType: 'leg', orientation: 'right', state: 'destroyed' },
            { partEntityId: 'part-3', partType: 'arm', orientation: 'right', state: 'destroyed' },
            { partEntityId: 'part-4', partType: 'ear', orientation: 'right', state: 'destroyed' },
            { partEntityId: 'part-5', partType: 'vagina', orientation: null, state: 'destroyed' },
            { partEntityId: 'part-6', partType: 'breast', orientation: 'left', state: 'destroyed' },
          ],
          destroyedParts: [
            { partEntityId: 'part-1', partType: 'ass cheek', orientation: 'left', state: 'destroyed' },
            { partEntityId: 'part-2', partType: 'leg', orientation: 'right', state: 'destroyed' },
            { partEntityId: 'part-3', partType: 'arm', orientation: 'right', state: 'destroyed' },
            { partEntityId: 'part-4', partType: 'ear', orientation: 'right', state: 'destroyed' },
            { partEntityId: 'part-5', partType: 'vagina', orientation: null, state: 'destroyed' },
            { partEntityId: 'part-6', partType: 'breast', orientation: 'left', state: 'destroyed' },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [
            { partEntityId: 'part-1', partType: 'ass cheek', orientation: 'left', isDismembered: true },
            { partEntityId: 'part-2', partType: 'leg', orientation: 'right', isDismembered: true },
            { partEntityId: 'part-3', partType: 'arm', orientation: 'right', isDismembered: true },
            { partEntityId: 'part-4', partType: 'ear', orientation: 'right', isDismembered: true },
            { partEntityId: 'part-5', partType: 'vagina', orientation: null, isDismembered: true },
            { partEntityId: 'part-6', partType: 'breast', orientation: 'left', isDismembered: true },
          ],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toBe(
          'My left ass cheek, right leg, right arm, right ear, vagina, and left breast are missing.'
        );
      });

      it('should only have "My" prefix on first part in grouped list', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
            {
              partEntityId: 'part-2',
              partType: 'arm',
              orientation: 'right',
              state: 'destroyed',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
            {
              partEntityId: 'part-2',
              partType: 'arm',
              orientation: 'right',
              state: 'destroyed',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              isDismembered: true,
            },
            {
              partEntityId: 'part-2',
              partType: 'arm',
              orientation: 'right',
              isDismembered: true,
            },
          ],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        // Should have exactly one "My" and should NOT have "my right arm" or "My right arm"
        expect(result).toBe('My left arm and right arm are missing.');
        // Verify no redundant "my" in middle of sentence
        expect(result).not.toMatch(/and [Mm]y /);
      });
    });

    describe('dismemberment priority ordering', () => {
      it('should show dismemberment before health states', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              state: 'destroyed',
            },
            {
              partEntityId: 'part-2',
              partType: 'torso',
              orientation: null,
              state: 'critical',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              state: 'destroyed',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              isDismembered: true,
            },
          ],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        const missingPos = result.indexOf('is missing');
        const agonyPos = result.indexOf('screams with agony');

        expect(missingPos).toBeGreaterThan(-1);
        expect(agonyPos).toBeGreaterThan(-1);
        expect(missingPos).toBeLessThan(agonyPos);
      });

      it('should show dismemberment before bleeding', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
            {
              partEntityId: 'part-2',
              partType: 'torso',
              orientation: null,
              state: 'wounded',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          bleedingParts: [
            {
              partEntityId: 'part-2',
              partType: 'torso',
              orientation: null,
              bleedingSeverity: 'moderate',
            },
          ],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [
            {
              partEntityId: 'part-1',
              partType: 'arm',
              orientation: 'left',
              isDismembered: true,
            },
          ],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        const missingPos = result.indexOf('is missing');
        const bloodPos = result.indexOf('Blood');

        expect(missingPos).toBeGreaterThan(-1);
        expect(bloodPos).toBeGreaterThan(-1);
        expect(missingPos).toBeLessThan(bloodPos);
      });

      it('should maintain health state order after dismemberment', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              state: 'destroyed',
            },
            {
              partEntityId: 'part-2',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
            {
              partEntityId: 'part-3',
              partType: 'torso',
              orientation: null,
              state: 'critical',
            },
            {
              partEntityId: 'part-4',
              partType: 'leg',
              orientation: 'right',
              state: 'wounded',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              state: 'destroyed',
            },
            {
              partEntityId: 'part-2',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              isDismembered: true,
            },
          ],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        const missingPos = result.indexOf('is missing');
        const numbPos = result.indexOf('is completely numb'); // destroyed (non-dismembered arm)
        const agonyPos = result.indexOf('screams with agony'); // critical
        const throbsPos = result.indexOf('throbs painfully'); // wounded

        // Dismemberment first
        expect(missingPos).toBeGreaterThan(-1);
        expect(missingPos).toBeLessThan(numbPos);
        // Then health states in severity order
        expect(numbPos).toBeGreaterThan(-1);
        expect(numbPos).toBeLessThan(agonyPos);
        expect(agonyPos).toBeGreaterThan(-1);
        expect(agonyPos).toBeLessThan(throbsPos);
        expect(throbsPos).toBeGreaterThan(-1);
      });

      it('should handle only dismemberment without other injuries', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              state: 'destroyed',
            },
            {
              partEntityId: 'part-2',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          destroyedParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              state: 'destroyed',
            },
            {
              partEntityId: 'part-2',
              partType: 'arm',
              orientation: 'left',
              state: 'destroyed',
            },
          ],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [
            {
              partEntityId: 'part-1',
              partType: 'ear',
              orientation: 'right',
              isDismembered: true,
            },
            {
              partEntityId: 'part-2',
              partType: 'arm',
              orientation: 'left',
              isDismembered: true,
            },
          ],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        // Should contain grouped "are missing" sentence for multiple parts
        expect(result).toContain('right ear');
        expect(result).toContain('left arm');
        expect(result).toContain('are missing');
        // Should NOT contain any health state descriptions
        expect(result).not.toContain('is completely numb');
        expect(result).not.toContain('screams with agony');
        expect(result).not.toContain('aches deeply');
        expect(result).not.toContain('throbs painfully');
        expect(result).not.toContain('stings slightly');
        // Should NOT contain any other effects
        expect(result).not.toContain('Blood');
        expect(result).not.toContain('Searing heat');
      });

      it('should handle no dismemberment with health states only', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [
            {
              partEntityId: 'part-1',
              partType: 'torso',
              orientation: null,
              state: 'critical',
            },
            {
              partEntityId: 'part-2',
              partType: 'arm',
              orientation: 'left',
              state: 'wounded',
            },
          ],
          destroyedParts: [],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          dismemberedParts: [],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        // Should NOT contain "is missing"
        expect(result).not.toContain('is missing');
        // Should start with the most severe health state
        expect(result).toContain('screams with agony');
        expect(result).toContain('throbs painfully');
        // Verify ordering: critical before wounded
        const agonyPos = result.indexOf('screams with agony');
        const throbsPos = result.indexOf('throbs painfully');
        expect(agonyPos).toBeLessThan(throbsPos);
      });
    });

    describe('bleeding grouping', () => {
      // Helper function for creating bleeding-focused summaries
      function createSummaryWithBleedingParts(bleedingConfigs) {
        const bleedingParts = bleedingConfigs.map((config, index) => ({
          partEntityId: `part-${index}`,
          partType: config.partType,
          orientation: config.orientation || null,
          bleedingSeverity: config.bleedingSeverity,
        }));

        const injuredParts = bleedingConfigs.map((config, index) => ({
          partEntityId: `part-${index}`,
          partType: config.partType,
          orientation: config.orientation || null,
          state: 'wounded',
        }));

        return {
          entityId: 'entity-1',
          injuredParts,
          bleedingParts,
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          destroyedParts: [],
          dismemberedParts: [],
          isDying: false,
          isDead: false,
        };
      }

      it('should format single bleeding part correctly', () => {
        const summary = createSummaryWithBleedingParts([
          { partType: 'torso', bleedingSeverity: 'moderate' },
        ]);

        const result = service.formatFirstPerson(summary);
        expect(result).toContain('Blood flows steadily from my torso.');
      });

      it('should format two bleeding parts with same severity using "and"', () => {
        const summary = createSummaryWithBleedingParts([
          { partType: 'torso', bleedingSeverity: 'moderate' },
          { partType: 'head', orientation: 'upper', bleedingSeverity: 'moderate' },
        ]);

        const result = service.formatFirstPerson(summary);
        expect(result).toMatch(
          /Blood flows steadily from my torso and upper head\./
        );
      });

      it('should format three+ bleeding parts with Oxford comma', () => {
        const summary = createSummaryWithBleedingParts([
          { partType: 'torso', bleedingSeverity: 'moderate' },
          { partType: 'head', orientation: 'upper', bleedingSeverity: 'moderate' },
          { partType: 'leg', orientation: 'right', bleedingSeverity: 'moderate' },
        ]);

        const result = service.formatFirstPerson(summary);
        expect(result).toMatch(
          /Blood flows steadily from my torso, upper head, and right leg\./
        );
      });

      it('should create separate sentences for different severities', () => {
        const summary = createSummaryWithBleedingParts([
          { partType: 'torso', bleedingSeverity: 'moderate' },
          { partType: 'arm', orientation: 'left', bleedingSeverity: 'severe' },
        ]);

        const result = service.formatFirstPerson(summary);
        expect(result).toContain('Blood pours freely from my left arm.');
        expect(result).toContain('Blood flows steadily from my torso.');
      });

      it('should process severe before moderate before minor', () => {
        const summary = createSummaryWithBleedingParts([
          { partType: 'leg', orientation: 'right', bleedingSeverity: 'minor' },
          { partType: 'arm', orientation: 'left', bleedingSeverity: 'severe' },
          { partType: 'torso', bleedingSeverity: 'moderate' },
        ]);

        const result = service.formatFirstPerson(summary);
        const severePos = result.indexOf('pours freely');
        const moderatePos = result.indexOf('flows steadily');
        const minorPos = result.indexOf('seeps from');

        expect(severePos).toBeGreaterThan(-1);
        expect(moderatePos).toBeGreaterThan(-1);
        expect(minorPos).toBeGreaterThan(-1);
        expect(severePos).toBeLessThan(moderatePos);
        expect(moderatePos).toBeLessThan(minorPos);
      });

      it('should handle empty bleeding parts array', () => {
        const summary = {
          entityId: 'entity-1',
          injuredParts: [],
          bleedingParts: [],
          burningParts: [],
          poisonedParts: [],
          fracturedParts: [],
          destroyedParts: [],
          dismemberedParts: [],
          isDying: false,
          isDead: false,
        };

        const result = service.formatFirstPerson(summary);
        expect(result).toBe('I feel fine.');
      });

      it('should group multiple parts by severity with mixed severities', () => {
        const summary = createSummaryWithBleedingParts([
          { partType: 'arm', orientation: 'left', bleedingSeverity: 'severe' },
          { partType: 'arm', orientation: 'right', bleedingSeverity: 'severe' },
          { partType: 'torso', bleedingSeverity: 'moderate' },
          { partType: 'head', orientation: 'upper', bleedingSeverity: 'moderate' },
          { partType: 'leg', orientation: 'right', bleedingSeverity: 'minor' },
        ]);

        const result = service.formatFirstPerson(summary);

        // Severe parts grouped together (only first gets "my")
        expect(result).toMatch(
          /Blood pours freely from my left arm and right arm\./
        );
        // Moderate parts grouped together (only first gets "my")
        expect(result).toMatch(
          /Blood flows steadily from my torso and upper head\./
        );
        // Minor part alone
        expect(result).toContain('Blood seeps from my right leg.');
      });
    });
  });

  describe('formatDamageEvent', () => {
    describe('edge cases', () => {
      it('should return empty string for null data', () => {
        const result = service.formatDamageEvent(null);
        expect(result).toBe('');
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it('should return empty string for undefined data', () => {
        const result = service.formatDamageEvent(undefined);
        expect(result).toBe('');
      });
    });

    describe('primary damage description', () => {
      it('should format basic damage event', () => {
        const damageEventData = {
          entityName: 'Vespera',
          entityPronoun: 'she',
          partType: 'arm',
          orientation: 'left',
          damageType: 'slashing',
          damageAmount: 15,
          previousState: 'healthy',
          newState: 'wounded',
          effectsTriggered: [],
        };

        const result = service.formatDamageEvent(damageEventData);
        // New format: "{entityName}'s {partName} suffers {damageType} damage"
        expect(result).toContain("Vespera's left arm suffers slashing damage");
      });

      it('should format damage with possessive entity name for male', () => {
        const damageEventData = createBasicDamageEvent('he');
        const result = service.formatDamageEvent(damageEventData);
        // New format uses possessive entity name instead of pronouns
        expect(result).toContain("Test Entity's");
        expect(result).toContain('suffers slashing damage');
      });

      it('should format damage with possessive entity name for female', () => {
        const damageEventData = createBasicDamageEvent('she');
        const result = service.formatDamageEvent(damageEventData);
        expect(result).toContain("Test Entity's");
        expect(result).toContain('suffers slashing damage');
      });

      it('should format damage with possessive entity name for neutral', () => {
        const damageEventData = createBasicDamageEvent('they');
        const result = service.formatDamageEvent(damageEventData);
        expect(result).toContain("Test Entity's");
        expect(result).toContain('suffers slashing damage');
      });

      it('should format damage with possessive entity name for unknown pronoun', () => {
        const damageEventData = createBasicDamageEvent('unknown');
        const result = service.formatDamageEvent(damageEventData);
        expect(result).toContain("Test Entity's");
        expect(result).toContain('suffers slashing damage');
      });
    });

    describe('damage formatting', () => {
      it('should format damage without state descriptions (state is tracked separately)', () => {
        const damageEventData = {
          entityName: 'Vespera',
          entityPronoun: 'she',
          partType: 'torso',
          orientation: null,
          damageType: 'piercing',
          damageAmount: 20,
          previousState: 'healthy',
          newState: 'wounded',
          effectsTriggered: [],
        };

        const result = service.formatDamageEvent(damageEventData);
        // New format: "{entityName}'s {partName} suffers {damageType} damage"
        expect(result).toContain("Vespera's torso suffers piercing damage");
        // State changes are now tracked via separate events, not in damage narrative
      });

      it('should produce consistent output regardless of state change', () => {
        const damageEventData = {
          entityName: 'Vespera',
          entityPronoun: 'she',
          partType: 'torso',
          orientation: null,
          damageType: 'piercing',
          damageAmount: 5,
          previousState: 'wounded',
          newState: 'wounded',
          effectsTriggered: [],
        };

        const result = service.formatDamageEvent(damageEventData);
        // Should contain the primary damage description
        expect(result).toContain("Vespera's torso suffers piercing damage");
      });

      it('should format damage for destroyed parts consistently', () => {
        const damageEventData = {
          entityName: 'Vespera',
          entityPronoun: 'she',
          partType: 'arm',
          orientation: 'left',
          damageType: 'slashing',
          damageAmount: 50,
          previousState: 'critical',
          newState: 'destroyed',
          effectsTriggered: [],
        };

        const result = service.formatDamageEvent(damageEventData);
        // Still uses consistent format even for destructive damage
        expect(result).toContain("Vespera's left arm suffers slashing damage");
      });
    });

    describe('effects triggered', () => {
      it('should include bleeding effect', () => {
        const damageEventData = {
          entityName: 'Vespera',
          entityPronoun: 'she',
          partType: 'arm',
          orientation: 'left',
          damageType: 'slashing',
          damageAmount: 15,
          previousState: 'healthy',
          newState: 'wounded',
          effectsTriggered: ['bleeding'],
        };

        const result = service.formatDamageEvent(damageEventData);
        expect(result).toContain('is bleeding');
      });

      it('should include multiple effects', () => {
        const damageEventData = {
          entityName: 'Vespera',
          entityPronoun: 'she',
          partType: 'arm',
          orientation: 'left',
          damageType: 'fire',
          damageAmount: 20,
          previousState: 'healthy',
          newState: 'wounded',
          effectsTriggered: ['bleeding', 'burning'],
        };

        const result = service.formatDamageEvent(damageEventData);
        expect(result).toContain('is bleeding');
        expect(result).toContain('is burning');
      });
    });

    describe('propagated damage', () => {
      it('should include propagated damage description', () => {
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
              childPartId: 'heart-1',
              childPartType: 'heart',
              damageApplied: 20,
              previousState: 'healthy',
              newState: 'wounded',
            },
          ],
        };

        const result = service.formatDamageEvent(damageEventData);
        // New format: "The damage propagates to {entityName}'s {childPartType}, that suffers {damageType} damage"
        expect(result).toContain('The damage propagates to');
        expect(result).toContain("Vespera's heart");
        expect(result).toContain('suffers piercing damage');
      });

      it('should handle multiple propagated damages', () => {
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
              childPartId: 'heart-1',
              childPartType: 'heart',
              damageApplied: 20,
              previousState: 'healthy',
              newState: 'scratched',
            },
            {
              childPartId: 'lung-1',
              childPartType: 'lung',
              damageApplied: 15,
              previousState: 'healthy',
              newState: 'scratched',
            },
          ],
        };

        const result = service.formatDamageEvent(damageEventData);
        expect(result).toContain('heart');
        expect(result).toContain('lung');
      });
    });
  });

  // Helper functions to create test data
  function createSummaryWithInjury(state) {
    return {
      entityId: 'entity-1',
      injuredParts: [
        {
          partEntityId: 'part-1',
          partType: 'arm',
          orientation: 'left',
          state: state,
        },
      ],
      bleedingParts: [],
      burningParts: [],
      poisonedParts: [],
      fracturedParts: [],
      destroyedParts: [],
      isDying: false,
      isDead: false,
    };
  }

  function createSummaryWithDestroyed() {
    return {
      entityId: 'entity-1',
      injuredParts: [
        {
          partEntityId: 'part-1',
          partType: 'arm',
          orientation: 'left',
          state: 'destroyed',
        },
      ],
      bleedingParts: [],
      burningParts: [],
      poisonedParts: [],
      fracturedParts: [],
      destroyedParts: [
        {
          partEntityId: 'part-1',
          partType: 'arm',
          orientation: 'left',
          state: 'destroyed',
        },
      ],
      isDying: false,
      isDead: false,
    };
  }

  function createSummaryWithBleeding(severity) {
    return {
      entityId: 'entity-1',
      injuredParts: [
        {
          partEntityId: 'part-1',
          partType: 'arm',
          orientation: 'left',
          state: 'wounded',
        },
      ],
      bleedingParts: [
        {
          partEntityId: 'part-1',
          partType: 'arm',
          orientation: 'left',
          bleedingSeverity: severity,
        },
      ],
      burningParts: [],
      poisonedParts: [],
      fracturedParts: [],
      destroyedParts: [],
      isDying: false,
      isDead: false,
    };
  }

  function createBasicDamageEvent(pronoun) {
    return {
      entityName: 'Test Entity',
      entityPronoun: pronoun,
      partType: 'arm',
      orientation: 'left',
      damageType: 'slashing',
      damageAmount: 15,
      previousState: 'healthy',
      newState: 'wounded',
      effectsTriggered: [],
    };
  }
});
