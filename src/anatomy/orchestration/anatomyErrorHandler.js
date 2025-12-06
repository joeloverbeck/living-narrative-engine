/**
 * @file Error types and handler for anatomy generation operations
 */

import BaseError from '../../errors/baseError.js';
import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Error thrown when anatomy generation fails
 *
 * @class
 * @augments {BaseError}
 */
export class AnatomyGenerationError extends BaseError {
  /**
   * @param {string} message - The error message describing the generation failure
   * @param {string} [entityId] - The ID of the entity that failed generation
   * @param {string} [recipeId] - The recipe ID that was being used
   * @param {Error} [cause] - The underlying error that caused this failure
   */
  constructor(message, entityId = null, recipeId = null, cause = null) {
    super(message, 'ANATOMY_GENERATION_ERROR', {
      entityId,
      recipeId,
      cause: cause
        ? {
            name: cause.name,
            message: cause.message,
          }
        : null,
    });
    // Backward compatibility
    this.entityId = entityId;
    this.recipeId = recipeId;
    this.cause = cause;
  }

  getSeverity() {
    return 'error';
  }
  isRecoverable() {
    return true;
  } // Can retry generation
}

/**
 * Error thrown when description generation fails
 *
 * @class
 * @augments {BaseError}
 */
export class DescriptionGenerationError extends BaseError {
  /**
   * @param {string} message - The error message describing the description failure
   * @param {string} [entityId] - The ID of the entity that failed description generation
   * @param {string[]} [partIds] - Array of part IDs that failed description generation
   * @param {Error} [cause] - The underlying error that caused this failure
   */
  constructor(message, entityId = null, partIds = null, cause = null) {
    super(message, 'DESCRIPTION_GENERATION_ERROR', {
      entityId,
      partIds,
      cause: cause
        ? {
            name: cause.name,
            message: cause.message,
          }
        : null,
    });
    // Backward compatibility
    this.entityId = entityId;
    this.partIds = partIds;
    this.cause = cause;
  }

  getSeverity() {
    return 'warning';
  }
  isRecoverable() {
    return true;
  } // Can regenerate descriptions
}

/**
 * Error thrown when graph building fails
 *
 * @class
 * @augments {BaseError}
 */
export class GraphBuildingError extends BaseError {
  /**
   * @param {string} message - The error message describing the graph building failure
   * @param {string} [rootId] - The root entity ID of the graph that failed to build
   * @param {Error} [cause] - The underlying error that caused this failure
   */
  constructor(message, rootId = null, cause = null) {
    super(message, 'GRAPH_BUILDING_ERROR', {
      rootId,
      cause: cause
        ? {
            name: cause.name,
            message: cause.message,
          }
        : null,
    });
    // Backward compatibility
    this.rootId = rootId;
    this.cause = cause;
  }

  getSeverity() {
    return 'error';
  }
  isRecoverable() {
    return false;
  } // Graph structure errors are critical
}

/**
 * Handles errors during anatomy operations with context preservation
 */
export class AnatomyErrorHandler {
  /** @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;
  #centralErrorHandler;
  #recoveryStrategyManager;

  /**
   * @param {object} deps
   * @param {import('../../interfaces/coreServices.js').ILogger} deps.logger
   * @param {object} [deps.centralErrorHandler] - Central error handler instance
   * @param {object} [deps.recoveryStrategyManager] - Recovery strategy manager instance
   */
  constructor({ logger, centralErrorHandler, recoveryStrategyManager }) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['error', 'warn', 'info', 'debug'],
    });

    // New dependencies - Optional for backward compatibility
    if (centralErrorHandler) {
      validateDependency(centralErrorHandler, 'ICentralErrorHandler', logger, {
        requiredMethods: ['handle', 'handleSync'],
      });
    }

    if (recoveryStrategyManager) {
      validateDependency(
        recoveryStrategyManager,
        'IRecoveryStrategyManager',
        logger,
        {
          requiredMethods: ['executeWithRecovery', 'registerStrategy'],
        }
      );
    }

    this.#logger = logger;
    this.#centralErrorHandler = centralErrorHandler;
    this.#recoveryStrategyManager = recoveryStrategyManager;

    if (this.#centralErrorHandler && this.#recoveryStrategyManager) {
      this.#registerRecoveryStrategies();
    }
  }

  /**
   * Handles errors with context preservation and logging (synchronous for backward compatibility)
   *
   * @param {Error} error - The error to handle
   * @param {object} context - Additional context about the operation
   * @returns {Error} - The wrapped error
   */
  handle(error, context = {}) {
    // Determine operation type from context
    const errorName = error.name || 'UnknownError';
    const errorMessage = error.message || 'Unknown error occurred';

    // Log locally for debugging
    this.#logger.error(
      `AnatomyErrorHandler: ${errorName} occurred during anatomy operation`,
      {
        error: errorMessage,
        stack: error.stack,
        context,
        ...this.#extractErrorContext(error),
      }
    );

    // If central handler exists and has synchronous handling, use it
    if (this.#centralErrorHandler && this.#centralErrorHandler.handleSync) {
      try {
        // Wrap error if needed
        const wrappedError = this.#wrapError(error, context);

        const result = this.#centralErrorHandler.handleSync(wrappedError, {
          ...context,
          domain: 'anatomy',
        });

        // If central handler returned recovery result, return the wrapped error
        if (result && result.recovered !== undefined) {
          return wrappedError;
        }
        return result;
      } catch (centralError) {
        this.#logger.warn(
          'Central error handler failed, using local handling',
          {
            error: centralError.message,
          }
        );
      }
    }

    // Local handling (backward compatibility)
    return this.#handleLocally(error, context);
  }

  /**
   * Async error handling with central handler integration
   *
   * @param {Error} error - The error to handle
   * @param {object} context - Additional context about the operation
   * @returns {Promise<object|Error>} - Recovery result with fallback data if applicable
   */
  async handleAsync(error, context = {}) {
    // Determine operation type from context
    const errorName = error.name || 'UnknownError';
    const errorMessage = error.message || 'Unknown error occurred';

    // Log locally for debugging
    this.#logger.error(
      `AnatomyErrorHandler: ${errorName} occurred during anatomy operation`,
      {
        error: errorMessage,
        stack: error.stack,
        context,
        ...this.#extractErrorContext(error),
      }
    );

    // If central handler exists, delegate to it
    if (this.#centralErrorHandler) {
      try {
        // Wrap error if needed
        const wrappedError = this.#wrapError(error, context);

        return await this.#centralErrorHandler.handle(wrappedError, {
          ...context,
          domain: 'anatomy',
        });
      } catch (centralError) {
        this.#logger.warn(
          'Central error handler failed, using local handling',
          {
            error: centralError.message,
          }
        );
      }
    }

    // Local handling (backward compatibility)
    return this.#handleLocally(error, context);
  }

  /**
   * Wrap error in appropriate anatomy error type
   *
   * @private
   * @param {Error} error - The error to wrap
   * @param {object} context - Additional context
   * @returns {Error} - Wrapped error
   */
  #wrapError(error, context) {
    // Already wrapped
    if (
      error instanceof AnatomyGenerationError ||
      error instanceof DescriptionGenerationError ||
      error instanceof GraphBuildingError
    ) {
      return error;
    }

    // Determine the appropriate error type based on context
    if (context.operation === 'generation') {
      return new AnatomyGenerationError(
        `Anatomy generation failed: ${error.message}`,
        context.entityId,
        context.recipeId,
        error
      );
    } else if (context.operation === 'description') {
      return new DescriptionGenerationError(
        `Description generation failed: ${error.message}`,
        context.entityId,
        context.partIds,
        error
      );
    } else if (context.operation === 'graphBuilding') {
      return new GraphBuildingError(
        `Graph building failed: ${error.message}`,
        context.rootId,
        error
      );
    }

    // Default to AnatomyGenerationError
    return new AnatomyGenerationError(
      `Anatomy operation failed: ${error.message}`,
      context.entityId,
      context.recipeId,
      error
    );
  }

  /**
   * Synchronous error handling (alias for handle method)
   *
   * @param {Error} error - The error to handle
   * @param {object} context - Additional context about the operation
   * @returns {Error} - The wrapped error
   */
  handleSync(error, context = {}) {
    // Just call the synchronous handle method
    return this.handle(error, context);
  }

  /**
   * Local handling for backward compatibility
   *
   * @private
   * @param {Error} error - The error to handle
   * @param {object} context - Additional context
   * @returns {Error} - The wrapped error
   */
  #handleLocally(error, context) {
    const wrappedError = this.#wrapError(error, context);

    // Return wrapped error
    return wrappedError;
  }

  /**
   * Extracts additional context from known error types
   *
   * @private
   * @param {Error} error
   * @returns {object}
   */
  #extractErrorContext(error) {
    const context = {};

    if (error instanceof AnatomyGenerationError) {
      context.entityId = error.entityId;
      context.recipeId = error.recipeId;
    } else if (error instanceof DescriptionGenerationError) {
      context.entityId = error.entityId;
      context.partIds = error.partIds;
    } else if (error instanceof GraphBuildingError) {
      context.rootId = error.rootId;
    }

    if (error.cause) {
      context.causedBy = {
        name: error.cause.name,
        message: error.cause.message,
      };
    }

    return context;
  }

  /**
   * Register anatomy-specific recovery strategies
   *
   * @private
   */
  #registerRecoveryStrategies() {
    // Strategy for anatomy generation errors
    this.#recoveryStrategyManager.registerStrategy('AnatomyGenerationError', {
      retry: {
        maxRetries: 2,
        backoff: 'exponential',
      },
      fallback: async (error, operation) => {
        this.#logger.warn('Using default anatomy fallback');
        return this.#getDefaultAnatomyData(error.context);
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 120000, // 2 minutes
      },
    });

    // Strategy for description generation errors
    this.#recoveryStrategyManager.registerStrategy(
      'DescriptionGenerationError',
      {
        retry: {
          maxRetries: 3,
          backoff: 'linear',
        },
        fallback: async (error, operation) => {
          this.#logger.warn('Using generic description fallback');
          return this.#getGenericDescription(error.context);
        },
      }
    );

    // Strategy for graph building errors
    this.#recoveryStrategyManager.registerStrategy('GraphBuildingError', {
      retry: {
        maxRetries: 1,
        backoff: 'constant',
      },
      fallback: async (error, operation) => {
        this.#logger.warn('Using minimal graph structure fallback');
        return this.#getMinimalGraphStructure(error.context);
      },
    });

    this.#logger.info(
      'Anatomy recovery strategies registered with central system'
    );
  }

  /**
   * Get default anatomy data fallback
   *
   * @private
   * @param {object} context - Error context
   * @returns {object} Default anatomy data
   */
  #getDefaultAnatomyData(context) {
    return {
      type: 'fallback',
      entityId: context.entityId,
      parts: [
        { id: 'head', type: 'head', description: 'head' },
        { id: 'torso', type: 'torso', description: 'torso' },
        { id: 'leftArm', type: 'arm', description: 'left arm' },
        { id: 'rightArm', type: 'arm', description: 'right arm' },
        { id: 'leftLeg', type: 'leg', description: 'left leg' },
        { id: 'rightLeg', type: 'leg', description: 'right leg' },
      ],
    };
  }

  /**
   * Get generic description fallback
   *
   * @private
   * @param {object} context - Error context
   * @returns {object} Generic description data
   */
  #getGenericDescription(context) {
    return {
      type: 'fallback',
      entityId: context.entityId,
      description: 'A standard humanoid form.',
      parts: context.partIds
        ? context.partIds.map((id) => ({
            id,
            description: `${id} part`,
          }))
        : [],
    };
  }

  /**
   * Get minimal graph structure fallback
   *
   * @private
   * @param {object} context - Error context
   * @returns {object} Minimal graph structure
   */
  #getMinimalGraphStructure(context) {
    return {
      type: 'fallback',
      rootId: context.rootId,
      nodes: [{ id: context.rootId, type: 'root' }],
      edges: [],
    };
  }
}
