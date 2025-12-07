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
});
