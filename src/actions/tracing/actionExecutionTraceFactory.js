/**
 * @file Factory for creating ActionExecutionTrace instances
 */

import { ActionExecutionTrace } from './actionExecutionTrace.js';
import { validateDependency } from '../../utils/dependencyUtils.js';
import { string } from '../../utils/validationCore.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/**
 * Factory for creating ActionExecutionTrace instances with validation
 */
export class ActionExecutionTraceFactory {
  #logger;

  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger);
  }

  /**
   * Create new ActionExecutionTrace instance
   *
   * @param {object} options - Trace creation options
   * @param {string} options.actionId - Action definition ID
   * @param {string} options.actorId - Actor ID
   * @param {object} options.turnAction - Turn action object
   * @returns {ActionExecutionTrace} New trace instance
   */
  createTrace({ actionId, actorId, turnAction }) {
    try {
      // Validate inputs using actual validation patterns
      string.assertNonBlank(
        actionId,
        'actionId',
        'ActionExecutionTraceFactory'
      );
      string.assertNonBlank(actorId, 'actorId', 'ActionExecutionTraceFactory');

      if (!turnAction || typeof turnAction !== 'object') {
        throw new InvalidArgumentError(
          'Turn action is required and must be an object'
        );
      }

      // Validate turn action structure
      this.#validateTurnAction(turnAction);

      // Create and return trace instance
      const trace = new ActionExecutionTrace({
        actionId,
        actorId,
        turnAction,
      });

      this.#logger.debug(
        `Created execution trace for action '${actionId}' by actor '${actorId}'`
      );
      return trace;
    } catch (error) {
      this.#logger.error('Failed to create ActionExecutionTrace', error);
      throw new Error(`Failed to create execution trace: ${error.message}`);
    }
  }

  /**
   * Create trace from existing turn action
   *
   * @param {object} turnAction - Complete turn action
   * @param {string} actorId - Actor ID
   * @returns {ActionExecutionTrace} New trace instance
   */
  createFromTurnAction(turnAction, actorId) {
    if (!turnAction || typeof turnAction !== 'object') {
      throw new InvalidArgumentError(
        'Turn action is required and must be an object'
      );
    }

    string.assertNonBlank(actorId, 'actorId', 'ActionExecutionTraceFactory');

    const actionId = turnAction.actionDefinitionId;
    if (!actionId) {
      throw new InvalidArgumentError('Turn action missing actionDefinitionId');
    }

    return this.createTrace({ actionId, actorId, turnAction });
  }

  /**
   * Validate turn action structure
   *
   * @private
   * @param {object} turnAction - Turn action to validate
   */
  #validateTurnAction(turnAction) {
    if (!turnAction.actionDefinitionId) {
      throw new Error('Turn action missing required actionDefinitionId');
    }

    // Optional validation of other expected fields
    const expectedFields = ['commandString', 'parameters'];
    expectedFields.forEach((field) => {
      if (turnAction[field] !== undefined && turnAction[field] !== null) {
        // Field exists, perform type validation
        if (
          field === 'commandString' &&
          typeof turnAction[field] !== 'string'
        ) {
          this.#logger.warn(
            `Turn action ${field} should be string, got ${typeof turnAction[field]}`
          );
        }
        if (field === 'parameters' && typeof turnAction[field] !== 'object') {
          this.#logger.warn(
            `Turn action ${field} should be object, got ${typeof turnAction[field]}`
          );
        }
      }
    });
  }
}
