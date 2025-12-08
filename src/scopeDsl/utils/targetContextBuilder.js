/**
 * @file Target Context Builder for Scope DSL
 * @description Builds context objects for scope DSL evaluation during multi-target resolution
 */

// Type imports for JSDoc
/** @typedef {import('../../interfaces/coreServices.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

import {
  validateDependency,
  assertPresent,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';

/**
 * Builds context objects for scope DSL evaluation
 */
class TargetContextBuilder {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {object} */
  #gameStateManager;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} params
   * @param {IEntityManager} params.entityManager
   * @param {object} params.gameStateManager
   * @param {ILogger} params.logger
   */
  constructor({ entityManager, gameStateManager, logger }) {
    validateDependency(entityManager, 'IEntityManager');
    validateDependency(gameStateManager, 'gameStateManager');
    validateDependency(logger, 'ILogger');

    this.#entityManager = entityManager;
    this.#gameStateManager = gameStateManager;
    this.#logger = logger;
  }

  /**
   * Build base context for primary target resolution
   *
   * @param {string} actorId - ID of the actor entity
   * @param {string} locationId - ID of the location entity
   * @returns {object} Base context object
   */
  buildBaseContext(actorId, locationId) {
    assertNonBlankString(
      actorId,
      'actorId',
      'TargetContextBuilder.buildBaseContext',
      this.#logger
    );
    assertNonBlankString(
      locationId,
      'locationId',
      'TargetContextBuilder.buildBaseContext',
      this.#logger
    );

    try {
      const actor = this.#buildEntityContext(actorId);
      const location = this.#buildEntityContext(locationId);
      const game = this.#buildGameContext();
      // Provide the actor as the default target so scopes that expect `target`
      // have sensible data even when no contextFrom dependency is present.
      const target = actor;

      return { actor, target, location, game };
    } catch (error) {
      this.#logger.error(
        `Failed to build base context: ${error.message}`,
        error
      );
      throw error;
    }
  }

  /**
   * Build context for dependent target resolution
   *
   * @param {object} baseContext - Base context from buildBaseContext
   * @param {object} resolvedTargets - Previously resolved targets by name
   * @param {object} targetDef - Target definition with contextFrom property
   * @param {object} trace - Optional trace logger
   * @returns {object} Enhanced context object
   */
  buildDependentContext(baseContext, resolvedTargets, targetDef, trace = null) {
    assertPresent(baseContext, 'Base context is required');
    assertPresent(resolvedTargets, 'Resolved targets is required');
    assertPresent(targetDef, 'Target definition is required');

    try {
      const context = { ...baseContext };

      // Add all resolved targets
      context.targets = { ...resolvedTargets };

      // Add specific target if contextFrom is specified
      if (targetDef.contextFrom && resolvedTargets[targetDef.contextFrom]) {
        const primaryTargets = resolvedTargets[targetDef.contextFrom];

        if (Array.isArray(primaryTargets) && primaryTargets.length > 0) {
          const primaryTargetId = primaryTargets[0].id;
          context.target = this.#buildEntityContext(primaryTargetId);
        }
      } else if (trace && targetDef.contextFrom) {
        trace.addLog(
          'warn',
          `TargetContextBuilder: contextFrom target ${targetDef.contextFrom} not found in resolved targets`,
          'TargetContextBuilder',
          {
            contextFrom: targetDef.contextFrom,
            availableTargets: Object.keys(resolvedTargets),
          }
        );
      }

      return context;
    } catch (error) {
      this.#logger.error(
        `Failed to build dependent context: ${error.message}`,
        error
      );
      throw error;
    }
  }

  /**
   * Build entity context with all components
   *
   * @param {string} entityId - Entity ID
   * @returns {object} Entity context object
   * @private
   */
  #buildEntityContext(entityId) {
    const entity = this.#entityManager.getEntityInstance(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }

    return {
      id: entity.id,
      components: entity.getAllComponents ? entity.getAllComponents() : {},
    };
  }

  /**
   * Build game state context
   *
   * @returns {object} Game state context object
   * @private
   */
  #buildGameContext() {
    return {
      turnNumber: this.#gameStateManager.getCurrentTurn?.() || 0,
      timeOfDay: this.#gameStateManager.getTimeOfDay?.() || undefined,
      weather: this.#gameStateManager.getWeather?.() || undefined,
    };
  }
}

export default TargetContextBuilder;
