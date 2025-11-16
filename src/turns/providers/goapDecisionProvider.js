/**
 * @file GoapDecisionProvider - GOAP-based decision provider for turn system
 *
 * Integrates GOAP planning system with the turn decision mechanism by:
 * 1. Calling GoapController to get action hints based on goals and world state
 * 2. Resolving action hints to concrete action indices in the available actions array
 * 3. Handling GOAP failures gracefully by returning null (no action chosen)
 *
 * This provider acts as an adapter between GOAP (which returns action hints)
 * and the turn system (which expects action indices).
 */

import { DelegatingDecisionProvider } from './delegatingDecisionProvider.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Decision provider for GOAP-type actors.
 * Uses GOAP controller for goal-driven action selection.
 *
 * @augments DelegatingDecisionProvider
 */
export class GoapDecisionProvider extends DelegatingDecisionProvider {
  /** @type {object} */
  #goapController;

  /** @type {object} */
  #logger;

  /**
   * Creates a new GoapDecisionProvider
   *
   * @param {object} params - Dependencies
   * @param {object} params.goapController - GOAP controller instance
   * @param {object} params.logger - Logger instance
   * @param {object} params.safeEventDispatcher - Safe event dispatcher
   */
  constructor({ goapController, logger, safeEventDispatcher }) {
    validateDependency(goapController, 'IGoapController', logger, {
      requiredMethods: ['decideTurn'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(safeEventDispatcher, 'ISafeEventDispatcher', logger, {
      requiredMethods: ['dispatch'],
    });

    // Create delegate function that calls GOAP
    const delegate = async (actor, context, actions, abortSignal) => {
      return await this.#decideWithGoap(actor, context, actions, abortSignal);
    };

    super({ delegate, logger, safeEventDispatcher });
    this.#goapController = goapController;
    this.#logger = logger;
  }

  /**
   * GOAP decision implementation
   *
   * @param {object} actor - Acting entity
   * @param {object} context - Turn context (ITurnContext)
   * @param {Array} actions - Available actions (ActionComposite[])
   * @param {AbortSignal} _abortSignal - Cancellation signal (reserved for future use)
   * @returns {Promise<{index: number|null}>} Promise resolving to object with index property (1-based action index or null)
   * @private
   */
  async #decideWithGoap(actor, context, actions, _abortSignal) {
    try {
      // 1. Extract world state from turn context
      const world = this.#extractWorldState(context);

      // 2. Call GOAP controller to get action hint
      this.#logger.debug('Calling GOAP controller for decision', {
        actorId: actor.id,
        availableActionsCount: actions.length,
      });

      const result = await this.#goapController.decideTurn({ id: actor.id }, world);

      // 3. Handle no decision (no goals, planning failed, etc.)
      if (!result || !result.actionHint) {
        this.#logger.debug('GOAP returned no decision', { actorId: actor.id });
        return { index: null };
      }

      // 4. Resolve action hint to action index
      const index = this.#resolveActionHint(result.actionHint, actions);

      if (index === null) {
        this.#logger.warn('GOAP hint could not be resolved to action', {
          actorId: actor.id,
          hint: result.actionHint,
          availableActionCount: actions.length,
        });
        return { index: null };
      }

      // 5. Success - return chosen action index
      this.#logger.info('GOAP decision made', {
        actorId: actor.id,
        actionId: result.actionHint.actionId,
        chosenIndex: index,
      });

      return { index };
    } catch (error) {
      // 6. Error handling - log and return null to trigger fallback
      this.#logger.error('GOAP decision failed', {
        actorId: actor.id,
        error: error.message,
        stack: error.stack,
      });

      // Return null to trigger fallback or idle behavior
      return { index: null };
    }
  }

  /**
   * Extract world state from turn context for GOAP planning
   *
   * @param {object} context - ITurnContext
   * @returns {object} World state object for GOAP controller
   * @private
   */
  #extractWorldState(context) {
    // Extract world state from turn context
    // Context provides: game, entityManager, actingEntity, currentLocation
    return {
      state: context.game?.state || {},
      entityManager: context.entityManager,
      actorId: context.getActor().id,
    };
  }

  /**
   * Resolve action hint to action index in available actions array
   *
   * @param {object} hint - Action hint from GOAP { actionId, targetBindings }
   * @param {Array} actions - Available actions (ActionComposite[])
   * @returns {number|null} 1-based action index or null if not found
   * @private
   */
  #resolveActionHint(hint, actions) {
    // 1. Filter actions by actionId
    const candidates = actions.filter((action) => action.actionId === hint.actionId);

    if (candidates.length === 0) {
      // Action not available in current context
      this.#logger.warn('GOAP hint action not in available actions', {
        hintActionId: hint.actionId,
        availableActions: actions.map((a) => a.actionId),
      });
      return null;
    }

    // 2. If target bindings exist, find best match
    if (hint.targetBindings && Object.keys(hint.targetBindings).length > 0) {
      const match = candidates.find((action) =>
        this.#targetBindingsMatch(hint.targetBindings, action.params)
      );

      if (match) {
        return match.index; // 1-based index
      }

      // No exact match - use first candidate as fallback
      this.#logger.warn('No exact target match, using first candidate', {
        hint,
        candidate: candidates[0],
      });
      return candidates[0].index;
    }

    // 3. No target bindings - return first match
    return candidates[0].index;
  }

  /**
   * Check if target bindings from GOAP match action parameters
   *
   * @param {object} hintBindings - Target bindings from GOAP { seat: 'entity-123' }
   * @param {object} actionParams - Parameters from ActionComposite
   * @returns {boolean} True if bindings match
   * @private
   */
  #targetBindingsMatch(hintBindings, actionParams) {
    // Check if all hint bindings match action params
    for (const [key, value] of Object.entries(hintBindings)) {
      // Check both direct key and targetId (ActionComposite may use either)
      const paramValue = actionParams[key] || actionParams.targetId;
      if (paramValue !== value) {
        return false;
      }
    }
    return true;
  }
}

export default GoapDecisionProvider;
