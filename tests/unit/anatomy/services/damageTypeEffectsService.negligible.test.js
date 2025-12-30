import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DamageTypeEffectsService from '../../../../src/anatomy/services/damageTypeEffectsService.js';

/**
 * Creates mock applicators for testing DamageTypeEffectsService.
 */
function createMockApplicators() {
  return {
    effectDefinitionResolver: {
      resolveEffectDefinition: jest.fn((effectType) => ({
        id: `anatomy:${effectType === 'dismember' ? 'dismembered' : effectType === 'fracture' ? 'fractured' : effectType === 'bleed' ? 'bleeding' : effectType === 'burn' ? 'burning' : 'poisoned'}`,
        effectType,
        componentId: `anatomy:${effectType === 'dismember' ? 'dismembered' : effectType === 'fracture' ? 'fractured' : effectType === 'bleed' ? 'bleeding' : effectType === 'burn' ? 'burning' : 'poisoned'}`,
        defaults: {},
      })),
      resolveApplyOrder: jest.fn(() => [
        'anatomy:dismembered',
        'anatomy:fractured',
        'anatomy:bleeding',
        'anatomy:burning',
        'anatomy:poisoned',
      ]),
    },
    dismembermentApplicator: { apply: jest.fn().mockResolvedValue({ triggered: false }) },
    fractureApplicator: { apply: jest.fn().mockResolvedValue({ triggered: false, stunApplied: false }) },
    bleedApplicator: { apply: jest.fn().mockResolvedValue({ applied: false }) },
    burnApplicator: { apply: jest.fn().mockResolvedValue({ applied: false, stacked: false, stackedCount: 0 }) },
    poisonApplicator: { apply: jest.fn().mockResolvedValue({ applied: false, scope: 'part', targetId: '' }) },
  };
}

describe('DamageTypeEffectsService - negligible severity return', () => {
  let service;
  let logger;
  let entityManager;
  let dispatcher;
  let mockApplicators;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = {
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
      hasComponent: jest.fn(),
    };

    dispatcher = {
      dispatch: jest.fn(),
    };

    mockApplicators = createMockApplicators();

    service = new DamageTypeEffectsService({
      logger,
      entityManager,
      safeEventDispatcher: dispatcher,
      ...mockApplicators,
    });
  });

  it('returns negligible severity for low damage amounts', async () => {
    const result = await service.applyEffectsForDamage({
      entityId: 'entity-1',
      partId: 'part-1',
      damageEntry: { name: 'piercing', amount: 1 },
      maxHealth: 200,
      currentHealth: 199,
    });

    expect(result).toEqual({ severity: 'negligible' });
  });

  it('passes through provided severity', async () => {
    const result = await service.applyEffectsForDamage({
      entityId: 'entity-1',
      partId: 'part-1',
      damageEntry: { name: 'piercing', amount: 5, severity: 'standard' },
      maxHealth: 200,
      currentHealth: 195,
    });

    expect(result).toEqual({ severity: 'standard' });
  });
});
