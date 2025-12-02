/**
 * @file DamagePropagationService - Handles internal damage propagation from parent parts to children.
 * @see specs/injury-reporting-and-user-interface.md section 5.4
 */

import { BaseService } from '../../utils/serviceBase.js';

// --- Component ID Constants ---
const JOINT_COMPONENT_ID = 'anatomy:joint';

/**
 * @typedef {object} PropagationResult
 * @property {string} childPartId - Entity ID of the child part that received propagated damage
 * @property {number} damageApplied - Amount of damage propagated to the child part
 * @property {string} damageTypeId - The damage type that was propagated
 */

/**
 * Service that handles internal damage propagation from parent body parts to their children.
 *
 * When a parent part (e.g., torso) receives damage, this service calculates which child parts
 * (e.g., internal organs) should receive propagated damage based on propagation rules.
 *
 * @augments BaseService
 */
class DamagePropagationService extends BaseService {
  /** @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;

  /** @type {import('../../entities/entityManager.js').default} */
  #entityManager;

  /** @type {import('../../events/safeEventDispatcher.js').default} */
  #eventBus;

  /**
   * Creates a new DamagePropagationService instance.
   *
   * @param {object} dependencies - The service dependencies
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger instance
   * @param {import('../../entities/entityManager.js').default} dependencies.entityManager - Entity manager for component access
   * @param {import('../../events/safeEventDispatcher.js').default} dependencies.eventBus - Event bus for dispatching propagation events
   */
  constructor({ logger, entityManager, eventBus }) {
    super();
    this.#logger = this._init('DamagePropagationService', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData', 'hasComponent'],
      },
      eventBus: {
        value: eventBus,
        requiredMethods: ['dispatch'],
      },
    });
    this.#entityManager = entityManager;
    this.#eventBus = eventBus;
  }

  /**
   * Calculates which child parts should receive propagated damage based on propagation rules.
   *
   * This method does NOT apply the damage - it returns results indicating which child parts
   * should receive damage. The caller (typically ApplyDamageHandler) is responsible for
   * actually applying the damage.
   *
   * For each propagation rule:
   * 1. Checks if damage type is allowed by the rule
   * 2. Rolls against probability to determine if propagation occurs
   * 3. Verifies the child is actually a child via joint parent check
   * 4. Calculates propagated amount = damageAmount * damageFraction
   * 5. Dispatches anatomy:internal_damage_propagated event
   *
   * @param {string} parentPartId - Entity ID of the part that received the original damage
   * @param {number} damageAmount - Amount of damage applied to the parent part
   * @param {string} damageTypeId - Type of damage (e.g., 'slashing', 'piercing')
   * @param {string} ownerEntityId - Entity ID of the character that owns the parts
   * @param {object} propagationRules - Propagation rules mapping child IDs to rule objects
   * @returns {PropagationResult[]} Array of results for each part that should receive propagated damage
   */
  propagateDamage(
    parentPartId,
    damageAmount,
    damageTypeId,
    ownerEntityId,
    propagationRules
  ) {
    if (!propagationRules || typeof propagationRules !== 'object') {
      return [];
    }

    const entries = Object.entries(propagationRules);
    if (!entries.length) {
      return [];
    }

    /** @type {PropagationResult[]} */
    const results = [];

    for (const [childPartId, rule] of entries) {
      const propagationResult = this.#evaluatePropagationRule({
        parentPartId,
        childPartId,
        rule,
        damageAmount,
        damageTypeId,
        ownerEntityId,
      });

      if (propagationResult) {
        results.push(propagationResult);
      }
    }

    this.#logger.debug(
      `Damage propagation from ${parentPartId}: ${results.length} child parts will receive damage`
    );

    return results;
  }

  /**
   * Evaluates a single propagation rule to determine if damage should propagate to a child.
   *
   * @param {object} params - Evaluation parameters
   * @param {string} params.parentPartId - Parent part entity ID
   * @param {string} params.childPartId - Child part entity ID
   * @param {object} params.rule - The propagation rule
   * @param {number} params.damageAmount - Amount of damage
   * @param {string} params.damageTypeId - Damage type
   * @param {string} params.ownerEntityId - Owner entity ID
   * @returns {PropagationResult|null} Result if propagation should occur, null otherwise
   * @private
   */
  #evaluatePropagationRule({
    parentPartId,
    childPartId,
    rule,
    damageAmount,
    damageTypeId,
    ownerEntityId,
  }) {
    // Skip invalid rules or self-reference
    if (!rule || typeof rule !== 'object' || childPartId === parentPartId) {
      return null;
    }

    // Check damage type filter
    if (!this.#passesDamageTypeFilter(rule, damageTypeId)) {
      return null;
    }

    // Roll against probability
    if (!this.#passesProbabilityCheck(rule)) {
      return null;
    }

    // Calculate damage fraction
    const propagatedAmount = this.#calculatePropagatedAmount(rule, damageAmount);
    if (propagatedAmount <= 0) {
      return null;
    }

    // Verify child relationship via joint
    if (!this.#isValidChild(childPartId, parentPartId)) {
      this.#logger.debug(
        `DamagePropagation: Skipping ${childPartId} - not a child of ${parentPartId}`
      );
      return null;
    }

    // Dispatch event
    this.#dispatchPropagationEvent({
      ownerEntityId,
      sourcePartId: parentPartId,
      targetPartId: childPartId,
      damageAmount: propagatedAmount,
      damageTypeId,
    });

    return {
      childPartId,
      damageApplied: propagatedAmount,
      damageTypeId,
    };
  }

  /**
   * Checks if the damage type passes the rule's damage type filter.
   *
   * @param {object} rule - The propagation rule
   * @param {string} damageTypeId - The damage type to check
   * @returns {boolean} True if the damage type is allowed or no filter is set
   * @private
   */
  #passesDamageTypeFilter(rule, damageTypeId) {
    const allowedTypes = Array.isArray(rule.damage_types)
      ? rule.damage_types
      : null;

    if (allowedTypes && allowedTypes.length > 0) {
      return allowedTypes.includes(damageTypeId);
    }

    return true;
  }

  /**
   * Rolls against the rule's probability to determine if propagation occurs.
   *
   * @param {object} rule - The propagation rule
   * @returns {boolean} True if the probability check passes
   * @private
   */
  #passesProbabilityCheck(rule) {
    const probabilityRaw =
      typeof rule.probability === 'number' ? rule.probability : 1;
    const probability = Math.min(1, Math.max(0, probabilityRaw));
    return Math.random() <= probability;
  }

  /**
   * Calculates the amount of damage to propagate based on the damage fraction.
   *
   * @param {object} rule - The propagation rule
   * @param {number} damageAmount - The original damage amount
   * @returns {number} The propagated damage amount
   * @private
   */
  #calculatePropagatedAmount(rule, damageAmount) {
    const fraction =
      typeof rule.damage_fraction === 'number' ? rule.damage_fraction : 0.5;
    return damageAmount * fraction;
  }

  /**
   * Verifies that the child part is actually a child of the parent via joint check.
   *
   * @param {string} childPartId - The child part entity ID
   * @param {string} parentPartId - The parent part entity ID
   * @returns {boolean} True if the child's joint references the parent
   * @private
   */
  #isValidChild(childPartId, parentPartId) {
    try {
      const joint = this.#entityManager.getComponentData(
        childPartId,
        JOINT_COMPONENT_ID
      );
      const jointParentId = joint?.parentId || joint?.parentEntityId;
      return jointParentId === parentPartId;
    } catch {
      return false;
    }
  }

  /**
   * Dispatches the anatomy:internal_damage_propagated event.
   *
   * @param {object} params - Event parameters
   * @param {string} params.ownerEntityId - Entity ID of the character
   * @param {string} params.sourcePartId - Part that received original damage
   * @param {string} params.targetPartId - Part receiving propagated damage
   * @param {number} params.damageAmount - Amount of damage propagated
   * @param {string} params.damageTypeId - Type of damage
   * @private
   */
  #dispatchPropagationEvent({
    ownerEntityId,
    sourcePartId,
    targetPartId,
    damageAmount,
    damageTypeId,
  }) {
    this.#eventBus.dispatch('anatomy:internal_damage_propagated', {
      ownerEntityId,
      sourcePartId,
      targetPartId,
      damageAmount,
      damageTypeId,
      timestamp: Date.now(),
    });
  }
}

export default DamagePropagationService;
