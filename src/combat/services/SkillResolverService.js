/**
 * @file SkillResolverService - Retrieves skill values from entity components
 * @see specs/non-deterministic-actions-system.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Service for retrieving skill values from entity components with default fallback.
 * Core building block for the non-deterministic action system.
 *
 * @example
 * const resolver = new SkillResolverService({ entityManager, logger });
 * const result = resolver.getSkillValue('actor-123', 'skills:melee_skill', 10);
 * // Returns { baseValue: 45, hasComponent: true } if component exists
 * // Returns { baseValue: 10, hasComponent: false } if component missing
 */
class SkillResolverService {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;

  /**
   * Creates an instance of SkillResolverService
   *
   * @param {object} params - Constructor dependencies
   * @param {IEntityManager} params.entityManager - IEntityManager implementation
   * @param {ILogger} params.logger - ILogger implementation
   */
  constructor({ entityManager, logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error', 'info'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponentData', 'hasComponent'],
    });

    this.#entityManager = entityManager;
    this.#logger = logger;

    this.#logger.debug('SkillResolverService: Initialized');
  }

  /**
   * Retrieves a skill value from an entity's component
   *
   * @param {string} entityId - Entity to query
   * @param {string} skillComponentId - Component ID (e.g., 'skills:melee_skill')
   * @param {number} [defaultValue] - Fallback if component/property missing (defaults to 0)
   * @returns {{ baseValue: number, hasComponent: boolean }} Object containing the skill's base value and whether the component exists
   */
  getSkillValue(entityId, skillComponentId, defaultValue = 0) {
    // Validate inputs
    if (!entityId || typeof entityId !== 'string') {
      this.#logger.warn(
        `SkillResolverService.getSkillValue: Invalid entityId provided: ${entityId}`
      );
      return { baseValue: defaultValue, hasComponent: false };
    }

    if (!skillComponentId || typeof skillComponentId !== 'string') {
      this.#logger.warn(
        `SkillResolverService.getSkillValue: Invalid skillComponentId provided: ${skillComponentId}`
      );
      return { baseValue: defaultValue, hasComponent: false };
    }

    // Check if entity has the component
    const hasComponent = this.#entityManager.hasComponent(
      entityId,
      skillComponentId
    );

    if (!hasComponent) {
      this.#logger.debug(
        `SkillResolverService.getSkillValue: Entity '${entityId}' does not have component '${skillComponentId}', using default: ${defaultValue}`
      );
      return { baseValue: defaultValue, hasComponent: false };
    }

    // Get component data
    const componentData = this.#entityManager.getComponentData(
      entityId,
      skillComponentId
    );

    // Handle null/undefined component data
    if (componentData === null || componentData === undefined) {
      this.#logger.warn(
        `SkillResolverService.getSkillValue: Component '${skillComponentId}' on entity '${entityId}' returned null/undefined data`
      );
      return { baseValue: defaultValue, hasComponent: true };
    }

    // Extract value from component data
    // Skill components use 'value' property as per the schema
    const value = componentData.value;

    if (typeof value !== 'number') {
      this.#logger.warn(
        `SkillResolverService.getSkillValue: Component '${skillComponentId}' on entity '${entityId}' has non-numeric value: ${value}`
      );
      return { baseValue: defaultValue, hasComponent: true };
    }

    this.#logger.debug(
      `SkillResolverService.getSkillValue: Retrieved skill value ${value} for entity '${entityId}', component '${skillComponentId}'`
    );

    return { baseValue: value, hasComponent: true };
  }
}

export default SkillResolverService;
