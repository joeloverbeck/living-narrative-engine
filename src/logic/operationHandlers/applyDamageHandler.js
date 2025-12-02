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

const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';
const BODY_COMPONENT_ID = 'anatomy:body';

const DAMAGE_APPLIED_EVENT = 'anatomy:damage_applied';
const PART_HEALTH_CHANGED_EVENT = 'anatomy:part_health_changed';
const PART_DESTROYED_EVENT = 'anatomy:part_destroyed';

const HEALTH_STATE_THRESHOLDS = {
  healthy: 76,
  bruised: 51,
  wounded: 26,
  badly_damaged: 1,
  destroyed: 0,
};

class ApplyDamageHandler extends BaseOperationHandler {
  /** @type {import('../../entities/entityManager.js').default} */ #entityManager;
  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */ #dispatcher;
  /** @type {import('../jsonLogicEvaluationService.js').default} */ #jsonLogicService;
  /** @type {import('../../anatomy/bodyGraphService.js').default} */ #bodyGraphService;
  /** @type {import('../../anatomy/services/damageTypeEffectsService.js').default} */ #damageTypeEffectsService;
  /** @type {import('../../anatomy/services/damagePropagationService.js').default} */ #damagePropagationService;

  constructor({ logger, entityManager, safeEventDispatcher, jsonLogicService, bodyGraphService, damageTypeEffectsService, damagePropagationService }) {
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
    });
    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
    this.#jsonLogicService = jsonLogicService;
    this.#bodyGraphService = bodyGraphService;
    this.#damageTypeEffectsService = damageTypeEffectsService;
    this.#damagePropagationService = damagePropagationService;
  }

  #calculateHealthState(healthPercentage) {
    if (healthPercentage >= HEALTH_STATE_THRESHOLDS.healthy) return 'healthy';
    if (healthPercentage >= HEALTH_STATE_THRESHOLDS.bruised) return 'bruised';
    if (healthPercentage >= HEALTH_STATE_THRESHOLDS.wounded) return 'wounded';
    if (healthPercentage >= HEALTH_STATE_THRESHOLDS.badly_damaged)
      return 'badly_damaged';
    return 'destroyed';
  }

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
      const candidateParts = [];

      for (const partId of allPartIds) {
        const partComponent = this.#entityManager.getComponentData(partId, PART_COMPONENT_ID);
        if (partComponent && 
            typeof partComponent.hit_probability_weight === 'number' && 
            partComponent.hit_probability_weight > 0) {
          candidateParts.push({
            id: partId,
            weight: partComponent.hit_probability_weight
          });
        }
      }

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
          amount: result.damageApplied,
          damage_type: result.damageTypeId,
          propagatedFrom: parentPartId,
        },
        executionContext
      );
    }
  }

  async execute(params, executionContext) {
    const log = this.getLogger(executionContext);

    if (!assertParamsObject(params, this.#dispatcher, 'APPLY_DAMAGE')) return;

    const { entity_ref, part_ref, amount, damage_type, propagatedFrom = null } = params;

    // 1. Resolve Entity
    const entityId = this.#resolveRef(entity_ref, executionContext, log);
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

    // 3. Resolve Amount & Type
    const damageAmount = this.#resolveValue(amount, executionContext, log, 'number');
    const damageType = this.#resolveValue(damage_type, executionContext, log, 'string');

    if (isNaN(damageAmount) || damageAmount < 0) {
       safeDispatchError(this.#dispatcher, 'APPLY_DAMAGE: Invalid amount', { amount: damageAmount }, log);
       return;
    }
    if (!damageType) {
       safeDispatchError(this.#dispatcher, 'APPLY_DAMAGE: Invalid damage_type', { damage_type }, log);
       return;
    }

    // 4. Dispatch damage applied event
    this.#dispatcher.dispatch(DAMAGE_APPLIED_EVENT, {
      entityId,
      partId,
      amount: damageAmount,
      damageType,
      propagatedFrom,
      timestamp: Date.now()
    });

    const partComponent = this.#entityManager.hasComponent(partId, PART_COMPONENT_ID)
      ? this.#entityManager.getComponentData(partId, PART_COMPONENT_ID)
      : null;
    const propagationRules = partComponent?.damage_propagation;

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
      const newState = this.#calculateHealthState(healthPercentage);
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
      await this.#damageTypeEffectsService.applyEffectsForDamage({
        entityId: ownerEntityId || entityId,
        partId,
        amount: damageAmount,
        damageType,
        maxHealth,
        currentHealth: newHealth,
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
  }
}

export default ApplyDamageHandler;
