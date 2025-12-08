import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DamageTypeEffectsService from '../../../../src/anatomy/services/damageTypeEffectsService.js';

describe('DamageTypeEffectsService - negligible severity return', () => {
  let service;
  let logger;
  let entityManager;
  let dispatcher;

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

    service = new DamageTypeEffectsService({
      logger,
      entityManager,
      safeEventDispatcher: dispatcher,
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
