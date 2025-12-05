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
import { calculateStateFromPercentage } from '../../anatomy/registries/healthStateRegistry.js';
import { POSITION_COMPONENT_ID } from '../../constants/componentIds.js';

const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';
const BODY_COMPONENT_ID = 'anatomy:body';
const NAME_COMPONENT_ID = 'core:name';
const GENDER_COMPONENT_ID = 'core:gender';
const DAMAGE_PROPAGATION_COMPONENT_ID = 'anatomy:damage_propagation';

const DAMAGE_APPLIED_EVENT = 'anatomy:damage_applied';

/**
 * Maps gender values to pronouns for message formatting.
 * @type {Readonly<Record<string, string>>}
 */
const PRONOUN_MAP = Object.freeze({
  male: 'he',
  female: 'she',
  neutral: 'they',
  unknown: 'they',
});

/**
 * Maps gender values to possessive pronouns for narrative formatting.
 * @type {Readonly<Record<string, string>>}
 */
const PRONOUN_POSSESSIVE_MAP = Object.freeze({
  male: 'his',
  female: 'her',
  neutral: 'their',
  unknown: 'their',
});
const PART_HEALTH_CHANGED_EVENT = 'anatomy:part_health_changed';
const PART_DESTROYED_EVENT = 'anatomy:part_destroyed';

class ApplyDamageHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;
  /** @type {import('../jsonLogicEvaluationService.js').default} */ #jsonLogicService;
  /** @type {import('../../anatomy/bodyGraphService.js').default} */ #bodyGraphService;
  /** @type {import('../../anatomy/services/damageTypeEffectsService.js').default} */ #damageTypeEffectsService;
  /** @type {import('../../anatomy/services/damagePropagationService.js').default} */ #damagePropagationService;
  /** @type {import('../../anatomy/services/deathCheckService.js').default} */ #deathCheckService;
  /** @type {import('../../anatomy/services/damageAccumulator.js').default} */ #damageAccumulator;
  /** @type {import('../../anatomy/services/damageNarrativeComposer.js').default} */ #damageNarrativeComposer;

  constructor({ logger, entityManager, safeEventDispatcher, jsonLogicService, bodyGraphService, damageTypeEffectsService, damagePropagationService, deathCheckService, damageAccumulator, damageNarrativeComposer }) {
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
        requiredMethods: ['createSession', 'recordDamage', 'recordEffect', 'queueEvent', 'finalize'],
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
    this.#damageTypeEffectsService = damageTypeEffectsService;
    this.#damagePropagationService = damagePropagationService;
    this.#deathCheckService = deathCheckService;
    this.#damageAccumulator = damageAccumulator;
    this.#damageNarrativeComposer = damageNarrativeComposer;
  }

  /**
   * Resolves entity name from the core:name component.
   * @param {string} entityId - Entity ID to resolve name for
   * @returns {string} Entity name or 'Unknown' if not found
   * @private
   */
  #getEntityName(entityId) {
    try {
      const nameData = this.#entityManager.getComponentData(entityId, NAME_COMPONENT_ID);
      return nameData?.text || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Resolves entity pronoun from the core:gender component.
   * @param {string} entityId - Entity ID to resolve pronoun for
   * @returns {string} Subject pronoun ('he', 'she', 'they')
   * @private
   */
  #getEntityPronoun(entityId) {
    try {
      const genderData = this.#entityManager.getComponentData(entityId, GENDER_COMPONENT_ID);
      const gender = genderData?.value || 'neutral';
      return PRONOUN_MAP[gender] || PRONOUN_MAP.neutral;
    } catch {
      return PRONOUN_MAP.neutral;
    }
  }

  /**
   * Resolves entity possessive pronoun from the core:gender component.
   * @param {string} entityId - Entity ID to resolve possessive for
   * @returns {string} Possessive pronoun ('his', 'her', 'their')
   * @private
   */
  #getEntityPossessive(entityId) {
    try {
      const genderData = this.#entityManager.getComponentData(entityId, GENDER_COMPONENT_ID);
      const gender = genderData?.value || 'neutral';
      return PRONOUN_POSSESSIVE_MAP[gender] || PRONOUN_POSSESSIVE_MAP.neutral;
    } catch {
      return PRONOUN_POSSESSIVE_MAP.neutral;
    }
  }

  /**
   * Resolves the entity's location from the core:position component.
   * @param {string} entityId - Entity ID to resolve location for
   * @returns {string|null} Location ID or null if not found
   * @private
   */
  #getEntityLocation(entityId) {
    try {
      const locationData = this.#entityManager.getComponentData(entityId, POSITION_COMPONENT_ID);
      return locationData?.locationId || null;
    } catch {
      return null;
    }
  }

  /**
   * Extracts actor ID from execution context.
   * Supports both nested structure (actor.id) and legacy top-level (actorId).
   *
   * @param {object} executionContext - Execution context
   * @returns {string|null} Actor ID or null
   * @private
   */
  #extractActorId(executionContext) {
    return executionContext?.actor?.id || executionContext?.actorId || null;
  }

  /**
   * Resolves location for perceptible event dispatch with fallback chain.
   * Tries target entity first, then falls back to actor's location.
   *
   * @param {string} targetEntityId - Target entity to find location for
   * @param {string|null} actorId - Actor entity ID as fallback
   * @param {object} log - Logger instance
   * @returns {string|null} Location ID or null if not resolvable
   * @private
   */
  #resolveLocationForEvent(targetEntityId, actorId, log) {
    // Primary: Target entity's location
    let locationId = this.#getEntityLocation(targetEntityId);
    if (locationId) return locationId;

    // Fallback: Actor's location (they should be co-located for damage)
    if (actorId) {
      locationId = this.#getEntityLocation(actorId);
      if (locationId) {
        log.warn(
          `APPLY_DAMAGE: Target entity ${targetEntityId} has no location, using actor's location`
        );
        return locationId;
      }
    }

    return null;
  }

  /**
   * Resolves part information from the anatomy:part component.
   * @param {string} partId - Part entity ID to resolve
   * @returns {{partType: string, orientation: string|null}} Part type and orientation
   * @private
   */
  #getPartInfo(partId) {
    try {
      const partData = this.#entityManager.getComponentData(partId, PART_COMPONENT_ID);
      return {
        partType: partData?.subType || 'body part',
        orientation: partData?.orientation || null,
      };
    } catch {
      return { partType: 'body part', orientation: null };
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
        if (typeof resolved === 'string' && resolved.trim()) return resolved.trim();
        if (typeof resolved === 'object' && resolved !== null) {
          const id = resolved.id || resolved.entityId;
          if (typeof id === 'string' && id.trim()) return id.trim();
        }
      } catch (err) {
        logger.warn('APPLY_DAMAGE: Failed to evaluate ref', { error: err.message });
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
        if (typeof resolved === 'string' && resolved.trim()) return resolved.trim();
        if (typeof resolved === 'object' && resolved !== null) {
           const id = resolved.id || resolved.entityId;
           if (typeof id === 'string' && id.trim()) return id.trim();
        }
      } catch (err) {
        logger.warn('APPLY_DAMAGE: Failed to evaluate ref', { error: err.message });
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
        logger.warn(`APPLY_DAMAGE: Failed to evaluate value (expected ${type})`, { error: err.message });
      }
    }
    return type === 'number' ? NaN : null;
  }

  #selectRandomPart(entityId, logger) {
    if (!this.#entityManager.hasComponent(entityId, BODY_COMPONENT_ID)) {
      logger.warn(`APPLY_DAMAGE: Entity ${entityId} has no anatomy:body component.`);
      return null;
    }

    const bodyComponent = this.#entityManager.getComponentData(entityId, BODY_COMPONENT_ID);

    try {
      const allPartIds = this.#bodyGraphService.getAllParts(bodyComponent, entityId);

      // Build array of parts with components for filtering
      const partsWithComponents = allPartIds.map((partId) => ({
        id: partId,
        component: this.#entityManager.getComponentData(partId, PART_COMPONENT_ID),
      }));

      // Use shared helper for consistent weight resolution and filtering
      const candidateParts = filterEligibleHitTargets(partsWithComponents);

      if (candidateParts.length === 0) return null;

      const totalWeight = candidateParts.reduce((sum, part) => sum + part.weight, 0);
      if (totalWeight <= 0) return candidateParts[0].id;

      let randomValue = Math.random() * totalWeight;
      for (const part of candidateParts) {
        randomValue -= part.weight;
        if (randomValue <= 0) return part.id;
      }
      return candidateParts[candidateParts.length - 1].id;
    } catch (error) {
      logger.error(`APPLY_DAMAGE: Error resolving hit location for ${entityId}`, error);
      return null;
    }
  }

  /**
   * Propagates damage to child parts using the DamagePropagationService.
   *
   * @param {object} params - Propagation parameters
   * @param {string} params.entityId - Owner entity ID
   * @param {string} params.parentPartId - Parent part that received damage
   * @param {number} params.damageAmount - Amount of damage to propagate
   * @param {string} params.damageType - Type of damage
   * @param {object} params.propagationRules - Rules for propagation
   * @param {object} params.executionContext - Execution context
   * @private
   */
  async #propagateDamage({
    entityId,
    parentPartId,
    damageAmount,
    damageType,
    propagationRules,
    executionContext,
  }) {
    // Use the DamagePropagationService to calculate which child parts receive damage
    const propagationResults = this.#damagePropagationService.propagateDamage(
      parentPartId,
      damageAmount,
      damageType,
      entityId,
      propagationRules
    );

    // Apply damage to each child part
    for (const result of propagationResults) {
      await this.execute(
        {
          entity_ref: entityId,
          part_ref: result.childPartId,
          // Construct minimal damage_entry for propagated damage
          damage_entry: {
            name: result.damageTypeId,
            amount: result.damageApplied,
          },
          propagatedFrom: parentPartId,
        },
        executionContext
      );
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
      propagatedFrom = null,
    } = params;

    // 1. Resolve Entity (supports placeholder names like "secondary", "primary", etc.)
    const entityId = this.#resolveEntityRef(entity_ref, executionContext, log);

    // Session lifecycle: Create session at top-level, reuse for recursive calls
    const isTopLevel = !propagatedFrom;
    let session;
    if (isTopLevel) {
      session = this.#damageAccumulator.createSession(entityId);
      if (!session) {
        const errorMsg = 'APPLY_DAMAGE: Failed to create damage session';
        safeDispatchError(this.#dispatcher, errorMsg, { entityId }, log);
        return;
      }
      executionContext.damageSession = session;
    } else {
      session = executionContext.damageSession;
      if (!session) {
        log.warn(
          `APPLY_DAMAGE: Propagated damage call missing session in executionContext for entity ${entityId}`
        );
      }
    }
    if (!entityId) {
      safeDispatchError(this.#dispatcher, 'APPLY_DAMAGE: Invalid entity_ref', { entity_ref }, log);
      return;
    }

    // 2. Resolve Part
    let partId = null;
    if (part_ref) {
      partId = this.#resolveRef(part_ref, executionContext, log);
    }

    if (!partId) {
      // Auto-resolve if missing or failed to resolve
      partId = this.#selectRandomPart(entityId, log);
      if (!partId) {
         safeDispatchError(this.#dispatcher, 'APPLY_DAMAGE: Could not resolve target part', { entityId }, log);
         return;
      }
    }

    // 3. Resolve damage entry or construct from legacy parameters
    let resolvedDamageEntry;
    if (damage_entry) {
      // New mode: use damage_entry object directly or resolve from JSON Logic
      if (typeof damage_entry === 'object' && damage_entry !== null && !damage_entry.var && !damage_entry.if) {
        // Direct object with damage entry structure
        resolvedDamageEntry = damage_entry;
      } else {
        // JSON Logic expression - evaluate it
        try {
          resolvedDamageEntry = this.#jsonLogicService.evaluate(damage_entry, executionContext);
        } catch (err) {
          safeDispatchError(this.#dispatcher, 'APPLY_DAMAGE: Failed to evaluate damage_entry', { error: err.message }, log);
          return;
        }
      }
      if (!resolvedDamageEntry || typeof resolvedDamageEntry.amount !== 'number') {
        safeDispatchError(this.#dispatcher, 'APPLY_DAMAGE: Invalid damage_entry (missing amount)', { damage_entry: resolvedDamageEntry }, log);
        return;
      }
      if (!resolvedDamageEntry.name) {
        safeDispatchError(this.#dispatcher, 'APPLY_DAMAGE: Invalid damage_entry (missing name)', { damage_entry: resolvedDamageEntry }, log);
        return;
      }
    } else if (damage_type !== undefined && amount !== undefined) {
      // Legacy mode: construct damage entry from individual parameters
      log.warn('DEPRECATED: Using damage_type + amount parameters. Migrate to damage_entry object.');
      const resolvedAmount = this.#resolveValue(amount, executionContext, log, 'number');
      const resolvedType = this.#resolveValue(damage_type, executionContext, log, 'string');

      if (isNaN(resolvedAmount) || resolvedAmount < 0) {
        safeDispatchError(this.#dispatcher, 'APPLY_DAMAGE: Invalid amount', { amount: resolvedAmount }, log);
        return;
      }
      if (!resolvedType) {
        safeDispatchError(this.#dispatcher, 'APPLY_DAMAGE: Invalid damage_type', { damage_type }, log);
        return;
      }

      resolvedDamageEntry = { name: resolvedType, amount: resolvedAmount };
    } else {
      safeDispatchError(this.#dispatcher, 'APPLY_DAMAGE: Either damage_entry or (damage_type + amount) required', { params }, log);
      return;
    }

    // 3b. Check exclusion list
    if (exclude_damage_types) {
      let resolvedExcludeTypes = exclude_damage_types;

      // Resolve JSON Logic if needed
      if (typeof exclude_damage_types === 'object' && !Array.isArray(exclude_damage_types)) {
        try {
          resolvedExcludeTypes = this.#jsonLogicService.evaluate(exclude_damage_types, executionContext);
        } catch (err) {
          log.warn('APPLY_DAMAGE: Failed to evaluate exclude_damage_types', { error: err.message });
          resolvedExcludeTypes = [];
        }
      }

      // Validate and check
      if (Array.isArray(resolvedExcludeTypes) && resolvedExcludeTypes.length > 0) {
        const damageTypeName = resolvedDamageEntry.name;
        if (resolvedExcludeTypes.includes(damageTypeName)) {
          log.debug(`APPLY_DAMAGE: Skipping excluded damage type '${damageTypeName}'`, {
            excluded: resolvedExcludeTypes
          });
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

    // Apply multiplier to amount while preserving other fields
    const finalDamageEntry = {
      ...resolvedDamageEntry,
      amount: resolvedDamageEntry.amount * resolvedMultiplier,
    };

    // Extract values from damage entry for use in this handler
    const damageAmount = finalDamageEntry.amount;
    const damageType = resolvedDamageEntry.name;

    // 4. Record damage to session (replaces immediate dispatch for narrative composition)
    // Resolve entity and part metadata for message rendering
    const entityName = this.#getEntityName(entityId);
    const entityPronoun = this.#getEntityPronoun(entityId);
    const entityPossessive = this.#getEntityPossessive(entityId);
    const { partType, orientation } = this.#getPartInfo(partId);

    // Create damage entry for accumulation
    const damageEntryForSession = {
      entityId,
      entityName,
      entityPronoun,
      entityPossessive,
      partId,
      partType,
      orientation,
      amount: damageAmount,
      damageType,
      propagatedFrom,
      effectsTriggered: [],
    };

    // Record damage to session for composed narrative
    if (session) {
      this.#damageAccumulator.recordDamage(session, damageEntryForSession);
    }

    // Queue event for backwards compatibility (dispatched after composed event)
    const damageAppliedPayload = {
      entityId,
      entityName,
      entityPronoun,
      partId,
      partType,
      orientation,
      amount: damageAmount,
      damageType,
      propagatedFrom,
      timestamp: Date.now()
    };

    if (session) {
      this.#damageAccumulator.queueEvent(session, DAMAGE_APPLIED_EVENT, damageAppliedPayload);
    } else {
      // Fallback: dispatch immediately if no session (shouldn't happen normally)
      this.#dispatcher.dispatch(DAMAGE_APPLIED_EVENT, damageAppliedPayload);
    }

    const partComponent = this.#entityManager.hasComponent(partId, PART_COMPONENT_ID)
      ? this.#entityManager.getComponentData(partId, PART_COMPONENT_ID)
      : null;

    // Read propagation rules - try standalone component first, fallback to part component property
    // The rules array contains objects with childSocketId, baseProbability, damageFraction, damageTypeModifiers
    const propagationComponent = this.#entityManager.hasComponent(partId, DAMAGE_PROPAGATION_COMPONENT_ID)
      ? this.#entityManager.getComponentData(partId, DAMAGE_PROPAGATION_COMPONENT_ID)
      : null;
    const propagationRules = propagationComponent?.rules ?? partComponent?.damage_propagation;

    // 5. Update Health
    if (!this.#entityManager.hasComponent(partId, PART_HEALTH_COMPONENT_ID)) {
      // It's possible we hit a part without health (e.g. hair?), though likely all parts have health.
      // If no health component, still propagate damage if rules exist.
      log.debug(`APPLY_DAMAGE: Part ${partId} has no health component. Skipping health update.`);
      await this.#propagateDamage({
        entityId,
        parentPartId: partId,
        damageAmount,
        damageType,
        propagationRules,
        executionContext,
      });
      return;
    }

    try {
      const healthComponent = this.#entityManager.getComponentData(partId, PART_HEALTH_COMPONENT_ID);
      const { currentHealth, maxHealth, state: previousState } = healthComponent;
      const previousHealth = currentHealth;
      const previousTurnsInState = healthComponent.turnsInState || 0;

      // Calc new health
      const newHealth = Math.max(0, currentHealth - damageAmount);

      // Calc new state
      const healthPercentage = (newHealth / maxHealth) * 100;
      const newState = calculateStateFromPercentage(healthPercentage);
      const turnsInState = newState === previousState ? previousTurnsInState + 1 : 0;

      // Update component
      await this.#entityManager.addComponent(partId, PART_HEALTH_COMPONENT_ID, {
        currentHealth: newHealth,
        maxHealth,
        state: newState,
        turnsInState
      });

      // Dispatch health changed
      // Getting extra info for the event
      let partType = 'unknown';
      let ownerEntityId = null;
      if (partComponent) {
         partType = partComponent.subType || 'unknown';
         ownerEntityId = partComponent.ownerEntityId;
      }

      this.#dispatcher.dispatch(PART_HEALTH_CHANGED_EVENT, {
        partEntityId: partId,
        ownerEntityId,
        partType,
        previousHealth,
        newHealth,
        maxHealth,
        healthPercentage,
        previousState,
        newState,
        delta: -damageAmount,
        timestamp: Date.now()
      });

      // Dispatch destroyed if needed
      if (newHealth <= 0 && previousHealth > 0) { // Ensure we only fire on the transition to 0
         this.#dispatcher.dispatch(PART_DESTROYED_EVENT, {
           entityId: ownerEntityId || entityId, // Prefer owner (whole body) but fallback to entityId (if targeting part directly as entity?)
           partId,
           timestamp: Date.now()
         });
         log.info(`APPLY_DAMAGE: Part ${partId} destroyed.`);
      }

      log.debug(`APPLY_DAMAGE: Applied ${damageAmount} ${damageType} to ${partId}. Health: ${currentHealth} -> ${newHealth}. State: ${newState}.`);

      // Apply damage type effects (bleed, burn, fracture, dismemberment, poison)
      // Pass session to allow effects to be recorded for composed narrative
      await this.#damageTypeEffectsService.applyEffectsForDamage({
        entityId: ownerEntityId || entityId,
        entityName,
        entityPronoun,
        partId,
        partType,
        orientation,
        damageEntry: finalDamageEntry,
        maxHealth,
        currentHealth: newHealth,
        damageSession: session,
      });

    } catch (error) {
      log.error('APPLY_DAMAGE operation failed', error, { partId });
      safeDispatchError(this.#dispatcher, `APPLY_DAMAGE: Operation failed - ${error.message}`, { partId, error: error.message }, log);
      return;
    }

    await this.#propagateDamage({
      entityId,
      parentPartId: partId,
      damageAmount,
      damageType,
      propagationRules,
      executionContext,
    });

    // Check death conditions ONLY after top-level damage (not propagated damage)
    // This ensures death is checked once after all propagation completes
    if (isTopLevel) {
      const deathCheckOwnerEntityId = partComponent?.ownerEntityId || entityId;
      const deathResult = this.#deathCheckService.checkDeathConditions(
        deathCheckOwnerEntityId,
        this.#extractActorId(executionContext)
      );

      if (deathResult.isDead) {
        log.info(`APPLY_DAMAGE: Entity ${deathCheckOwnerEntityId} died from damage.`);
      } else if (deathResult.isDying) {
        log.info(`APPLY_DAMAGE: Entity ${deathCheckOwnerEntityId} is now dying.`);
      }

      // Finalize session and dispatch composed narrative + pending events
      if (session) {
        const { entries, pendingEvents } = this.#damageAccumulator.finalize(session);

        // Compose narrative from accumulated entries
        if (entries.length > 0) {
          const composedNarrative = this.#damageNarrativeComposer.compose(entries);

          // Calculate total damage from all entries
          const totalDamage = entries.reduce((sum, e) => sum + (e.amount || 0), 0);

          // Dispatch composed perceptible event for NPC perception
          if (composedNarrative) {
            const actorId = this.#extractActorId(executionContext);
            const locationId = this.#resolveLocationForEvent(
              deathCheckOwnerEntityId,
              actorId,
              log
            );

            if (locationId) {
              this.#dispatcher.dispatch('core:perceptible_event', {
                eventName: 'core:perceptible_event',
                locationId,
                descriptionText: composedNarrative,
                timestamp: new Date().toISOString(),
                perceptionType: 'damage_received',
                actorId: actorId || entityId,
                targetId: deathCheckOwnerEntityId,
                involvedEntities: [deathCheckOwnerEntityId],
                contextualData: { totalDamage },
              });

              log.debug(`APPLY_DAMAGE: Dispatched composed narrative: "${composedNarrative}"`);
            } else {
              // FAIL-FAST: Log error and dispatch error event instead of silent skip
              const errorMsg = `APPLY_DAMAGE: Cannot dispatch perceptible event - no location found for target ${deathCheckOwnerEntityId} or actor ${actorId}`;
              log.error(errorMsg);
              safeDispatchError(
                this.#dispatcher,
                errorMsg,
                {
                  targetEntityId: deathCheckOwnerEntityId,
                  actorId,
                  composedNarrative,
                  totalDamage,
                },
                log
              );
            }
          } else {
            log.warn(
              `APPLY_DAMAGE: Composer returned empty narrative for ${entries.length} entries`
            );
          }
        }

        // Dispatch queued individual events for backwards compatibility
        for (const { eventType, payload } of pendingEvents) {
          this.#dispatcher.dispatch(eventType, payload);
        }

        // Clean up session from execution context
        delete executionContext.damageSession;
      }
    }
  }
}

export default ApplyDamageHandler;
