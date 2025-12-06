/**
 * @file Prerequisite Debugger
 * @description Utilities for debugging prerequisite evaluation
 */

import { PrerequisiteEvaluationError } from './errors/prerequisiteEvaluationError.js';

/**
 * Debug mode levels.
 */
export const DebugLevel = {
  NONE: 0, // No debugging
  ERROR: 1, // Only log errors
  WARN: 2, // Log errors and warnings
  DEBUG: 3, // Log everything
};

/**
 * Prerequisite debugger for enhanced error messages.
 */
export class PrerequisiteDebugger {
  #logger;
  #debugLevel;
  #entityManager;

  constructor({ logger, debugLevel = DebugLevel.NONE, entityManager }) {
    this.#logger = logger;
    this.#debugLevel = debugLevel;
    this.#entityManager = entityManager;
  }

  /**
   * Evaluate prerequisite with enhanced error context.
   *
   * @param {object} params - Evaluation parameters
   * @param {string} params.actionId - Action ID being evaluated
   * @param {number} params.prerequisiteIndex - Zero-based index of prerequisite
   * @param {object} params.prerequisiteLogic - JSON Logic prerequisite expression
   * @param {(logic: object, context: object) => boolean} params.evaluator - Function that evaluates the prerequisite
   * @param {object} params.context - Evaluation context with actor, target, etc.
   * @returns {object} Result object with success flag, result value, and optional error
   */
  evaluate({
    actionId,
    prerequisiteIndex,
    prerequisiteLogic,
    evaluator,
    context,
  }) {
    try {
      const result = evaluator(prerequisiteLogic, context);

      if (this.#debugLevel >= DebugLevel.DEBUG) {
        this.#logger.debug('Prerequisite evaluated', {
          actionId,
          prerequisiteIndex,
          logic: prerequisiteLogic,
          result,
          context: this.#sanitizeContext(context),
        });
      }

      return { success: true, result };
    } catch (error) {
      const enrichedError = this.#enrichError({
        actionId,
        prerequisiteIndex,
        prerequisiteLogic,
        originalError: error,
        context,
      });

      if (this.#debugLevel >= DebugLevel.ERROR) {
        this.#logger.error(
          'Prerequisite evaluation failed',
          enrichedError.toJSON()
        );
      }

      return { success: false, error: enrichedError };
    }
  }

  /**
   * Enrich error with context from entity state.
   *
   * @param {object} params - Error enrichment parameters
   * @param {string} params.actionId - Action ID being evaluated
   * @param {number} params.prerequisiteIndex - Prerequisite index
   * @param {object} params.prerequisiteLogic - Prerequisite logic that failed
   * @param {Error} params.originalError - Original error thrown during evaluation
   * @param {object} params.context - Evaluation context
   * @returns {PrerequisiteEvaluationError} Enriched error with entity state and hints
   */
  #enrichError({
    actionId,
    prerequisiteIndex,
    prerequisiteLogic,
    originalError,
    context,
  }) {
    const entityState = this.#extractEntityState(prerequisiteLogic, context);
    const hint = this.#generateHint(prerequisiteLogic, entityState);

    return new PrerequisiteEvaluationError({
      actionId,
      prerequisiteIndex,
      prerequisiteLogic,
      expectedResult: true,
      actualResult: false,
      entityState,
      hint,
      originalError: originalError.message,
    });
  }

  /**
   * Extract relevant entity state based on prerequisite logic.
   *
   * @param {object} logic - Prerequisite logic
   * @param {object} context - Evaluation context
   * @returns {object} Relevant entity state
   */
  #extractEntityState(logic, context) {
    const state = {};

    // Extract operator name
    const operator = Object.keys(logic)[0];
    const args = logic[operator];

    // Common state extraction
    if (context.actor) {
      state.actorId = context.actor.id;
      state.actorLocation = this.#getEntityLocation(context.actor.id);
    }

    if (context.target) {
      state.targetId = context.target.id;
      state.targetLocation = this.#getEntityLocation(context.target.id);
    }

    // Operator-specific state
    switch (operator) {
      case 'hasPartOfType':
        state.bodyParts = this.#getBodyParts(args[0], context);
        break;

      case 'hasOtherActorsAtLocation':
        state.entitiesAtLocation = this.#getEntitiesAtLocation(
          context.actor.id
        );
        break;

      case 'hasClothingInSlot':
        state.wornItems = this.#getWornItems(args[0], context);
        break;

      case 'component_present':
        state.hasComponent = this.#hasComponent(args[0], args[1], context);
        break;
    }

    return state;
  }

  /**
   * Generate debugging hint based on prerequisite logic.
   *
   * @param {object} logic - Prerequisite logic
   * @param {object} entityState - Entity state
   * @returns {string} Debugging hint
   */
  #generateHint(logic, entityState) {
    const operator = Object.keys(logic)[0];
    const args = logic[operator];

    switch (operator) {
      case 'hasPartOfType':
        if (!entityState.bodyParts || entityState.bodyParts.length === 0) {
          return `Actor does not have any body parts of type "${args[1]}". Check anatomy:body component.`;
        }
        break;

      case 'hasOtherActorsAtLocation':
        if (entityState.entitiesAtLocation === 1) {
          return 'Only the actor is at this location. Add other actors to the scene.';
        }
        break;

      case 'hasClothingInSlot':
        if (!entityState.wornItems || entityState.wornItems.length === 0) {
          return `No clothing in slot "${args[1]}". Add worn_items component with slot.`;
        }
        break;

      case 'component_present':
        if (!entityState.hasComponent) {
          return `Entity missing component "${args[1]}". Add component to entity.`;
        }
        break;
    }

    return 'Review prerequisite logic and entity state above.';
  }

  /**
   * Get entity location from position component.
   *
   * @param {string} entityId - Entity ID
   * @returns {string|null} Location ID
   */
  #getEntityLocation(entityId) {
    const positionData = this.#entityManager.getComponentData(
      entityId,
      'core:position'
    );
    return positionData?.locationId || null;
  }

  /**
   * Get body parts from anatomy component.
   *
   * @param {string} entityRef - Entity reference ('actor' or 'target')
   * @param {object} context - Evaluation context
   * @returns {Array} Body part types
   */
  #getBodyParts(entityRef, context) {
    const entity = context[entityRef];
    if (!entity) return [];

    const bodyComponent = this.#entityManager.getComponentData(
      entity.id,
      'anatomy:body'
    );
    if (!bodyComponent || !bodyComponent.body || !bodyComponent.body.parts)
      return [];

    return Object.values(bodyComponent.body.parts)
      .map((partId) => {
        const partComponent = this.#entityManager.getComponentData(
          partId,
          'anatomy:part'
        );
        return partComponent?.subType;
      })
      .filter(Boolean);
  }

  /**
   * Get entities at same location as actor.
   *
   * @param {string} actorId - Actor ID
   * @returns {number} Count of entities at location
   */
  #getEntitiesAtLocation(actorId) {
    const actorLocation = this.#getEntityLocation(actorId);
    if (!actorLocation) return 0;

    const entityIds = Array.from(this.#entityManager.getEntityIds());
    return entityIds.filter((entityId) => {
      const loc = this.#getEntityLocation(entityId);
      return loc === actorLocation;
    }).length;
  }

  /**
   * Get worn items from clothing component.
   *
   * @param {string} entityRef - Entity reference
   * @param {object} context - Evaluation context
   * @returns {Array} Worn item slots
   */
  #getWornItems(entityRef, context) {
    const entity = context[entityRef];
    if (!entity) return [];

    const clothingData = this.#entityManager.getComponentData(
      entity.id,
      'clothing:worn_items'
    );
    if (!clothingData || !clothingData.slots) return [];

    return Object.keys(clothingData.slots);
  }

  /**
   * Check if entity has component.
   *
   * @param {string} entityRef - Entity reference
   * @param {string} componentType - Component type
   * @param {object} context - Evaluation context
   * @returns {boolean} True if entity has component
   */
  #hasComponent(entityRef, componentType, context) {
    const entity = context[entityRef];
    if (!entity) return false;

    return this.#entityManager.hasComponent(entity.id, componentType);
  }

  /**
   * Sanitize context for logging (remove circular references).
   *
   * @param {object} context - Context to sanitize
   * @returns {object} Sanitized context
   */
  #sanitizeContext(context) {
    return {
      actor: context.actor?.id || null,
      target: context.target?.id || null,
      targets: Object.keys(context.targets || {}),
    };
  }
}
