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
        requiredMethods: [
          'getComponentData',
          'hasComponent',
          'getEntitiesWithComponent',
        ],
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
   * Supports two formats:
   * - Array format (new): [{ childPartId, baseProbability, damageFraction, damageTypeModifiers }]
   * - Object format (legacy): { childPartId: { probability, damage_fraction, damage_types } }
   *
   * For each propagation rule:
   * 1. Calculates effective probability based on damage type modifiers
   * 2. Rolls against probability to determine if propagation occurs
   * 3. Verifies the child is actually a child via joint parent check
   * 4. Calculates propagated amount = damageAmount * damageFraction
   * 5. Dispatches anatomy:internal_damage_propagated event
   *
   * @param {string} parentPartId - Entity ID of the part that received the original damage
   * @param {number} damageAmount - Amount of damage applied to the parent part
   * @param {string} damageTypeId - Type of damage (e.g., 'slashing', 'piercing')
   * @param {string} ownerEntityId - Entity ID of the character that owns the parts
   * @param {Array|object} propagationRules - Propagation rules (array or object format)
   * @returns {PropagationResult[]} Array of results for each part that should receive propagated damage
   */
  propagateDamage(
    parentPartId,
    damageAmount,
    damageTypeId,
    ownerEntityId,
    propagationRules
  ) {
    if (!propagationRules) {
      return [];
    }

    // Normalize to array of [childIdentifier, rule] pairs
    // childIdentifier can be a socket ID (new format) or entity ID (legacy format)
    const rulePairs = this.#normalizeRules(propagationRules);
    if (!rulePairs.length) {
      return [];
    }

    /** @type {PropagationResult[]} */
    const results = [];

    for (const [childIdentifier, rule] of rulePairs) {
      const propagationResult = this.#evaluatePropagationRule({
        parentPartId,
        childIdentifier,
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
   * Normalizes propagation rules to array of [childIdentifier, rule] pairs.
   * Supports both array format (new) and object format (legacy).
   *
   * Array format (new): Uses childSocketId or childPartId
   * Object format (legacy): Keys are childPartIds
   *
   * @param {Array|object} propagationRules - Rules in either format
   * @returns {Array<[string, object]>} Normalized array of [childIdentifier, rule] pairs
   * @private
   */
  #normalizeRules(propagationRules) {
    // Array format (new): each rule has childSocketId or childPartId
    if (Array.isArray(propagationRules)) {
      return propagationRules
        .filter(
          (rule) =>
            rule &&
            typeof rule === 'object' &&
            (rule.childSocketId || rule.childPartId)
        )
        .map((rule) => [rule.childSocketId || rule.childPartId, rule]);
    }

    // Object format (legacy): keys are childPartIds
    if (typeof propagationRules === 'object') {
      return Object.entries(propagationRules);
    }

    return [];
  }

  /**
   * Evaluates a single propagation rule to determine if damage should propagate to a child.
   *
   * The childIdentifier can be either:
   * - A socket ID (e.g., "heart_socket") from childSocketId in new array format - needs resolution
   * - An entity ID from childPartId field or legacy object keys - used directly
   *
   * @param {object} params - Evaluation parameters
   * @param {string} params.parentPartId - Parent part entity ID
   * @param {string} params.childIdentifier - Socket ID or entity ID for the child part
   * @param {object} params.rule - The propagation rule
   * @param {number} params.damageAmount - Amount of damage
   * @param {string} params.damageTypeId - Damage type
   * @param {string} params.ownerEntityId - Owner entity ID
   * @returns {PropagationResult|null} Result if propagation should occur, null otherwise
   * @private
   */
  #evaluatePropagationRule({
    parentPartId,
    childIdentifier,
    rule,
    damageAmount,
    damageTypeId,
    ownerEntityId,
  }) {
    // Skip invalid rules or self-reference
    if (
      !rule ||
      typeof rule !== 'object' ||
      childIdentifier === parentPartId
    ) {
      return null;
    }

    // Resolve childIdentifier to an actual entity ID
    // If the rule has childSocketId, the identifier is a socket ID that needs resolution
    // Otherwise, treat it as an entity ID directly
    let childPartId;
    if (rule.childSocketId) {
      // New format: identifier is a socket ID, resolve to entity
      childPartId = this.#resolveSocketToEntityId(parentPartId, childIdentifier);
      if (!childPartId) {
        this.#logger.debug(
          `DamagePropagation: No entity attached to socket '${childIdentifier}' on parent '${parentPartId}'`
        );
        return null;
      }
    } else {
      // Legacy format: identifier is already an entity ID
      childPartId = childIdentifier;
    }

    // Skip self-reference after resolution
    if (childPartId === parentPartId) {
      return null;
    }

    // Check damage type filter
    if (!this.#passesDamageTypeFilter(rule, damageTypeId)) {
      return null;
    }

    // Roll against probability (including damage type modifiers)
    if (!this.#passesProbabilityCheck(rule, damageTypeId)) {
      return null;
    }

    // Calculate damage fraction
    const propagatedAmount = this.#calculatePropagatedAmount(rule, damageAmount);
    if (propagatedAmount <= 0) {
      return null;
    }

    // Verify child relationship via joint (redundant for socket resolution but validates legacy format)
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
   * Supports two semantics:
   * - damage_types (array): Explicit whitelist - only listed types can propagate
   * - damageTypeModifiers (object): Probability modifiers - all types allowed, modifier affects probability
   *
   * If damage_types is set and non-empty, it acts as a strict whitelist.
   * If only damageTypeModifiers exists, all damage types are allowed (modifier applied in probability check).
   *
   * @param {object} rule - The propagation rule
   * @param {string} damageTypeId - The damage type to check
   * @returns {boolean} True if the damage type is allowed or no filter is set
   * @private
   */
  #passesDamageTypeFilter(rule, damageTypeId) {
    // Check for explicit whitelist (damage_types array)
    const allowedTypes = Array.isArray(rule.damage_types)
      ? rule.damage_types
      : null;

    if (allowedTypes && allowedTypes.length > 0) {
      return allowedTypes.includes(damageTypeId);
    }

    // If damageTypeModifiers exists but no damage_types, all types are allowed
    // The modifier will be applied in the probability check
    return true;
  }

  /**
   * Rolls against the rule's probability to determine if propagation occurs.
   *
   * Supports both field naming conventions:
   * - baseProbability (new format from standalone component)
   * - probability (legacy format from embedded property)
   *
   * If damageTypeModifiers exists, applies the modifier for the damage type:
   * effectiveProbability = baseProbability * damageTypeModifiers[damageType]
   * Unlisted damage types use modifier 1.0 (no change).
   *
   * @param {object} rule - The propagation rule
   * @param {string} damageTypeId - The damage type for modifier lookup
   * @returns {boolean} True if the probability check passes
   * @private
   */
  #passesProbabilityCheck(rule, damageTypeId) {
    // Support both field names: baseProbability (new) or probability (legacy)
    let baseProbability;
    if (typeof rule.baseProbability === 'number') {
      baseProbability = rule.baseProbability;
    } else if (typeof rule.probability === 'number') {
      baseProbability = rule.probability;
    } else {
      baseProbability = 1; // Default: always propagate if no probability set
    }

    // Apply damage type modifier if available
    let typeModifier = 1.0;
    if (
      rule.damageTypeModifiers &&
      typeof rule.damageTypeModifiers === 'object' &&
      typeof rule.damageTypeModifiers[damageTypeId] === 'number'
    ) {
      typeModifier = rule.damageTypeModifiers[damageTypeId];
    }

    // Calculate effective probability
    const effectiveProbability = Math.min(
      1,
      Math.max(0, baseProbability * typeModifier)
    );

    return Math.random() <= effectiveProbability;
  }

  /**
   * Calculates the amount of damage to propagate based on the damage fraction.
   *
   * Supports both field naming conventions:
   * - damageFraction (new format from standalone component)
   * - damage_fraction (legacy format from embedded property)
   *
   * @param {object} rule - The propagation rule
   * @param {number} damageAmount - The original damage amount
   * @returns {number} The propagated damage amount
   * @private
   */
  #calculatePropagatedAmount(rule, damageAmount) {
    // Support both field names: damageFraction (new) or damage_fraction (legacy)
    let fraction;
    if (typeof rule.damageFraction === 'number') {
      fraction = rule.damageFraction;
    } else if (typeof rule.damage_fraction === 'number') {
      fraction = rule.damage_fraction;
    } else {
      fraction = 0.5; // Default: 50% of parent damage
    }

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
   * Resolves a socket ID to the entity ID of the part attached to that socket.
   *
   * Given a parent part and a socket ID, finds the child entity that is attached
   * to that socket by scanning entities with joint components.
   *
   * @param {string} parentPartId - The parent part entity ID
   * @param {string} socketId - The socket ID on the parent to find the child for
   * @returns {string|null} The entity ID of the child attached to the socket, or null if not found
   * @private
   */
  #resolveSocketToEntityId(parentPartId, socketId) {
    try {
      // Get all entities with joint components
      const entitiesWithJoints =
        this.#entityManager.getEntitiesWithComponent(JOINT_COMPONENT_ID);

      if (!entitiesWithJoints || !Array.isArray(entitiesWithJoints)) {
        return null;
      }

      // Find the entity whose joint points to this parent and socket
      for (const entity of entitiesWithJoints) {
        try {
          // Handle both Entity objects and string IDs for backwards compatibility
          const entityId = typeof entity === 'string' ? entity : entity.id;
          if (!entityId) {
            continue;
          }

          const joint = this.#entityManager.getComponentData(
            entityId,
            JOINT_COMPONENT_ID
          );

          const jointParentId = joint?.parentId || joint?.parentEntityId;
          const jointSocketId = joint?.socketId || joint?.childSocketId;

          if (jointParentId === parentPartId && jointSocketId === socketId) {
            this.#logger.debug(
              `DamagePropagation: Resolved socket '${socketId}' on parent '${parentPartId}' to entity '${entityId}'`
            );
            return entityId;
          }
        } catch {
          // Skip entities with inaccessible joint data
          continue;
        }
      }

      this.#logger.debug(
        `DamagePropagation: No entity found attached to socket '${socketId}' on parent '${parentPartId}'`
      );
      return null;
    } catch (err) {
      this.#logger.warn(
        `DamagePropagation: Error resolving socket '${socketId}' on parent '${parentPartId}': ${err.message}`
      );
      return null;
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
