/**
 * @file Engine for suggesting fixes based on error patterns in the action system.
 * @see specs/action-system-better-error-context.md
 */

import { FIX_TYPES } from './actionErrorTypes.js';
import { BaseService } from '../../utils/serviceBase.js';

/** @typedef {import('./actionErrorTypes.js').SuggestedFix} SuggestedFix */
/** @typedef {import('./actionErrorTypes.js').ActorSnapshot} ActorSnapshot */
/** @typedef {import('../../data/gameDataRepository.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../../actions/actionIndex.js').ActionIndex} ActionIndex */

/**
 * Engine for suggesting fixes based on error patterns.
 */
export class FixSuggestionEngine extends BaseService {
  #logger;
  #gameDataRepository;
  #actionIndex;

  /**
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {IGameDataRepository} dependencies.gameDataRepository
   * @param {ActionIndex} dependencies.actionIndex
   */
  constructor({ logger, gameDataRepository, actionIndex }) {
    super();
    this.#logger = this._init('FixSuggestionEngine', logger, {
      gameDataRepository: {
        value: gameDataRepository,
        requiredMethods: ['getComponentDefinition', 'getConditionDefinition'],
      },
      actionIndex: {
        value: actionIndex,
        requiredMethods: ['getCandidateActions'],
      },
    });

    this.#gameDataRepository = gameDataRepository;
    this.#actionIndex = actionIndex;
  }

  /**
   * Suggests fixes based on error context.
   *
   * @param {Error} error - The error
   * @param {ActionDefinition} actionDef - Action definition
   * @param {ActorSnapshot} actorSnapshot - Actor state
   * @param {string} phase - Error phase
   * @returns {SuggestedFix[]}
   */
  suggestFixes(error, actionDef, actorSnapshot, phase) {
    /** @type {SuggestedFix[]} */
    const suggestions = [];

    // Initialize fields to avoid unused warnings
    this.#logger.debug(`Analyzing error for fixes: ${error.message}`);
    this.#gameDataRepository; // Available for future use
    this.#actionIndex; // Available for future use

    // Analyze error message for patterns
    const errorMessage = error.message?.toLowerCase() || '';
    const errorName = error.name || '';

    // Check for missing component errors
    if (this.#isMissingComponentError(errorMessage, errorName)) {
      suggestions.push(
        ...this.#suggestMissingComponentFixes(error, actionDef, actorSnapshot)
      );
    }

    // Check for invalid state errors
    if (this.#isInvalidStateError(errorMessage, errorName)) {
      suggestions.push(
        ...this.#suggestInvalidStateFixes(error, actionDef, actorSnapshot)
      );
    }

    // Check for scope resolution errors
    if (this.#isScopeResolutionError(errorMessage, errorName)) {
      suggestions.push(
        ...this.#suggestScopeResolutionFixes(error, actionDef, actorSnapshot)
      );
    }

    // Check for prerequisite failures
    if (phase === 'validation' && actionDef.prerequisites) {
      suggestions.push(
        ...this.#suggestPrerequisiteFixes(error, actionDef, actorSnapshot)
      );
    }

    // Check for target-related errors
    if (this.#isTargetError(errorMessage, errorName)) {
      suggestions.push(
        ...this.#suggestTargetFixes(error, actionDef, actorSnapshot)
      );
    }

    // Sort by confidence score (highest first)
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return suggestions;
  }

  /**
   * Checks if the error is related to missing components.
   *
   * @param errorMessage
   * @param errorName
   * @private
   */
  #isMissingComponentError(errorMessage, errorName) {
    return (
      errorMessage.includes('missing component') ||
      errorMessage.includes('component not found') ||
      errorMessage.includes('no component') ||
      errorName === 'ComponentNotFoundError'
    );
  }

  /**
   * Checks if the error is related to invalid state.
   *
   * @param errorMessage
   * @param errorName
   * @private
   */
  #isInvalidStateError(errorMessage, errorName) {
    return (
      errorMessage.includes('invalid state') ||
      errorMessage.includes('state mismatch') ||
      errorMessage.includes('wrong state') ||
      errorName === 'InvalidStateError'
    );
  }

  /**
   * Checks if the error is related to scope resolution.
   *
   * @param errorMessage
   * @param errorName
   * @private
   */
  #isScopeResolutionError(errorMessage, errorName) {
    return (
      errorMessage.includes('scope') ||
      errorMessage.includes('resolution failed') ||
      errorMessage.includes('no valid targets') ||
      errorName === 'ScopeResolutionError'
    );
  }

  /**
   * Checks if the error is related to targets.
   *
   * @param errorMessage
   * @param errorName
   * @private
   */
  #isTargetError(errorMessage, errorName) {
    return (
      errorMessage.includes('target') ||
      errorMessage.includes('no entities') ||
      errorMessage.includes('entity not found')
    );
  }

  /**
   * Suggests fixes for missing component errors.
   *
   * @param error
   * @param actionDef
   * @param actorSnapshot
   * @private
   */
  #suggestMissingComponentFixes(error, actionDef, actorSnapshot) {
    /** @type {SuggestedFix[]} */
    const fixes = [];

    // Extract component ID from error if possible
    const componentMatch = error.message?.match(
      /component[:\s]+['"]?(\w+:?\w+)['"]?/i
    );
    const componentId = componentMatch?.[1];

    if (componentId) {
      fixes.push({
        type: FIX_TYPES.MISSING_COMPONENT,
        description: `Add the required component '${componentId}' to the actor entity`,
        details: {
          componentId,
          actorId: actorSnapshot.id,
          requiredBy: actionDef.id,
        },
        confidence: 0.9,
      });
    }

    // Check prerequisites for required components
    if (actionDef.prerequisites) {
      const requiredComponents = this.#extractRequiredComponents(
        actionDef.prerequisites
      );
      for (const compId of requiredComponents) {
        if (!actorSnapshot.components[compId]) {
          fixes.push({
            type: FIX_TYPES.MISSING_COMPONENT,
            description: `Actor is missing required component '${compId}' for action '${actionDef.id}'`,
            details: {
              componentId: compId,
              actorId: actorSnapshot.id,
              source: 'prerequisite_analysis',
            },
            confidence: 0.8,
          });
        }
      }
    }

    return fixes;
  }

  /**
   * Suggests fixes for invalid state errors.
   *
   * @param error
   * @param actionDef
   * @param actorSnapshot
   * @private
   */
  #suggestInvalidStateFixes(error, actionDef, actorSnapshot) {
    /** @type {SuggestedFix[]} */
    const fixes = [];

    // Analyze component states
    const stateComponents = ['core:state', 'core:status', 'core:condition'];
    for (const compId of stateComponents) {
      const component = actorSnapshot.components[compId];
      if (component) {
        fixes.push({
          type: FIX_TYPES.INVALID_STATE,
          description: `Check the '${compId}' component state - current value: ${JSON.stringify(component)}`,
          details: {
            componentId: compId,
            currentValue: component,
            actorId: actorSnapshot.id,
          },
          confidence: 0.7,
        });
      }
    }

    return fixes;
  }

  /**
   * Suggests fixes for scope resolution errors.
   *
   * @param error
   * @param actionDef
   * @param actorSnapshot
   * @private
   */
  #suggestScopeResolutionFixes(error, actionDef, actorSnapshot) {
    /** @type {SuggestedFix[]} */
    const fixes = [];

    if (actionDef?.scope) {
      fixes.push({
        type: FIX_TYPES.SCOPE_RESOLUTION,
        description: `Action scope '${actionDef.scope}' failed to resolve any valid targets`,
        details: {
          scope: actionDef.scope,
          actorLocation: actorSnapshot.location,
          suggestion: 'Ensure entities exist that match the scope criteria',
        },
        confidence: 0.8,
      });

      // Suggest checking actor location
      if (!actorSnapshot.location || actorSnapshot.location === 'none') {
        fixes.push({
          type: FIX_TYPES.INVALID_STATE,
          description:
            'Actor has no valid location, which may prevent scope resolution',
          details: {
            actorId: actorSnapshot.id,
            currentLocation: actorSnapshot.location,
            suggestion: 'Ensure actor has a valid location component',
          },
          confidence: 0.9,
        });
      }
    }

    return fixes;
  }

  /**
   * Suggests fixes for prerequisite failures.
   *
   * @param error
   * @param actionDef
   * @param actorSnapshot
   * @private
   */
  #suggestPrerequisiteFixes(error, actionDef, actorSnapshot) {
    /** @type {SuggestedFix[]} */
    const fixes = [];

    if (actionDef.prerequisites && actionDef.prerequisites.length > 0) {
      fixes.push({
        type: FIX_TYPES.MISSING_PREREQUISITE,
        description: `Action '${actionDef.id}' has prerequisites that are not met`,
        details: {
          prerequisites: actionDef.prerequisites,
          actorComponents: Object.keys(actorSnapshot.components),
          suggestion:
            'Review the prerequisite conditions and ensure actor state matches requirements',
        },
        confidence: 0.75,
      });
    }

    return fixes;
  }

  /**
   * Suggests fixes for target-related errors.
   *
   * @param error
   * @param actionDef
   * @param actorSnapshot
   * @private
   */
  #suggestTargetFixes(error, actionDef, actorSnapshot) {
    /** @type {SuggestedFix[]} */
    const fixes = [];

    fixes.push({
      type: FIX_TYPES.INVALID_TARGET,
      description: 'No valid targets found for the action',
      details: {
        actionScope: actionDef.scope || 'none',
        actorLocation: actorSnapshot.location,
        suggestion: 'Verify that entities exist in the expected scope/location',
      },
      confidence: 0.7,
    });

    return fixes;
  }

  /**
   * Extracts required component IDs from prerequisites.
   *
   * @param prerequisites
   * @private
   */
  #extractRequiredComponents(prerequisites) {
    const componentIds = new Set();

    // Simple extraction - looks for hasComponent operations
    const searchObject = (obj) => {
      if (typeof obj !== 'object' || obj === null) return;

      if (obj.hasComponent && typeof obj.hasComponent === 'string') {
        componentIds.add(obj.hasComponent);
      }

      for (const value of Object.values(obj)) {
        if (Array.isArray(value)) {
          value.forEach(searchObject);
        } else if (typeof value === 'object') {
          searchObject(value);
        }
      }
    };

    prerequisites.forEach(searchObject);
    return Array.from(componentIds);
  }
}
