import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import InjuryNarrativeFormatterService from '../../../../src/anatomy/services/injuryNarrativeFormatterService.js';

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
        expect(result).toContain('Vespera suffers slashing damage to her left arm');
      });

      it('should use correct possessive pronoun for male', () => {
        const damageEventData = createBasicDamageEvent('he');
        const result = service.formatDamageEvent(damageEventData);
        expect(result).toContain('his');
      });

      it('should use correct possessive pronoun for female', () => {
        const damageEventData = createBasicDamageEvent('she');
        const result = service.formatDamageEvent(damageEventData);
        expect(result).toContain('her');
      });

      it('should use correct possessive pronoun for neutral', () => {
        const damageEventData = createBasicDamageEvent('they');
        const result = service.formatDamageEvent(damageEventData);
        expect(result).toContain('their');
      });

      it('should handle unknown pronoun with default', () => {
        const damageEventData = createBasicDamageEvent('unknown');
        const result = service.formatDamageEvent(damageEventData);
        expect(result).toContain('their');
      });
    });

    describe('state change description', () => {
      it('should include state change when state changed', () => {
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
        expect(result).toContain('is wounded');
      });

      it('should not duplicate state description when state unchanged', () => {
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
        // Should only contain the primary damage description
        const stateMatches = result.match(/is wounded/g);
        expect(stateMatches).toBeNull();
      });

      it('should format destroyed state correctly', () => {
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
        expect(result).toContain('has been destroyed');
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
        expect(result).toContain('As a result');
        expect(result).toContain('heart');
        expect(result).toContain('is wounded');
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
