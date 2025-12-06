/**
 * @file Handler for APPLY_DAMAGE operation
 *
 * Applies direct damage to a specific part of an entity.
 * Handles target resolution (if part not specified), health updates, state transitions,
 * and event dispatching.
 *
 * Operation flow:
 * 1. Validates operation parameters.
 * 2. Resolves entity reference.
 * 3. Resolves part reference. If missing, selects a random part based on hit weights.
 * 4. Resolves damage amount and type.
 * 5. Dispatches anatomy:damage_applied event.
 * 6. Retrieves anatomy:part_health component.
 * 7. Calculates new health (clamped at 0).
 * 8. Calculates new health state.
 * 9. Updates anatomy:part_health component.
 * 10. Dispatches anatomy:part_health_changed event.
 * 11. Dispatches anatomy:part_destroyed event if health reaches 0.
 */

import BaseOperationHandler from './baseOperationHandler.js';
import { assertParamsObject } from '../../utils/handlerUtils/paramsUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { resolveEntityId } from '../../utils/entityRefUtils.js';
import { filterEligibleHitTargets } from '../../anatomy/utils/hitProbabilityWeightUtils.js';
import DamageResolutionService from '../services/damageResolutionService.js';

const PART_COMPONENT_ID = 'anatomy:part';
const BODY_COMPONENT_ID = 'anatomy:body';

class ApplyDamageHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;
  /** @type {import('../jsonLogicEvaluationService.js').default} */ #jsonLogicService;
  /** @type {import('../../anatomy/bodyGraphService.js').default} */ #bodyGraphService;
  /** @type {DamageResolutionService} */ #damageResolutionService;

  constructor({
    logger,
    entityManager,
    safeEventDispatcher,
    jsonLogicService,
    bodyGraphService,
    damageTypeEffectsService,
    damagePropagationService,
    deathCheckService,
    damageAccumulator,
    damageNarrativeComposer,
    damageResolutionService,
  }) {
    super('ApplyDamageHandler', {
      logger: { value: logger },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'addComponent', 'hasComponent'],
      },
      safeEventDispatcher: {
        value: safeEventDispatcher,
        requiredMethods: ['dispatch'],
      },
      jsonLogicService: {
        value: jsonLogicService,
        requiredMethods: ['evaluate'],
      },
      bodyGraphService: {
        value: bodyGraphService,
        requiredMethods: ['getAllParts'],
      },
      damageTypeEffectsService: {
        value: damageTypeEffectsService,
        requiredMethods: ['applyEffectsForDamage'],
      },
      damagePropagationService: {
        value: damagePropagationService,
        requiredMethods: ['propagateDamage'],
      },
      deathCheckService: {
        value: deathCheckService,
        requiredMethods: ['checkDeathConditions'],
      },
      damageAccumulator: {
        value: damageAccumulator,
        requiredMethods: [
          'createSession',
          'recordDamage',
          'recordEffect',
          'queueEvent',
          'finalize',
        ],
      },
      damageNarrativeComposer: {
        value: damageNarrativeComposer,
        requiredMethods: ['compose'],
      },
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#jsonLogicService = jsonLogicService;
    this.#bodyGraphService = bodyGraphService;
    this.#damageResolutionService =
      damageResolutionService ||
      new DamageResolutionService({
        logger,
        entityManager,
        safeEventDispatcher,
        damageTypeEffectsService,
        damagePropagationService,
        deathCheckService,
        damageAccumulator,
        damageNarrativeComposer,
      });

    if (!this.#damageResolutionService?.resolve) {
      throw new Error(
        'ApplyDamageHandler requires a DamageResolutionService with a resolve method'
      );
    }
  }

  /**
   * Resolves an entity reference to an entity ID.
   * Supports placeholder names (primary, secondary, tertiary), keywords (actor, target),
   * direct entity ID strings, and JSON Logic expressions.
   *
   * @param {string|object} ref - The entity reference to resolve
   * @param {object} context - The execution context
   * @param {object} logger - Logger instance
   * @returns {string|null} - Resolved entity ID or null
   */
  #resolveEntityRef(ref, context, logger) {
    // First try resolveEntityId for placeholder/keyword support
    const resolvedId = resolveEntityId(ref, context);
    if (resolvedId) return resolvedId;

    // Fall back to JSON Logic evaluation for object refs
    if (typeof ref === 'object' && ref !== null) {
      try {
        const resolved = this.#jsonLogicService.evaluate(ref, context);
        if (typeof resolved === 'string' && resolved.trim())
          return resolved.trim();
        if (typeof resolved === 'object' && resolved !== null) {
          const id = resolved.id || resolved.entityId;
          if (typeof id === 'string' && id.trim()) return id.trim();
        }
      } catch (err) {
        logger.warn('APPLY_DAMAGE: Failed to evaluate ref', {
          error: err.message,
        });
      }
    }
    return null;
  }

  /**
   * Resolves a generic reference (for parts, etc.) that may be a string or JSON Logic.
   * Used for part_ref resolution where placeholder names don't apply.
   *
   * @param {string|object} ref - The reference to resolve
   * @param {object} context - The execution context
   * @param {object} logger - Logger instance
   * @returns {string|null} - Resolved ID or null
   */
  #resolveRef(ref, context, logger) {
    if (typeof ref === 'string' && ref.trim()) return ref.trim();
    if (typeof ref === 'object' && ref !== null) {
      try {
        const resolved = this.#jsonLogicService.evaluate(ref, context);
        if (typeof resolved === 'string' && resolved.trim())
          return resolved.trim();
        if (typeof resolved === 'object' && resolved !== null) {
          const id = resolved.id || resolved.entityId;
          if (typeof id === 'string' && id.trim()) return id.trim();
        }
      } catch (err) {
        logger.warn('APPLY_DAMAGE: Failed to evaluate ref', {
          error: err.message,
        });
      }
    }
    return null;
  }

  #resolveValue(value, context, logger, type = 'number') {
    if (typeof value === type) return value;
    if (typeof value === 'object' && value !== null) {
      try {
        const resolved = this.#jsonLogicService.evaluate(value, context);
        if (typeof resolved === type) return resolved;
      } catch (err) {
        logger.warn(
          `APPLY_DAMAGE: Failed to evaluate value (expected ${type})`,
          { error: err.message }
        );
      }
    }
    return type === 'number' ? NaN : null;
  }

  #resolveMetadata(metadata, executionContext, logger) {
    if (metadata === undefined || metadata === null) return {};

    if (
      typeof metadata === 'object' &&
      metadata !== null &&
      !metadata.var &&
      !metadata.if
    ) {
      return metadata;
    }

    if (typeof metadata === 'object' && metadata !== null) {
      try {
        const resolved = this.#jsonLogicService.evaluate(
          metadata,
          executionContext
        );
        if (
          resolved &&
          typeof resolved === 'object' &&
          !Array.isArray(resolved)
        ) {
          return resolved;
        }
      } catch (err) {
        logger.warn('APPLY_DAMAGE: Failed to evaluate metadata', {
          error: err.message,
        });
      }
    }

    logger.warn('APPLY_DAMAGE: Ignoring metadata - expected object', {
      metadata,
    });
    return {};
  }

  #resolveDamageTags(damageTags, executionContext, logger) {
    if (damageTags === undefined || damageTags === null) return [];

    let resolved = damageTags;
    if (
      !Array.isArray(damageTags) &&
      typeof damageTags === 'object' &&
      damageTags !== null
    ) {
      try {
        resolved = this.#jsonLogicService.evaluate(
          damageTags,
          executionContext
        );
      } catch (err) {
        logger.warn('APPLY_DAMAGE: Failed to evaluate damage_tags', {
          error: err.message,
        });
        resolved = [];
      }
    }

    if (!Array.isArray(resolved)) {
      logger.warn(
        'APPLY_DAMAGE: damage_tags must resolve to an array of strings',
        { damage_tags: damageTags }
      );
      return [];
    }

    const filtered = resolved.filter((tag) => typeof tag === 'string');
    return Array.from(new Set(filtered));
  }

  #resolveHitStrategy(hitStrategy, executionContext, logger) {
    if (!hitStrategy) {
      return { reuseCachedHit: true, hintPartId: null };
    }

    let resolved = hitStrategy;
    if (
      typeof hitStrategy === 'object' &&
      hitStrategy !== null &&
      (hitStrategy.var || hitStrategy.if)
    ) {
      try {
        resolved = this.#jsonLogicService.evaluate(
          hitStrategy,
          executionContext
        );
      } catch (err) {
        logger.warn('APPLY_DAMAGE: Failed to evaluate hit_strategy', {
          error: err.message,
        });
        return { reuseCachedHit: true, hintPartId: null };
      }
    }

    const reuseCachedHit =
      typeof resolved?.reuse_cached === 'boolean'
        ? resolved.reuse_cached
        : true;
    const hintPartId =
      resolved && Object.prototype.hasOwnProperty.call(resolved, 'hint_part')
        ? this.#resolveRef(resolved.hint_part, executionContext, logger)
        : null;

    return { reuseCachedHit, hintPartId };
  }

  #resolveNamedRng(rngRef, executionContext, logger) {
    if (!rngRef) return null;

    let resolvedRef = rngRef;
    if (typeof rngRef === 'object' && rngRef !== null) {
      try {
        resolvedRef = this.#jsonLogicService.evaluate(rngRef, executionContext);
      } catch (err) {
        logger.warn('APPLY_DAMAGE: Failed to evaluate rng_ref', {
          error: err.message,
        });
        return null;
      }
    }

    if (typeof resolvedRef !== 'string' || !resolvedRef.trim()) {
      logger.warn('APPLY_DAMAGE: rng_ref must resolve to a string', {
        rng_ref: rngRef,
      });
      return null;
    }

    const registries = [
      executionContext?.rngRegistry,
      executionContext?.rngRefs,
      executionContext?.rngMap,
      executionContext?.rngs,
    ];
    const provider = registries.find(
      (registry) => registry && typeof registry[resolvedRef] === 'function'
    );

    if (provider) return provider[resolvedRef];

    logger.warn(
      'APPLY_DAMAGE: rng_ref provided but no matching RNG found on executionContext',
      {
        rng_ref: resolvedRef,
      }
    );
    return null;
  }

  #getRng(executionContext, rngOverride = null) {
    if (typeof rngOverride === 'function') {
      return rngOverride;
    }
    if (executionContext && typeof executionContext.rng === 'function') {
      return executionContext.rng;
    }
    if (
      executionContext &&
      typeof executionContext.rngProvider === 'function'
    ) {
      return executionContext.rngProvider;
    }
    return Math.random;
  }

  #selectRandomPart(entityId, logger, rng = Math.random) {
    if (!this.#entityManager.hasComponent(entityId, BODY_COMPONENT_ID)) {
      logger.warn(
        `APPLY_DAMAGE: Entity ${entityId} has no anatomy:body component.`
      );
      return null;
    }

    const bodyComponent = this.#entityManager.getComponentData(
      entityId,
      BODY_COMPONENT_ID
    );

    try {
      const allPartIds = this.#bodyGraphService.getAllParts(
        bodyComponent,
        entityId
      );

      // Build array of parts with components for filtering
      const partsWithComponents = allPartIds.map((partId) => ({
        id: partId,
        component: this.#entityManager.getComponentData(
          partId,
          PART_COMPONENT_ID
        ),
      }));

      // Use shared helper for consistent weight resolution and filtering
      const candidateParts = filterEligibleHitTargets(partsWithComponents);

      if (candidateParts.length === 0) return null;

      const totalWeight = candidateParts.reduce(
        (sum, part) => sum + part.weight,
        0
      );
      if (totalWeight <= 0) return candidateParts[0].id;

      let randomValue = rng() * totalWeight;
      for (const part of candidateParts) {
        randomValue -= part.weight;
        if (randomValue <= 0) return part.id;
      }
      return candidateParts[candidateParts.length - 1].id;
    } catch (error) {
      logger.error(
        `APPLY_DAMAGE: Error resolving hit location for ${entityId}`,
        error
      );
      return null;
    }
  }

  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);
    if (!assertParamsObject(params, this.#dispatcher, 'APPLY_DAMAGE')) return;

    const {
      entity_ref,
      part_ref,
      damage_entry,
      amount,
      damage_type,
      damage_multiplier,
      exclude_damage_types,
      metadata,
      damage_tags,
      hit_strategy,
      rng_ref,
      propagatedFrom = null,
    } = params;

    const rngOverride = this.#resolveNamedRng(rng_ref, executionContext, log);
    const rng = this.#getRng(executionContext, rngOverride);

    if (
      executionContext &&
      typeof executionContext === 'object' &&
      !executionContext.rng
    ) {
      executionContext.rng = rng;
    }

    // 1. Resolve Entity (supports placeholder names like "secondary", "primary", etc.)
    const entityId = this.#resolveEntityRef(entity_ref, executionContext, log);

    const isTopLevel = !propagatedFrom;
    const hitLocationCache = executionContext?.hitLocationCache || null;
    if (!entityId) {
      safeDispatchError(
        this.#dispatcher,
        'APPLY_DAMAGE: Invalid entity_ref',
        { entity_ref },
        log
      );
      return;
    }

    // 2. Resolve Part
    let partId = null;
    const { reuseCachedHit, hintPartId } = this.#resolveHitStrategy(
      hit_strategy,
      executionContext,
      log
    );

    if (part_ref) {
      partId = this.#resolveRef(part_ref, executionContext, log);
    }

    if (!partId && hintPartId) {
      partId = hintPartId;
    }

    // Reuse the same resolved hit location for multiple damage entries in the same action
    if (
      !partId &&
      isTopLevel &&
      reuseCachedHit &&
      hitLocationCache?.[entityId]
    ) {
      partId = hitLocationCache[entityId];
    }

    if (!partId) {
      // Auto-resolve if missing or failed to resolve
      partId = this.#selectRandomPart(entityId, log, rng);
      if (!partId) {
        safeDispatchError(
          this.#dispatcher,
          'APPLY_DAMAGE: Could not resolve target part',
          { entityId },
          log
        );
        return;
      }
    }

    // Cache the chosen hit location so subsequent APPLY_DAMAGE calls for the same entity reuse it
    if (isTopLevel && reuseCachedHit) {
      executionContext.hitLocationCache =
        executionContext.hitLocationCache || {};
      executionContext.hitLocationCache[entityId] = partId;
    }

    // 3. Resolve damage entry or construct from legacy parameters
    let resolvedDamageEntry;
    if (damage_entry) {
      // New mode: use damage_entry object directly or resolve from JSON Logic
      if (
        typeof damage_entry === 'object' &&
        damage_entry !== null &&
        !damage_entry.var &&
        !damage_entry.if
      ) {
        // Direct object with damage entry structure
        resolvedDamageEntry = damage_entry;
      } else {
        // JSON Logic expression - evaluate it
        try {
          resolvedDamageEntry = this.#jsonLogicService.evaluate(
            damage_entry,
            executionContext
          );
        } catch (err) {
          safeDispatchError(
            this.#dispatcher,
            'APPLY_DAMAGE: Failed to evaluate damage_entry',
            { error: err.message },
            log
          );
          return;
        }
      }
      if (
        !resolvedDamageEntry ||
        typeof resolvedDamageEntry.amount !== 'number'
      ) {
        safeDispatchError(
          this.#dispatcher,
          'APPLY_DAMAGE: Invalid damage_entry (missing amount)',
          { damage_entry: resolvedDamageEntry },
          log
        );
        return;
      }
      if (!resolvedDamageEntry.name) {
        safeDispatchError(
          this.#dispatcher,
          'APPLY_DAMAGE: Invalid damage_entry (missing name)',
          { damage_entry: resolvedDamageEntry },
          log
        );
        return;
      }
    } else if (damage_type !== undefined && amount !== undefined) {
      // Legacy mode: construct damage entry from individual parameters
      log.warn(
        'DEPRECATED: Using damage_type + amount parameters. Migrate to damage_entry object.'
      );
      const resolvedAmount = this.#resolveValue(
        amount,
        executionContext,
        log,
        'number'
      );
      const resolvedType = this.#resolveValue(
        damage_type,
        executionContext,
        log,
        'string'
      );

      if (isNaN(resolvedAmount) || resolvedAmount < 0) {
        safeDispatchError(
          this.#dispatcher,
          'APPLY_DAMAGE: Invalid amount',
          { amount: resolvedAmount },
          log
        );
        return;
      }
      if (!resolvedType) {
        safeDispatchError(
          this.#dispatcher,
          'APPLY_DAMAGE: Invalid damage_type',
          { damage_type },
          log
        );
        return;
      }

      resolvedDamageEntry = { name: resolvedType, amount: resolvedAmount };
    } else {
      safeDispatchError(
        this.#dispatcher,
        'APPLY_DAMAGE: Either damage_entry or (damage_type + amount) required',
        { params },
        log
      );
      return;
    }

    // 3b. Check exclusion list
    if (exclude_damage_types) {
      let resolvedExcludeTypes = exclude_damage_types;

      // Resolve JSON Logic if needed
      if (
        typeof exclude_damage_types === 'object' &&
        !Array.isArray(exclude_damage_types)
      ) {
        try {
          resolvedExcludeTypes = this.#jsonLogicService.evaluate(
            exclude_damage_types,
            executionContext
          );
        } catch (err) {
          log.warn('APPLY_DAMAGE: Failed to evaluate exclude_damage_types', {
            error: err.message,
          });
          resolvedExcludeTypes = [];
        }
      }

      // Validate and check
      if (
        Array.isArray(resolvedExcludeTypes) &&
        resolvedExcludeTypes.length > 0
      ) {
        const damageTypeName = resolvedDamageEntry.name;
        if (resolvedExcludeTypes.includes(damageTypeName)) {
          log.debug(
            `APPLY_DAMAGE: Skipping excluded damage type '${damageTypeName}'`,
            {
              excluded: resolvedExcludeTypes,
            }
          );
          return; // Early return - do not apply this damage
        }
      }
    }

    // 3a. Resolve optional damage multiplier
    const resolvedMultiplier =
      damage_multiplier !== undefined
        ? this.#resolveValue(damage_multiplier, executionContext, log, 'number')
        : 1;

    if (isNaN(resolvedMultiplier) || resolvedMultiplier < 0) {
      safeDispatchError(
        this.#dispatcher,
        'APPLY_DAMAGE: Invalid damage_multiplier',
        { damage_multiplier },
        log
      );
      return;
    }

    const resolvedMetadata = this.#resolveMetadata(
      metadata !== undefined ? metadata : resolvedDamageEntry?.metadata,
      executionContext,
      log
    );
    const resolvedDamageTags = this.#resolveDamageTags(
      damage_tags !== undefined
        ? damage_tags
        : resolvedDamageEntry?.damage_tags || resolvedDamageEntry?.damageTags,
      executionContext,
      log
    );

    // Apply multiplier to amount while preserving other fields
    const finalDamageEntry = {
      ...resolvedDamageEntry,
      amount: resolvedDamageEntry.amount * resolvedMultiplier,
      metadata: resolvedMetadata,
      damageTags: resolvedDamageTags,
    };

    await this.#damageResolutionService.resolve({
      entityId,
      partId,
      finalDamageEntry,
      propagatedFrom,
      executionContext,
      isTopLevel,
      applyDamage: this.execute.bind(this),
      log,
      rng,
    });
  }
}

export default ApplyDamageHandler;
