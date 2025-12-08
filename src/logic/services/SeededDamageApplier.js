/**
 * @file Applies seeded damage defined on anatomy recipes by delegating to the existing damage pipeline.
 */

import DamageResolutionService from './damageResolutionService.js';

export class SeededDamageApplier {
  /** @type {DamageResolutionService} */
  #damageResolutionService;
  /** @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;

  /**
   * @param {object} deps
   * @param {DamageResolutionService} deps.damageResolutionService
   * @param {import('../../interfaces/coreServices.js').ILogger} deps.logger
   */
  constructor({ damageResolutionService, logger }) {
    this.#damageResolutionService = damageResolutionService;
    this.#logger = logger;
  }

  /**
   * Applies seeded damage entries to the generated parts.
   *
   * @param {object} params
   * @param {string} params.ownerId
   * @param {string} params.recipeId
   * @param {object} params.initialDamage
   * @param {Map<string, string>|object} params.slotToPartMappings
   */
  async applySeededDamage({ ownerId, recipeId, initialDamage, slotToPartMappings }) {
    if (!initialDamage || Object.keys(initialDamage).length === 0) {
      this.#logger?.debug?.(
        'SeededDamageApplier: No initialDamage configured, skipping seeded damage application'
      );
      return;
    }

    if (!this.#damageResolutionService?.resolve) {
      this.#logger?.warn?.(
        'SeededDamageApplier: Missing damageResolutionService, skipping seeded damage application'
      );
      return;
    }

    const normalizedMappings = this.#normalizeSlotToPartMappings(slotToPartMappings);
    if (normalizedMappings.size === 0) {
      throw new Error(
        `SeededDamageApplier: slotToPartMappings unavailable for recipe '${recipeId}' with initialDamage entries`
      );
    }

    for (const [slotId, damageConfig] of Object.entries(initialDamage)) {
      const targetPartId = normalizedMappings.get(slotId);
      if (!targetPartId) {
        throw new Error(
          `SeededDamageApplier: No generated part found for slot '${slotId}' while applying initialDamage in recipe '${recipeId}'`
        );
      }

      const damageEntries = this.#normalizeDamageEntries(damageConfig, slotId, recipeId);

      for (const damageEntry of damageEntries) {
        const finalDamageEntry = this.#buildFinalDamageEntry(
          damageEntry,
          slotId,
          recipeId
        );

        const applyDamage = async (params, executionContext) => {
          const { entity_ref, part_ref, damage_entry, propagatedFrom } = params;
          const propagatedEntry = this.#buildFinalDamageEntry(
            damage_entry,
            slotId,
            recipeId
          );

          return this.#damageResolutionService.resolve({
            entityId: entity_ref || ownerId,
            partId: part_ref,
            finalDamageEntry: propagatedEntry,
            propagatedFrom,
            executionContext,
            isTopLevel: false,
            applyDamage,
          });
        };

        await this.#damageResolutionService.resolve({
          entityId: ownerId,
          partId: targetPartId,
          finalDamageEntry,
          executionContext: {
            origin: 'seeded_damage',
            recipeId,
            slotId,
            suppressPerceptibleEvents: true,
          },
          isTopLevel: true,
          applyDamage,
        });
      }
    }
  }

  #normalizeSlotToPartMappings(slotToPartMappings) {
    if (!slotToPartMappings) {
      return new Map();
    }

    const entries =
      slotToPartMappings instanceof Map
        ? Array.from(slotToPartMappings.entries())
        : Object.entries(slotToPartMappings);

    return new Map(
      entries.filter(
        ([slotKey]) =>
          slotKey !== null && slotKey !== undefined && slotKey !== 'null'
      )
    );
  }

  #normalizeDamageEntries(damageConfig, slotId, recipeId) {
    if (!damageConfig) {
      throw new Error(
        `SeededDamageApplier: Missing damage config for slot '${slotId}' in recipe '${recipeId}'`
      );
    }

    if (
      typeof damageConfig === 'object' &&
      !Array.isArray(damageConfig) &&
      Array.isArray(damageConfig.damage_entries)
    ) {
      return damageConfig.damage_entries;
    }

    return [damageConfig];
  }

  #buildFinalDamageEntry(entry, slotId, recipeId) {
    const normalizedEntry = { ...entry };
    const damageName = normalizedEntry.name || normalizedEntry.damage_type;
    if (!damageName) {
      throw new Error(
        `SeededDamageApplier: Damage entry for slot '${slotId}' in recipe '${recipeId}' is missing a damage type`
      );
    }

    const damageTags =
      normalizedEntry.damageTags || normalizedEntry.damage_tags || undefined;
    const metadata =
      normalizedEntry.metadata &&
      typeof normalizedEntry.metadata === 'object' &&
      !Array.isArray(normalizedEntry.metadata)
        ? { ...normalizedEntry.metadata }
        : {};

    return {
      ...normalizedEntry,
      name: damageName,
      damageTags,
      metadata: {
        ...metadata,
        slotId,
        recipeId,
      },
    };
  }
}

export default SeededDamageApplier;
