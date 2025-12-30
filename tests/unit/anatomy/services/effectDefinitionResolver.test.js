import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EffectDefinitionResolver from '../../../../src/anatomy/services/effectDefinitionResolver.js';
import WarningTracker from '../../../../src/anatomy/services/warningTracker.js';
import {
  FALLBACK_APPLY_ORDER,
  FALLBACK_EFFECT_DEFINITIONS,
} from '../../../../src/anatomy/constants/fallbackEffectDefinitions.js';

describe('EffectDefinitionResolver', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  describe('resolveEffectDefinition', () => {
    it('returns fallback definition when registry is absent', () => {
      const warningTracker = { warnOnce: jest.fn() };
      const resolver = new EffectDefinitionResolver({
        warningTracker,
        fallbackDefinitions: FALLBACK_EFFECT_DEFINITIONS,
      });

      const result = resolver.resolveEffectDefinition('bleed');

      expect(result).toBe(FALLBACK_EFFECT_DEFINITIONS.bleed);
      expect(warningTracker.warnOnce).toHaveBeenCalledWith(
        'missingDefinition',
        'bleed',
        expect.stringContaining('Missing status-effect registry entry')
      );
    });

    it('returns fallback definition when registry has no matching effect', () => {
      const warningTracker = { warnOnce: jest.fn() };
      const resolver = new EffectDefinitionResolver({
        statusEffectRegistry: {
          getAll: jest.fn().mockReturnValue([]),
        },
        warningTracker,
        fallbackDefinitions: FALLBACK_EFFECT_DEFINITIONS,
      });

      const result = resolver.resolveEffectDefinition('burn');

      expect(result).toBe(FALLBACK_EFFECT_DEFINITIONS.burn);
      expect(warningTracker.warnOnce).toHaveBeenCalledWith(
        'missingDefinition',
        'burn',
        expect.stringContaining('Missing status-effect registry entry')
      );
    });

    it('merges registry defaults with fallback defaults', () => {
      const warningTracker = { warnOnce: jest.fn() };
      const fallbackDefinitions = {
        bleed: {
          id: 'bleeding',
          effectType: 'bleed',
          componentId: 'anatomy:bleeding',
          startedEventId: 'anatomy:bleeding_started',
          defaults: {
            baseDurationTurns: 2,
            severity: {
              minor: { tickDamage: 1 },
              severe: { tickDamage: 5 },
            },
          },
        },
      };

      const resolver = new EffectDefinitionResolver({
        statusEffectRegistry: {
          getAll: jest.fn().mockReturnValue([
            {
              id: 'bleeding',
              effectType: 'bleed',
              defaults: {
                baseDurationTurns: 4,
                severity: {
                  minor: { tickDamage: 2 },
                },
              },
            },
          ]),
        },
        warningTracker,
        fallbackDefinitions,
      });

      const result = resolver.resolveEffectDefinition('bleed');

      expect(result.defaults).toEqual({
        baseDurationTurns: 4,
        severity: {
          minor: { tickDamage: 2 },
          severe: { tickDamage: 5 },
        },
      });
    });

    it('warns once when definition is missing', () => {
      const warningTracker = new WarningTracker({ logger: mockLogger });
      const resolver = new EffectDefinitionResolver({
        statusEffectRegistry: {
          getAll: jest.fn().mockReturnValue([]),
        },
        warningTracker,
        fallbackDefinitions: FALLBACK_EFFECT_DEFINITIONS,
      });

      resolver.resolveEffectDefinition('poison');
      resolver.resolveEffectDefinition('poison');

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolveApplyOrder', () => {
    it('returns fallback order when registry is absent', () => {
      const warningTracker = { warnOnce: jest.fn() };
      const resolver = new EffectDefinitionResolver({
        warningTracker,
        fallbackDefinitions: FALLBACK_EFFECT_DEFINITIONS,
      });

      expect(resolver.resolveApplyOrder()).toEqual(FALLBACK_APPLY_ORDER);
      expect(warningTracker.warnOnce).not.toHaveBeenCalled();
    });

    it('returns fallback order when registry order is empty', () => {
      const warningTracker = { warnOnce: jest.fn() };
      const resolver = new EffectDefinitionResolver({
        statusEffectRegistry: {
          getAll: jest.fn().mockReturnValue([]),
          getApplyOrder: jest.fn().mockReturnValue([]),
        },
        warningTracker,
        fallbackDefinitions: FALLBACK_EFFECT_DEFINITIONS,
      });

      expect(resolver.resolveApplyOrder()).toEqual(FALLBACK_APPLY_ORDER);
    });

    it('returns registry order when it already includes all fallback ids', () => {
      const warningTracker = { warnOnce: jest.fn() };
      const resolver = new EffectDefinitionResolver({
        statusEffectRegistry: {
          getAll: jest.fn().mockReturnValue([]),
          getApplyOrder: jest.fn().mockReturnValue(FALLBACK_APPLY_ORDER),
          get: jest.fn(),
        },
        warningTracker,
        fallbackDefinitions: FALLBACK_EFFECT_DEFINITIONS,
      });

      expect(resolver.resolveApplyOrder()).toEqual(FALLBACK_APPLY_ORDER);
    });

    it('appends missing fallback ids to registry order', () => {
      const warningTracker = { warnOnce: jest.fn() };
      const resolver = new EffectDefinitionResolver({
        statusEffectRegistry: {
          getAll: jest.fn().mockReturnValue([]),
          getApplyOrder: jest.fn().mockReturnValue(['bleeding']),
          get: jest.fn(),
        },
        warningTracker,
        fallbackDefinitions: FALLBACK_EFFECT_DEFINITIONS,
      });

      expect(resolver.resolveApplyOrder()).toEqual([
        'bleeding',
        'dismembered',
        'fractured',
        'burning',
        'poisoned',
      ]);
    });

    it('skips non-damage ids in registry order without warning', () => {
      const warningTracker = { warnOnce: jest.fn() };
      const resolver = new EffectDefinitionResolver({
        statusEffectRegistry: {
          getAll: jest.fn().mockReturnValue([]),
          getApplyOrder: jest.fn().mockReturnValue([
            'hypoxic',
            'bleeding',
            'unconscious_anoxia',
          ]),
          get: jest.fn().mockImplementation((id) => {
            if (id === 'hypoxic') {
              return { id: 'hypoxic', effectType: 'hypoxia' };
            }
            if (id === 'unconscious_anoxia') {
              return { id: 'unconscious_anoxia', effectType: 'anoxic_unconsciousness' };
            }
            return undefined;
          }),
        },
        warningTracker,
        fallbackDefinitions: FALLBACK_EFFECT_DEFINITIONS,
      });

      const result = resolver.resolveApplyOrder();

      expect(result[0]).toBe('bleeding');
      expect(warningTracker.warnOnce).not.toHaveBeenCalled();
    });

    it('warns for unknown ids missing from registry', () => {
      const warningTracker = { warnOnce: jest.fn() };
      const resolver = new EffectDefinitionResolver({
        statusEffectRegistry: {
          getAll: jest.fn().mockReturnValue([]),
          getApplyOrder: jest.fn().mockReturnValue(['unknown_id', 'bleeding']),
          get: jest.fn().mockReturnValue(undefined),
        },
        warningTracker,
        fallbackDefinitions: FALLBACK_EFFECT_DEFINITIONS,
      });

      resolver.resolveApplyOrder();

      expect(warningTracker.warnOnce).toHaveBeenCalledWith(
        'missingOrder',
        'unknown_id',
        expect.stringContaining('Unknown status-effect id in registry applyOrder')
      );
    });
  });

  describe('mergeDefaults', () => {
    it('performs deep merge for nested objects', () => {
      const warningTracker = { warnOnce: jest.fn() };
      const resolver = new EffectDefinitionResolver({ warningTracker });

      const result = resolver.mergeDefaults(
        { outer: { a: 1, nested: { b: 2 } } },
        { outer: { nested: { b: 3, c: 4 } } }
      );

      expect(result).toEqual({
        outer: { a: 1, nested: { b: 3, c: 4 } },
      });
    });

    it('performs shallow copy for arrays', () => {
      const warningTracker = { warnOnce: jest.fn() };
      const resolver = new EffectDefinitionResolver({ warningTracker });

      const result = resolver.mergeDefaults(
        { list: [1, 2], nested: { list: [1] } },
        { list: [3], nested: { list: [2, 3] } }
      );

      expect(result).toEqual({ list: [3], nested: { list: [2, 3] } });
    });

    it('preserves fallback keys when registry is empty', () => {
      const warningTracker = { warnOnce: jest.fn() };
      const resolver = new EffectDefinitionResolver({ warningTracker });

      const result = resolver.mergeDefaults({ a: 1, b: 2 }, {});

      expect(result).toEqual({ a: 1, b: 2 });
    });

    it('registry values take precedence over fallback values', () => {
      const warningTracker = { warnOnce: jest.fn() };
      const resolver = new EffectDefinitionResolver({ warningTracker });

      const result = resolver.mergeDefaults({ threshold: 0.5 }, { threshold: 0.8 });

      expect(result).toEqual({ threshold: 0.8 });
    });
  });
});
