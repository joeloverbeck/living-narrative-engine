import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import StatusEffectRegistry from '../../../../src/anatomy/services/statusEffectRegistry.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

describe('StatusEffectRegistry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns effect definitions from registry', () => {
    const dataRegistry = new InMemoryDataRegistry({ logger });
    dataRegistry.store('statusEffects', 'core:status_effects', {
      applyOrder: ['bleeding', 'burning'],
      effects: [
        { id: 'bleeding', defaults: { severity: {} } },
        { id: 'burning', defaults: { tickDamage: 1 } },
      ],
    });

    const registry = new StatusEffectRegistry({ dataRegistry, logger });

    expect(registry.get('bleeding')).toEqual(
      expect.objectContaining({ id: 'bleeding' })
    );
    expect(registry.get('missing')).toBeUndefined();
    expect(registry.getAll()).toHaveLength(2);
    expect(registry.getApplyOrder()).toEqual(['bleeding', 'burning']);
  });

  test('gracefully handles missing registry entries', () => {
    const emptyRegistry = new StatusEffectRegistry({
      dataRegistry: new InMemoryDataRegistry({ logger }),
      logger,
    });

    expect(emptyRegistry.getAll()).toEqual([]);
    expect(emptyRegistry.getApplyOrder()).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('aggregates effects from multiple registry entries', () => {
    const dataRegistry = new InMemoryDataRegistry({ logger });

    // First registry (e.g., from anatomy mod)
    dataRegistry.store('statusEffects', 'anatomy:status_effects', {
      applyOrder: ['bleeding', 'burning'],
      effects: [
        { id: 'bleeding', effectType: 'bleed', defaults: { severity: {} } },
        { id: 'burning', effectType: 'burn', defaults: { tickDamage: 1 } },
      ],
    });

    // Second registry (e.g., from breathing mod)
    dataRegistry.store('statusEffects', 'breathing:status_effects', {
      applyOrder: ['hypoxic', 'unconscious_anoxia'],
      effects: [
        { id: 'hypoxic', effectType: 'hypoxia', defaults: { turnsToUnconscious: 7 } },
        {
          id: 'unconscious_anoxia',
          effectType: 'anoxic_unconsciousness',
          defaults: { turnsToBrainDamage: 2 },
        },
      ],
    });

    const registry = new StatusEffectRegistry({ dataRegistry, logger });

    // Should have all 4 effects from both registries
    expect(registry.getAll()).toHaveLength(4);
    expect(registry.get('bleeding')).toBeDefined();
    expect(registry.get('burning')).toBeDefined();
    expect(registry.get('hypoxic')).toBeDefined();
    expect(registry.get('unconscious_anoxia')).toBeDefined();

    // Apply order should merge both arrays
    const applyOrder = registry.getApplyOrder();
    expect(applyOrder).toContain('bleeding');
    expect(applyOrder).toContain('burning');
    expect(applyOrder).toContain('hypoxic');
    expect(applyOrder).toContain('unconscious_anoxia');
  });

  test('later registry entries override earlier ones with same effect ID', () => {
    const dataRegistry = new InMemoryDataRegistry({ logger });

    // First registry with bleeding effect
    dataRegistry.store('statusEffects', 'mod_a:status_effects', {
      effects: [{ id: 'bleeding', tickDamage: 1 }],
    });

    // Second registry with updated bleeding effect
    dataRegistry.store('statusEffects', 'mod_b:status_effects', {
      effects: [{ id: 'bleeding', tickDamage: 5 }],
    });

    const registry = new StatusEffectRegistry({ dataRegistry, logger });

    // Should have the later version
    expect(registry.get('bleeding').tickDamage).toBe(5);
    expect(registry.getAll()).toHaveLength(1);
  });
});
