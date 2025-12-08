import { describe, expect, it, jest } from '@jest/globals';
import SeededDamageApplier from '../../../../src/logic/services/SeededDamageApplier.js';

describe('SeededDamageApplier', () => {
  const logger = { debug: jest.fn(), warn: jest.fn() };

  it('throws when a slot cannot be resolved to a part', async () => {
    const damageResolutionService = { resolve: jest.fn() };
    const applier = new SeededDamageApplier({
      damageResolutionService,
      logger,
    });

    await expect(
      applier.applySeededDamage({
        ownerId: 'entity-1',
        recipeId: 'anatomy:missing_slot_recipe',
        initialDamage: { head: { amount: 2, name: 'blunt' } },
        slotToPartMappings: {},
      })
    ).rejects.toThrow(/slotToPartMappings unavailable/);
  });

  it('normalizes shorthand entries and delegates to the damage resolution service', async () => {
    const damageResolutionService = { resolve: jest.fn().mockResolvedValue() };
    const applier = new SeededDamageApplier({
      damageResolutionService,
      logger,
    });

    await applier.applySeededDamage({
      ownerId: 'entity-1',
      recipeId: 'anatomy:seeded_recipe',
      initialDamage: {
        arm_slot: {
          amount: 4,
          damage_type: 'piercing',
          metadata: { note: 'seeded' },
          damage_tags: ['seeded'],
        },
      },
      slotToPartMappings: new Map([['arm_slot', 'part-1']]),
    });

    expect(damageResolutionService.resolve).toHaveBeenCalledTimes(1);
    const resolveArgs = damageResolutionService.resolve.mock.calls[0][0];
    expect(resolveArgs.partId).toBe('part-1');
    expect(resolveArgs.executionContext).toMatchObject({
      origin: 'seeded_damage',
      slotId: 'arm_slot',
      recipeId: 'anatomy:seeded_recipe',
      suppressPerceptibleEvents: true,
    });
    expect(resolveArgs.finalDamageEntry).toMatchObject({
      name: 'piercing',
      amount: 4,
      metadata: { note: 'seeded', slotId: 'arm_slot', recipeId: 'anatomy:seeded_recipe' },
      damageTags: ['seeded'],
    });
  });
});
