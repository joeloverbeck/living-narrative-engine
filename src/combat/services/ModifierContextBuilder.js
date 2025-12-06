/**
 * @file Builds evaluation context for modifier condition evaluation
 * @see specs/data-driven-modifier-system.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {object} EntityContext
 * @property {string} id - Entity ID
 * @property {Object<string, Object>} components - Component data by ID
 */

/**
 * @typedef {object} ModifierEvaluationContext
 * @property {object} entity
 * @property {EntityContext|null} entity.actor - Actor entity data
 * @property {EntityContext|null} entity.primary - Primary target data
 * @property {EntityContext|null} entity.secondary - Secondary target data
 * @property {EntityContext|null} entity.tertiary - Tertiary target data
 * @property {EntityContext|null} entity.location - Location entity data
 */

/**
 * Builds the evaluation context for modifier JSON Logic conditions.
 * Resolves entity data including components for actor, targets, and location.
 */
class ModifierContextBuilder {
  #entityManager;
  #logger;

  /**
   * @param {object} deps
   * @param {import('../../entities/entityManager.js').default} deps.entityManager
   * @param {import('../../interfaces/ILogger.js').ILogger} deps.logger
   */
  constructor({ entityManager, logger }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'warn', 'error', 'info'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponentData', 'hasComponent', 'getEntity'],
    });

    this.#entityManager = entityManager;
    this.#logger = logger;

    this.#logger.debug('ModifierContextBuilder: Initialized');
  }

  /**
   * Build evaluation context for modifier conditions
   *
   * @param {object} params
   * @param {string} params.actorId - Actor entity ID
   * @param {string} [params.primaryTargetId] - Primary target entity ID
   * @param {string} [params.secondaryTargetId] - Secondary target entity ID
   * @param {string} [params.tertiaryTargetId] - Tertiary target entity ID
   * @returns {ModifierEvaluationContext}
   */
  buildContext({
    actorId,
    primaryTargetId,
    secondaryTargetId,
    tertiaryTargetId,
  }) {
    this.#logger.debug('ModifierContextBuilder: Building context', {
      actorId,
      primaryTargetId,
      secondaryTargetId,
      tertiaryTargetId,
    });

    // Build actor context
    const actorContext = this.#buildEntityContext(actorId);

    // Resolve location from actor's position
    const locationId = this.#resolveLocationId(actorId);
    const locationContext = locationId
      ? this.#buildEntityContext(locationId)
      : null;

    // Build target contexts
    const primaryContext = primaryTargetId
      ? this.#buildEntityContext(primaryTargetId)
      : null;
    const secondaryContext = secondaryTargetId
      ? this.#buildEntityContext(secondaryTargetId)
      : null;
    const tertiaryContext = tertiaryTargetId
      ? this.#buildEntityContext(tertiaryTargetId)
      : null;

    const context = {
      entity: {
        actor: actorContext,
        primary: primaryContext,
        secondary: secondaryContext,
        tertiary: tertiaryContext,
        location: locationContext,
      },
    };

    this.#logger.debug('ModifierContextBuilder: Context built', {
      hasActor: !!actorContext,
      hasPrimary: !!primaryContext,
      hasSecondary: !!secondaryContext,
      hasTertiary: !!tertiaryContext,
      hasLocation: !!locationContext,
    });

    return context;
  }

  /**
   * Build entity context with all component data
   *
   * @private
   * @param {string} entityId - Entity ID to build context for
   * @returns {EntityContext|null}
   */
  #buildEntityContext(entityId) {
    if (!entityId) {
      return null;
    }

    try {
      const entity = this.#entityManager.getEntity(entityId);
      if (!entity) {
        this.#logger.debug(
          `ModifierContextBuilder: Entity not found: ${entityId}`
        );
        return null;
      }

      // Build components map
      const components = {};

      // Get all component IDs for this entity
      const componentIds = this.#getEntityComponentIds(entity);

      for (const componentId of componentIds) {
        const componentData = this.#entityManager.getComponentData(
          entityId,
          componentId
        );
        if (componentData !== null && componentData !== undefined) {
          components[componentId] = componentData;
        }
      }

      return {
        id: entityId,
        components,
      };
    } catch (error) {
      this.#logger.warn(
        `ModifierContextBuilder: Error building entity context for ${entityId}`,
        error
      );
      return null;
    }
  }

  /**
   * Get all component IDs for an entity
   *
   * @private
   * @param {object} entity - Entity instance
   * @returns {string[]}
   */
  #getEntityComponentIds(entity) {
    try {
      if (!entity || !entity.components) {
        return [];
      }

      // Entity.components is a plain object (not a Map)
      return Object.keys(entity.components);
    } catch (error) {
      this.#logger.debug(
        'ModifierContextBuilder: Could not get component IDs',
        error
      );
      return [];
    }
  }

  /**
   * Resolve location ID from actor's position component
   *
   * @private
   * @param {string} actorId
   * @returns {string|null}
   */
  #resolveLocationId(actorId) {
    try {
      const positionData = this.#entityManager.getComponentData(
        actorId,
        'core:position'
      );
      if (positionData?.locationId) {
        return positionData.locationId;
      }
      return null;
    } catch (error) {
      this.#logger.debug(
        `ModifierContextBuilder: Could not resolve location for ${actorId}`,
        error
      );
      return null;
    }
  }
}

export default ModifierContextBuilder;
