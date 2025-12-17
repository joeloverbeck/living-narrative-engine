/**
 * @file SensoryCapabilityService
 * @description Queries an entity's sensory capabilities from anatomy components.
 * Determines which senses (sight, hearing, smell, touch) are available based on
 * functioning sensory organs. Supports manual override via perception:sensory_capability
 * component.
 *
 * @see specs/sense-aware-perceptible-events.spec.md
 */

import { validateDependency, ensureValidLogger } from '../../utils/index.js';

/**
 * @typedef {Object} SensoryCapabilities
 * @property {boolean} canSee - Has at least one functioning eye
 * @property {boolean} canHear - Has at least one functioning ear
 * @property {boolean} canSmell - Has at least one functioning nose
 * @property {boolean} canFeel - Has tactile sense (always true per spec)
 * @property {string[]} availableSenses - Array of available sense category names
 */

/**
 * Service for querying entity sensory capabilities from anatomy.
 *
 * Logic:
 * 1. Check for manual override component (perception:sensory_capability)
 * 2. Query anatomy parts via BodyGraphService.findPartsByType()
 * 3. Check if at least one part of each sensory type is functioning
 *
 * A part is considered non-functioning if:
 * - Its anatomy:part_health.state === 'destroyed'
 * - It has the anatomy:dismembered component
 * - It was detached (won't appear in findPartsByType results)
 *
 * Backward compatibility: Entities without anatomy return all senses available.
 */
class SensoryCapabilityService {
  #entityManager;
  #bodyGraphService;
  #logger;

  /**
   * Create a SensoryCapabilityService instance.
   *
   * @param {Object} deps - Dependencies
   * @param {Object} deps.entityManager - Entity manager for component access
   * @param {Object} deps.bodyGraphService - Service for anatomy queries
   * @param {Object} deps.logger - Logger service
   */
  constructor({ entityManager, bodyGraphService, logger }) {
    this.#logger = ensureValidLogger(logger, 'SensoryCapabilityService');

    validateDependency(entityManager, 'IEntityManager', this.#logger, {
      requiredMethods: ['getComponentData', 'hasComponent'],
    });

    validateDependency(bodyGraphService, 'IBodyGraphService', this.#logger, {
      requiredMethods: ['findPartsByType'],
    });

    this.#entityManager = entityManager;
    this.#bodyGraphService = bodyGraphService;

    this.#logger.debug('SensoryCapabilityService initialized');
  }

  /**
   * Get sensory capabilities for an entity.
   *
   * @param {string} entityId - Entity ID to check
   * @returns {SensoryCapabilities} Object describing available senses
   */
  getSensoryCapabilities(entityId) {
    if (!entityId || typeof entityId !== 'string') {
      this.#logger.warn(
        `getSensoryCapabilities: Invalid entityId provided: ${entityId}`
      );
      return this.#buildAllAvailable();
    }

    // Check for manual override component
    const override = this.#entityManager.getComponentData(
      entityId,
      'perception:sensory_capability'
    );

    if (override && override.overrideMode === 'manual') {
      this.#logger.debug(
        `getSensoryCapabilities: Using manual override for ${entityId}`
      );
      return this.#buildFromOverride(override);
    }

    // Get body component for anatomy queries
    const bodyComponent = this.#entityManager.getComponentData(
      entityId,
      'anatomy:body'
    );

    if (!bodyComponent) {
      // No anatomy = assume all senses available (backward compatibility)
      this.#logger.debug(
        `getSensoryCapabilities: No anatomy:body for ${entityId}, assuming all senses`
      );
      return this.#buildAllAvailable();
    }

    // Check each sensory organ type
    const canSee = this.#hasAtLeastOneFunctioningPart(bodyComponent, 'eye');
    const canHear = this.#hasAtLeastOneFunctioningPart(bodyComponent, 'ear');
    const canSmell = this.#hasAtLeastOneFunctioningPart(bodyComponent, 'nose');

    const result = {
      canSee,
      canHear,
      canSmell,
      canFeel: true, // Always true per spec
      availableSenses: this.#buildAvailableSenses(canSee, canHear, canSmell),
    };

    this.#logger.debug(
      `getSensoryCapabilities: ${entityId} -> canSee=${canSee}, canHear=${canHear}, canSmell=${canSmell}`
    );

    return result;
  }

  /**
   * Check if entity has at least one functioning part of the given type.
   *
   * @param {Object} bodyComponent - The anatomy:body component data
   * @param {string} partType - Part type to check ('eye', 'ear', 'nose')
   * @returns {boolean} True if at least one functioning part exists
   * @private
   */
  #hasAtLeastOneFunctioningPart(bodyComponent, partType) {
    // Extract root ID from body component
    const rootId = bodyComponent.body?.root || bodyComponent.root;

    if (!rootId) {
      // Malformed body component - assume all senses for backward compat
      this.#logger.debug(
        `#hasAtLeastOneFunctioningPart: No root in body component, assuming true for ${partType}`
      );
      return true;
    }

    const parts = this.#bodyGraphService.findPartsByType(rootId, partType);

    // No parts of this type = can't use that sense
    if (!parts || parts.length === 0) {
      this.#logger.debug(
        `#hasAtLeastOneFunctioningPart: No ${partType} parts found for root ${rootId}`
      );
      return false;
    }

    // Check if at least one part is functioning
    const hasFunctioning = parts.some((partId) =>
      this.#isPartFunctioning(partId)
    );

    this.#logger.debug(
      `#hasAtLeastOneFunctioningPart: ${partType} has ${parts.length} parts, functioning=${hasFunctioning}`
    );

    return hasFunctioning;
  }

  /**
   * Check if a specific part is functioning (not destroyed or dismembered).
   *
   * @param {string} partId - Entity ID of the part
   * @returns {boolean} True if part is functioning
   * @private
   */
  #isPartFunctioning(partId) {
    // Check 1: Is part destroyed?
    const health = this.#entityManager.getComponentData(
      partId,
      'anatomy:part_health'
    );

    if (health && health.state === 'destroyed') {
      this.#logger.debug(`#isPartFunctioning: Part ${partId} is destroyed`);
      return false;
    }

    // Check 2: Is part dismembered?
    const isDismembered = this.#entityManager.hasComponent(
      partId,
      'anatomy:dismembered'
    );

    if (isDismembered) {
      this.#logger.debug(`#isPartFunctioning: Part ${partId} is dismembered`);
      return false;
    }

    return true;
  }

  /**
   * Build capabilities object from manual override component.
   *
   * @param {Object} override - The perception:sensory_capability component data
   * @returns {SensoryCapabilities} Capabilities from override values
   * @private
   */
  #buildFromOverride(override) {
    const canSee = override.canSee !== false; // Default true
    const canHear = override.canHear !== false; // Default true
    const canSmell = override.canSmell !== false; // Default true
    const canFeel = override.canFeel !== false; // Default true (but always true per spec)

    return {
      canSee,
      canHear,
      canSmell,
      canFeel: true, // Always true per spec, even if override says false
      availableSenses: this.#buildAvailableSenses(canSee, canHear, canSmell),
    };
  }

  /**
   * Build capabilities object with all senses available.
   *
   * @returns {SensoryCapabilities} All senses available
   * @private
   */
  #buildAllAvailable() {
    return {
      canSee: true,
      canHear: true,
      canSmell: true,
      canFeel: true,
      availableSenses: this.#buildAvailableSenses(true, true, true),
    };
  }

  /**
   * Build the availableSenses array from capability flags.
   *
   * @param {boolean} canSee - Can entity see
   * @param {boolean} canHear - Can entity hear
   * @param {boolean} canSmell - Can entity smell
   * @returns {string[]} Array of available sense category names
   * @private
   */
  #buildAvailableSenses(canSee, canHear, canSmell) {
    const senses = [];

    if (canSee) senses.push('visual');
    if (canHear) senses.push('auditory');
    if (canSmell) senses.push('olfactory');

    // Always include these per spec
    senses.push('tactile');
    senses.push('proprioceptive');

    return senses;
  }
}

export default SensoryCapabilityService;
