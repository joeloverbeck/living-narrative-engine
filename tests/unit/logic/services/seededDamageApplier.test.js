import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import SeededDamageApplier from '../../../../src/logic/services/SeededDamageApplier.js';

describe('SeededDamageApplier', () => {
  let logger;

  beforeEach(() => {
    logger = { debug: jest.fn(), warn: jest.fn() };
  });

  describe('early return conditions', () => {
    it('skips when initialDamage is undefined', async () => {
      const damageResolutionService = { resolve: jest.fn() };
      const applier = new SeededDamageApplier({ damageResolutionService, logger });

      await applier.applySeededDamage({
        ownerId: 'entity-1',
        recipeId: 'anatomy:test_recipe',
        initialDamage: undefined,
        slotToPartMappings: new Map([['head', 'part-1']]),
      });

      expect(damageResolutionService.resolve).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No initialDamage configured')
      );
    });

    it('skips when initialDamage is empty object', async () => {
      const damageResolutionService = { resolve: jest.fn() };
      const applier = new SeededDamageApplier({ damageResolutionService, logger });

      await applier.applySeededDamage({
        ownerId: 'entity-1',
        recipeId: 'anatomy:test_recipe',
        initialDamage: {},
        slotToPartMappings: new Map([['head', 'part-1']]),
      });

      expect(damageResolutionService.resolve).not.toHaveBeenCalled();
    });

    it('skips when damageResolutionService lacks resolve method', async () => {
      const damageResolutionService = {};
      const applier = new SeededDamageApplier({ damageResolutionService, logger });

      await applier.applySeededDamage({
        ownerId: 'entity-1',
        recipeId: 'anatomy:test_recipe',
        initialDamage: { head: { name: 'blunt', amount: 1 } },
        slotToPartMappings: new Map([['head', 'part-1']]),
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing damageResolutionService')
      );
    });

    it('skips when damageResolutionService is undefined', async () => {
      const applier = new SeededDamageApplier({
        damageResolutionService: undefined,
        logger,
      });

      await applier.applySeededDamage({
        ownerId: 'entity-1',
        recipeId: 'anatomy:test_recipe',
        initialDamage: { head: { name: 'blunt', amount: 1 } },
        slotToPartMappings: new Map([['head', 'part-1']]),
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Missing damageResolutionService')
      );
    });
  });

  describe('slot to part mapping errors', () => {
    it('throws when slotToPartMappings is empty with initialDamage', async () => {
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

    it('throws when slot exists in initialDamage but not in mappings', async () => {
      const damageResolutionService = { resolve: jest.fn() };
      const applier = new SeededDamageApplier({
        damageResolutionService,
        logger,
      });

      await expect(
        applier.applySeededDamage({
          ownerId: 'entity-1',
          recipeId: 'anatomy:test_recipe',
          initialDamage: { arm: { amount: 2, name: 'slash' } },
          slotToPartMappings: new Map([['head', 'part-1']]),
        })
      ).rejects.toThrow(/No generated part found for slot 'arm'/);
    });

    it('throws when slotToPartMappings is null with initialDamage', async () => {
      const damageResolutionService = { resolve: jest.fn() };
      const applier = new SeededDamageApplier({
        damageResolutionService,
        logger,
      });

      await expect(
        applier.applySeededDamage({
          ownerId: 'entity-1',
          recipeId: 'anatomy:test_recipe',
          initialDamage: { head: { amount: 2, name: 'blunt' } },
          slotToPartMappings: null,
        })
      ).rejects.toThrow(/slotToPartMappings unavailable/);
    });
  });

  describe('damage entry processing', () => {
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

    it('processes damage_entries array format', async () => {
      const damageResolutionService = { resolve: jest.fn().mockResolvedValue() };
      const applier = new SeededDamageApplier({
        damageResolutionService,
        logger,
      });

      await applier.applySeededDamage({
        ownerId: 'entity-1',
        recipeId: 'anatomy:array_format_recipe',
        initialDamage: {
          head: {
            damage_entries: [
              { name: 'blunt', amount: 2 },
              { name: 'piercing', amount: 1 },
            ],
          },
        },
        slotToPartMappings: new Map([['head', 'part-head']]),
      });

      expect(damageResolutionService.resolve).toHaveBeenCalledTimes(2);
      expect(damageResolutionService.resolve.mock.calls[0][0].finalDamageEntry.name).toBe(
        'blunt'
      );
      expect(damageResolutionService.resolve.mock.calls[1][0].finalDamageEntry.name).toBe(
        'piercing'
      );
    });

    it('processes slotToPartMappings as plain object', async () => {
      const damageResolutionService = { resolve: jest.fn().mockResolvedValue() };
      const applier = new SeededDamageApplier({
        damageResolutionService,
        logger,
      });

      await applier.applySeededDamage({
        ownerId: 'entity-1',
        recipeId: 'anatomy:object_mapping_recipe',
        initialDamage: { head: { name: 'blunt', amount: 1 } },
        slotToPartMappings: { head: 'part-head' },
      });

      expect(damageResolutionService.resolve).toHaveBeenCalledTimes(1);
      expect(damageResolutionService.resolve.mock.calls[0][0].partId).toBe('part-head');
    });

    it('filters out null slot keys from mappings', async () => {
      const damageResolutionService = { resolve: jest.fn().mockResolvedValue() };
      const applier = new SeededDamageApplier({
        damageResolutionService,
        logger,
      });

      await applier.applySeededDamage({
        ownerId: 'entity-1',
        recipeId: 'anatomy:filter_null_recipe',
        initialDamage: { head: { name: 'blunt', amount: 1 } },
        slotToPartMappings: { head: 'part-head', null: 'should-be-filtered' },
      });

      expect(damageResolutionService.resolve).toHaveBeenCalledTimes(1);
    });

    it('uses name field when both name and damage_type provided', async () => {
      const damageResolutionService = { resolve: jest.fn().mockResolvedValue() };
      const applier = new SeededDamageApplier({
        damageResolutionService,
        logger,
      });

      await applier.applySeededDamage({
        ownerId: 'entity-1',
        recipeId: 'anatomy:name_priority_recipe',
        initialDamage: {
          head: { name: 'blunt', damage_type: 'piercing', amount: 1 },
        },
        slotToPartMappings: new Map([['head', 'part-head']]),
      });

      expect(damageResolutionService.resolve.mock.calls[0][0].finalDamageEntry.name).toBe(
        'blunt'
      );
    });

    it('falls back to damage_type when name is missing', async () => {
      const damageResolutionService = { resolve: jest.fn().mockResolvedValue() };
      const applier = new SeededDamageApplier({
        damageResolutionService,
        logger,
      });

      await applier.applySeededDamage({
        ownerId: 'entity-1',
        recipeId: 'anatomy:fallback_recipe',
        initialDamage: { head: { damage_type: 'slash', amount: 1 } },
        slotToPartMappings: new Map([['head', 'part-head']]),
      });

      expect(damageResolutionService.resolve.mock.calls[0][0].finalDamageEntry.name).toBe(
        'slash'
      );
    });

    it('handles damageTags alternative field name', async () => {
      const damageResolutionService = { resolve: jest.fn().mockResolvedValue() };
      const applier = new SeededDamageApplier({
        damageResolutionService,
        logger,
      });

      await applier.applySeededDamage({
        ownerId: 'entity-1',
        recipeId: 'anatomy:damageTags_recipe',
        initialDamage: { head: { name: 'blunt', amount: 1, damageTags: ['seeded', 'initial'] } },
        slotToPartMappings: new Map([['head', 'part-head']]),
      });

      expect(
        damageResolutionService.resolve.mock.calls[0][0].finalDamageEntry.damageTags
      ).toEqual(['seeded', 'initial']);
    });

    it('handles entry with no metadata gracefully', async () => {
      const damageResolutionService = { resolve: jest.fn().mockResolvedValue() };
      const applier = new SeededDamageApplier({
        damageResolutionService,
        logger,
      });

      await applier.applySeededDamage({
        ownerId: 'entity-1',
        recipeId: 'anatomy:no_metadata_recipe',
        initialDamage: { head: { name: 'blunt', amount: 1 } },
        slotToPartMappings: new Map([['head', 'part-head']]),
      });

      expect(
        damageResolutionService.resolve.mock.calls[0][0].finalDamageEntry.metadata
      ).toEqual({
        slotId: 'head',
        recipeId: 'anatomy:no_metadata_recipe',
      });
    });

    it('ignores non-object metadata values', async () => {
      const damageResolutionService = { resolve: jest.fn().mockResolvedValue() };
      const applier = new SeededDamageApplier({
        damageResolutionService,
        logger,
      });

      await applier.applySeededDamage({
        ownerId: 'entity-1',
        recipeId: 'anatomy:invalid_metadata_recipe',
        initialDamage: { head: { name: 'blunt', amount: 1, metadata: 'invalid-string' } },
        slotToPartMappings: new Map([['head', 'part-head']]),
      });

      expect(
        damageResolutionService.resolve.mock.calls[0][0].finalDamageEntry.metadata
      ).toEqual({
        slotId: 'head',
        recipeId: 'anatomy:invalid_metadata_recipe',
      });
    });

    it('ignores array metadata values', async () => {
      const damageResolutionService = { resolve: jest.fn().mockResolvedValue() };
      const applier = new SeededDamageApplier({
        damageResolutionService,
        logger,
      });

      await applier.applySeededDamage({
        ownerId: 'entity-1',
        recipeId: 'anatomy:array_metadata_recipe',
        initialDamage: { head: { name: 'blunt', amount: 1, metadata: ['invalid', 'array'] } },
        slotToPartMappings: new Map([['head', 'part-head']]),
      });

      expect(
        damageResolutionService.resolve.mock.calls[0][0].finalDamageEntry.metadata
      ).toEqual({
        slotId: 'head',
        recipeId: 'anatomy:array_metadata_recipe',
      });
    });
  });

  describe('error conditions', () => {
    it('throws when damageConfig for slot is null', async () => {
      const damageResolutionService = { resolve: jest.fn() };
      const applier = new SeededDamageApplier({
        damageResolutionService,
        logger,
      });

      await expect(
        applier.applySeededDamage({
          ownerId: 'entity-1',
          recipeId: 'anatomy:null_config_recipe',
          initialDamage: { head: null },
          slotToPartMappings: new Map([['head', 'part-head']]),
        })
      ).rejects.toThrow(/Missing damage config for slot 'head'/);
    });

    it('throws when damage entry lacks name and damage_type', async () => {
      const damageResolutionService = { resolve: jest.fn() };
      const applier = new SeededDamageApplier({
        damageResolutionService,
        logger,
      });

      await expect(
        applier.applySeededDamage({
          ownerId: 'entity-1',
          recipeId: 'anatomy:missing_type_recipe',
          initialDamage: { head: { amount: 5 } },
          slotToPartMappings: new Map([['head', 'part-head']]),
        })
      ).rejects.toThrow(/missing a damage type/);
    });
  });

  describe('applyDamage callback propagation', () => {
    it('provides applyDamage callback that delegates to damageResolutionService', async () => {
      let capturedApplyDamage;
      const damageResolutionService = {
        resolve: jest.fn().mockImplementation((params) => {
          capturedApplyDamage = params.applyDamage;
          return Promise.resolve();
        }),
      };
      const applier = new SeededDamageApplier({
        damageResolutionService,
        logger,
      });

      await applier.applySeededDamage({
        ownerId: 'entity-1',
        recipeId: 'anatomy:callback_recipe',
        initialDamage: { head: { name: 'blunt', amount: 1 } },
        slotToPartMappings: new Map([['head', 'part-head']]),
      });

      expect(capturedApplyDamage).toBeDefined();
      expect(typeof capturedApplyDamage).toBe('function');

      damageResolutionService.resolve.mockClear();

      await capturedApplyDamage(
        {
          entity_ref: 'propagated-entity',
          part_ref: 'propagated-part',
          damage_entry: { name: 'propagated_damage', amount: 3 },
          propagatedFrom: 'source-part',
        },
        { testContext: true }
      );

      expect(damageResolutionService.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'propagated-entity',
          partId: 'propagated-part',
          propagatedFrom: 'source-part',
          isTopLevel: false,
          finalDamageEntry: expect.objectContaining({
            name: 'propagated_damage',
            amount: 3,
            metadata: expect.objectContaining({
              slotId: 'head',
              recipeId: 'anatomy:callback_recipe',
            }),
          }),
        })
      );
    });

    it('uses ownerId when entity_ref is not provided in callback', async () => {
      let capturedApplyDamage;
      const damageResolutionService = {
        resolve: jest.fn().mockImplementation((params) => {
          capturedApplyDamage = params.applyDamage;
          return Promise.resolve();
        }),
      };
      const applier = new SeededDamageApplier({
        damageResolutionService,
        logger,
      });

      await applier.applySeededDamage({
        ownerId: 'original-entity',
        recipeId: 'anatomy:fallback_owner_recipe',
        initialDamage: { head: { name: 'blunt', amount: 1 } },
        slotToPartMappings: new Map([['head', 'part-head']]),
      });

      damageResolutionService.resolve.mockClear();

      await capturedApplyDamage(
        {
          part_ref: 'propagated-part',
          damage_entry: { name: 'propagated_damage', amount: 2 },
        },
        {}
      );

      expect(damageResolutionService.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'original-entity',
        })
      );
    });
  });
});
