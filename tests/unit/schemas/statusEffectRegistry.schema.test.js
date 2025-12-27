import { describe, beforeAll, test, expect } from '@jest/globals';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import schema from '../../../data/schemas/status-effect.registry.schema.json';
import anatomyRegistry from '../../../data/mods/anatomy/status-effects/status-effects.registry.json';
import breathingRegistry from '../../../data/mods/breathing/status-effects/status-effects.registry.json';

describe('status-effect.registry schema', () => {
  /** @type {import('ajv').ValidateFunction} */
  let validate;

  beforeAll(() => {
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    validate = ajv.compile(schema);
  });

  test('anatomy registry file conforms to schema', () => {
    const ok = validate(anatomyRegistry);
    if (!ok) {
       
      console.error(validate.errors);
    }
    expect(ok).toBe(true);
  });

  test('rejects registry missing effectType-specific defaults', () => {
    const invalid = {
      id: 'core:status_effects',
      effects: [
        {
          id: 'bleeding',
          effectType: 'bleed',
          componentId: 'anatomy:bleeding',
          startedEventId: 'anatomy:bleeding_started',
        },
      ],
    };

    const ok = validate(invalid);
    expect(ok).toBe(false);
  });

  describe('hypoxia effect type', () => {
    test('accepts valid hypoxia effect with all required fields', () => {
      const valid = {
        id: 'test:status_effects',
        effects: [
          {
            id: 'hypoxic',
            effectType: 'hypoxia',
            componentId: 'breathing:hypoxic',
            startedEventId: 'breathing:hypoxia_started',
            stoppedEventId: 'breathing:hypoxia_stopped',
            priority: 5,
            defaults: {
              turnsToModerate: 3,
              turnsToSevere: 5,
              turnsToUnconscious: 7,
              severity: {
                mild: { actionPenalty: 0 },
                moderate: { actionPenalty: 2 },
                severe: { actionPenalty: 4 },
              },
            },
          },
        ],
      };

      const ok = validate(valid);
      if (!ok) {
         
        console.error(validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('accepts hypoxia effect with only required defaults', () => {
      const valid = {
        id: 'test:status_effects',
        effects: [
          {
            id: 'hypoxic',
            effectType: 'hypoxia',
            componentId: 'breathing:hypoxic',
            defaults: {
              turnsToUnconscious: 7,
              severity: {
                mild: { actionPenalty: 0 },
                moderate: { actionPenalty: 2 },
                severe: { actionPenalty: 4 },
              },
            },
          },
        ],
      };

      const ok = validate(valid);
      if (!ok) {
         
        console.error(validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('rejects hypoxia effect missing turnsToUnconscious', () => {
      const invalid = {
        id: 'test:status_effects',
        effects: [
          {
            id: 'hypoxic',
            effectType: 'hypoxia',
            componentId: 'breathing:hypoxic',
            defaults: {
              severity: {
                mild: { actionPenalty: 0 },
                moderate: { actionPenalty: 2 },
                severe: { actionPenalty: 4 },
              },
            },
          },
        ],
      };

      const ok = validate(invalid);
      expect(ok).toBe(false);
    });

    test('rejects hypoxia effect missing severity', () => {
      const invalid = {
        id: 'test:status_effects',
        effects: [
          {
            id: 'hypoxic',
            effectType: 'hypoxia',
            componentId: 'breathing:hypoxic',
            defaults: {
              turnsToUnconscious: 7,
            },
          },
        ],
      };

      const ok = validate(invalid);
      expect(ok).toBe(false);
    });

    test('rejects hypoxia effect with incomplete severity levels', () => {
      const invalid = {
        id: 'test:status_effects',
        effects: [
          {
            id: 'hypoxic',
            effectType: 'hypoxia',
            componentId: 'breathing:hypoxic',
            defaults: {
              turnsToUnconscious: 7,
              severity: {
                mild: { actionPenalty: 0 },
                // missing moderate and severe
              },
            },
          },
        ],
      };

      const ok = validate(invalid);
      expect(ok).toBe(false);
    });
  });

  describe('anoxic_unconsciousness effect type', () => {
    test('accepts valid anoxic_unconsciousness effect', () => {
      const valid = {
        id: 'test:status_effects',
        effects: [
          {
            id: 'unconscious_anoxia',
            effectType: 'anoxic_unconsciousness',
            componentId: 'breathing:unconscious_anoxia',
            startedEventId: 'breathing:anoxic_unconsciousness_started',
            priority: 6,
            defaults: {
              turnsToBrainDamage: 2,
              brainDamagePerTurn: 5,
            },
          },
        ],
      };

      const ok = validate(valid);
      if (!ok) {
         
        console.error(validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('rejects anoxic_unconsciousness effect missing turnsToBrainDamage', () => {
      const invalid = {
        id: 'test:status_effects',
        effects: [
          {
            id: 'unconscious_anoxia',
            effectType: 'anoxic_unconsciousness',
            componentId: 'breathing:unconscious_anoxia',
            defaults: {
              brainDamagePerTurn: 5,
            },
          },
        ],
      };

      const ok = validate(invalid);
      expect(ok).toBe(false);
    });

    test('rejects anoxic_unconsciousness effect missing brainDamagePerTurn', () => {
      const invalid = {
        id: 'test:status_effects',
        effects: [
          {
            id: 'unconscious_anoxia',
            effectType: 'anoxic_unconsciousness',
            componentId: 'breathing:unconscious_anoxia',
            defaults: {
              turnsToBrainDamage: 2,
            },
          },
        ],
      };

      const ok = validate(invalid);
      expect(ok).toBe(false);
    });

    test('rejects anoxic_unconsciousness effect with invalid values', () => {
      const invalid = {
        id: 'test:status_effects',
        effects: [
          {
            id: 'unconscious_anoxia',
            effectType: 'anoxic_unconsciousness',
            componentId: 'breathing:unconscious_anoxia',
            defaults: {
              turnsToBrainDamage: 0, // minimum is 1
              brainDamagePerTurn: 5,
            },
          },
        ],
      };

      const ok = validate(invalid);
      expect(ok).toBe(false);
    });
  });

  describe('breathing registry hypoxia entries', () => {
    test('breathing registry file conforms to schema', () => {
      const ok = validate(breathingRegistry);
      if (!ok) {
        console.error(validate.errors);
      }
      expect(ok).toBe(true);
    });

    test('breathing registry contains hypoxic effect', () => {
      const hypoxicEffect = breathingRegistry.effects.find(
        (e) => e.id === 'hypoxic'
      );
      expect(hypoxicEffect).toBeDefined();
      expect(hypoxicEffect.effectType).toBe('hypoxia');
      expect(hypoxicEffect.componentId).toBe('breathing:hypoxic');
    });

    test('breathing registry contains unconscious_anoxia effect', () => {
      const anoxiaEffect = breathingRegistry.effects.find(
        (e) => e.id === 'unconscious_anoxia'
      );
      expect(anoxiaEffect).toBeDefined();
      expect(anoxiaEffect.effectType).toBe('anoxic_unconsciousness');
      expect(anoxiaEffect.componentId).toBe('breathing:unconscious_anoxia');
    });

    test('hypoxic effect has proper severity progression', () => {
      const hypoxicEffect = breathingRegistry.effects.find(
        (e) => e.id === 'hypoxic'
      );
      const { severity } = hypoxicEffect.defaults;

      // Verify penalty increases with severity
      expect(severity.mild.actionPenalty).toBeLessThan(
        severity.moderate.actionPenalty
      );
      expect(severity.moderate.actionPenalty).toBeLessThan(
        severity.severe.actionPenalty
      );
    });

    test('hypoxia applyOrder includes hypoxic and unconscious_anoxia', () => {
      expect(breathingRegistry.applyOrder).toContain('hypoxic');
      expect(breathingRegistry.applyOrder).toContain('unconscious_anoxia');
    });
  });
});
