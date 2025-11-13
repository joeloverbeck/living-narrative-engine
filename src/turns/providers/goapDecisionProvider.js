/**
 * @file GoapDecisionProvider - Stub implementation after GOAP system removal
 *
 * This stub preserves the provider interface for the core:player_type 'goap' routing,
 * allowing future task-based implementation to replace it without changing the routing mechanism.
 *
 * Current behavior: Selects first available action or returns null if no actions available.
 */

import { DelegatingDecisionProvider } from './delegatingDecisionProvider.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Decision provider stub for GOAP-type actors.
 * The full GOAP system has been removed. This stub maintains the provider interface
 * for backward compatibility with the player type routing mechanism.
 *
 * @augments DelegatingDecisionProvider
 */
export class GoapDecisionProvider extends DelegatingDecisionProvider {
  /**
   * Creates a new GoapDecisionProvider stub
   *
   * @param {object} params - Dependencies
   * @param {object} params.logger - Logger instance
   * @param {object} params.safeEventDispatcher - Safe event dispatcher
   */
  constructor({ logger, safeEventDispatcher }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });
    validateDependency(safeEventDispatcher, 'ISafeEventDispatcher', logger, {
      requiredMethods: ['dispatch'],
    });

    // Simple placeholder: pick first action
    const delegate = async (_actor, _context, actions) => {
      if (!Array.isArray(actions) || actions.length === 0) {
        logger.debug('No actions available for GOAP actor');
        return { index: null };
      }

      logger.debug(
        `GOAP stub: selecting first action (${actions[0].actionName || actions[0].actionId})`
      );
      return { index: actions[0].index };
    };

    super({ delegate, logger, safeEventDispatcher });
  }
}

export default GoapDecisionProvider;
